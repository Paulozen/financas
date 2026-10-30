// Sincronização com a Pluggy. Roda no servidor (rota /api/pluggy/sincronizar)
// com o cliente Supabase da sessão do usuário: tudo passa pelo RLS.
import type { SupabaseClient } from "@supabase/supabase-js";
import { hojeISO, somarDias } from "../datas";
import { semAcentos } from "../importacao/texto";
import type { ClientePluggy } from "./api";
import { acharJaImportadas, centavos, converterTransacao, nomeBanco, nomeConta, type ImportadaPorArquivo, type TransacaoExternaNova } from "./converter";
import { aposSincronizar } from "./pos-sincronizacao";

const DIAS_PRIMEIRA = 90;
const DIAS_SOBREPOSICAO = 7;

export interface ResumoSincronizacao {
  itens: number;
  contas: number;
  novas: number;
  jaImportadas: number;
  cartao: number;
  erros: string[];
}

function checar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

async function todas<T>(consulta: (de: number, ate: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const lista: T[] = [];
  for (let de = 0; ; de += 1000) {
    const parte = checar(await consulta(de, de + 999)) ?? [];
    lista.push(...parte);
    if (parte.length < 1000) return lista;
  }
}

export async function sincronizarCasa(
  sb: SupabaseClient,
  casaId: string,
  membros: { id: string; nome: string }[],
  pluggy: ClientePluggy,
  itens: { itemId: string; dono: string }[],
): Promise<ResumoSincronizacao> {
  const agora = new Date().toISOString();
  const hoje = hojeISO();
  const resumo: ResumoSincronizacao = { itens: 0, contas: 0, novas: 0, jaImportadas: 0, cartao: 0, erros: [] };
  const donoDe = (nome: string) => membros.find((m) => semAcentos(m.nome) === semAcentos(nome))?.id ?? null;

  const estados = checar(await sb.from("pluggy_itens").select("*").eq("casa_id", casaId)) as { pluggy_item_id: string; ultima_sincronizacao: string | null }[];
  const contasDb = checar(await sb.from("contas_externas").select("id, pluggy_account_id, nome, dono_membro_id, dono_manual").eq("casa_id", casaId)) as {
    id: string;
    pluggy_account_id: string;
    nome: string;
    dono_membro_id: string | null;
    dono_manual: boolean;
  }[];
  // Transações que vieram por arquivo (o hash das que vieram da Pluggy começa com "pluggy:").
  const importadas = await todas<ImportadaPorArquivo>((de, ate) =>
    sb.from("transacoes_importadas").select("id, data, valor, descricao").eq("casa_id", casaId).not("hash", "like", "pluggy:%").range(de, ate),
  );

  for (const { itemId, dono } of itens) {
    resumo.itens++;
    const donoId = donoDe(dono);
    const estado = estados.find((e) => e.pluggy_item_id === itemId);
    const desde = estado?.ultima_sincronizacao
      ? somarDias(estado.ultima_sincronizacao.slice(0, 10), -DIAS_SOBREPOSICAO)
      : somarDias(hoje, -DIAS_PRIMEIRA);
    try {
      const item = await pluggy.item(itemId);
      const contasDoItem = await pluggy.contas(itemId);
      checar(
        await sb.from("pluggy_itens").upsert(
          {
            casa_id: casaId,
            pluggy_item_id: itemId,
            dono_membro_id: donoId,
            banco: nomeBanco(item.connector?.name, contasDoItem),
            status: item.status,
            execution_status: item.executionStatus ?? null,
            erro_codigo: item.error?.code ?? null,
            erro_mensagem: item.error?.message ?? null,
            consent_expires_at: item.consentExpiresAt ?? null,
            atualizado_em: agora,
          },
          { onConflict: "casa_id,pluggy_item_id" },
        ),
      );

      for (const conta of contasDoItem) {
        resumo.contas++;
        const existente = contasDb.find((c) => c.pluggy_account_id === conta.id);
        const linhaConta = checar(
          await sb
            .from("contas_externas")
            .upsert(
              {
                casa_id: casaId,
                pluggy_item_id: itemId,
                pluggy_account_id: conta.id,
                tipo: conta.type,
                subtipo: conta.subtype ?? null,
                // nome e dono editados na tela são preservados
                nome: existente?.nome ?? nomeConta(conta),
                dono_membro_id: existente?.dono_manual ? existente.dono_membro_id : donoId,
                saldo: centavos(conta.balance),
                saldo_em: agora,
                dados: {
                  limite: conta.creditData?.creditLimit != null ? centavos(conta.creditData.creditLimit) : null,
                  disponivel: conta.creditData?.availableCreditLimit != null ? centavos(conta.creditData.availableCreditLimit) : null,
                  vencimento: conta.creditData?.balanceDueDate?.slice(0, 10) ?? null,
                },
                atualizado_em: agora,
              },
              { onConflict: "casa_id,pluggy_account_id" },
            )
            .select("id")
            .single(),
        ) as { id: string };

        const faturas = conta.type === "CREDIT" ? await pluggy.faturas(conta.id) : [];
        if (faturas.length) {
          checar(
            await sb.from("faturas_externas").upsert(
              faturas.map((f) => ({
                casa_id: casaId,
                conta_externa_id: linhaConta.id,
                pluggy_bill_id: f.id,
                vencimento: f.dueDate.slice(0, 10),
                fechamento: f.billClosingDate?.slice(0, 10) ?? null,
                valor: centavos(f.totalAmount),
                minimo: f.minimumPaymentAmount != null ? centavos(f.minimumPaymentAmount) : null,
                pago: centavos((f.payments ?? []).reduce((s, p) => s + (p.amount ?? 0), 0)),
                atualizado_em: agora,
              })),
              { onConflict: "casa_id,pluggy_bill_id" },
            ),
          );
        }

        const convertidas = (await pluggy.transacoes(conta.id, desde)).map((t) => converterTransacao(t, conta.type, faturas));
        await gravarTransacoes(sb, casaId, linhaConta.id, conta.type, convertidas, importadas, resumo);
      }

      const investimentos = await pluggy.investimentos(itemId).catch(() => []);
      if (investimentos.length) {
        checar(
          await sb.from("investimentos_externos").upsert(
            investimentos.map((i) => ({
              casa_id: casaId,
              pluggy_item_id: itemId,
              pluggy_investment_id: i.id,
              nome: i.name,
              tipo: i.type ?? null,
              subtipo: i.subtype ?? null,
              emissor: i.issuer ?? null,
              vencimento: i.dueDate?.slice(0, 10) ?? null,
              saldo: centavos(i.balance),
              status: i.status ?? null,
              atualizado_em: agora,
            })),
            { onConflict: "casa_id,pluggy_investment_id" },
          ),
        );
      }

      checar(
        await sb
          .from("pluggy_itens")
          .update({ ultima_sincronizacao: agora, ultimo_erro: null })
          .eq("casa_id", casaId)
          .eq("pluggy_item_id", itemId),
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      resumo.erros.push(msg);
      await sb
        .from("pluggy_itens")
        .upsert(
          { casa_id: casaId, pluggy_item_id: itemId, dono_membro_id: donoId, ultimo_erro: msg, atualizado_em: agora },
          { onConflict: "casa_id,pluggy_item_id" },
        );
    }
  }

  try {
    await aposSincronizar(sb, casaId, hoje);
  } catch (e) {
    resumo.erros.push(`Faturas/reservas: ${e instanceof Error ? e.message : String(e)}`);
  }
  return resumo;
}

async function gravarTransacoes(
  sb: SupabaseClient,
  casaId: string,
  contaId: string,
  tipoConta: "BANK" | "CREDIT",
  lista: TransacaoExternaNova[],
  importadas: ImportadaPorArquivo[],
  resumo: ResumoSincronizacao,
) {
  if (!lista.length) return;
  const existentes = new Map<string, { id: string; valor: number; data: string; status_pluggy: string | null; descricao: string; fatura_mes: string | null }>();
  for (let i = 0; i < lista.length; i += 200) {
    const ids = lista.slice(i, i + 200).map((t) => t.pluggy_id);
    const linhas = checar(
      await sb.from("transacoes_externas").select("id, pluggy_id, valor, data, status_pluggy, descricao, fatura_mes").eq("casa_id", casaId).in("pluggy_id", ids),
    ) as { id: string; pluggy_id: string; valor: number; data: string; status_pluggy: string | null; descricao: string; fatura_mes: string | null }[];
    for (const l of linhas) existentes.set(l.pluggy_id, l);
  }

  const novas = lista.filter((t) => !existentes.has(t.pluggy_id));
  const jaVieram = tipoConta === "BANK" ? acharJaImportadas(novas, importadas) : new Map<string, string>();
  const linhas = novas.map((t) => {
    const duplicada = jaVieram.get(t.pluggy_id);
    if (tipoConta === "CREDIT") resumo.cartao++;
    else if (duplicada) resumo.jaImportadas++;
    else resumo.novas++;
    return {
      ...t,
      casa_id: casaId,
      conta_externa_id: contaId,
      situacao: tipoConta === "CREDIT" ? "cartao" : duplicada ? "duplicada" : "pendente",
      transacao_importada_id: duplicada ?? null,
    };
  });
  for (let i = 0; i < linhas.length; i += 500) {
    checar(await sb.from("transacoes_externas").upsert(linhas.slice(i, i + 500), { onConflict: "casa_id,pluggy_id", ignoreDuplicates: true }));
  }

  // Já existentes: atualiza só o que o banco pode ter mudado (ex.: PENDING -> POSTED).
  for (const t of lista) {
    const e = existentes.get(t.pluggy_id);
    if (!e) continue;
    if (e.valor !== t.valor || e.data !== t.data || e.status_pluggy !== t.status_pluggy || e.descricao !== t.descricao || e.fatura_mes !== t.fatura_mes) {
      checar(
        await sb
          .from("transacoes_externas")
          .update({
            valor: t.valor,
            data: t.data,
            status_pluggy: t.status_pluggy,
            descricao: t.descricao,
            fatura_mes: t.fatura_mes,
            bill_id: t.bill_id,
            atualizado_em: new Date().toISOString(),
          })
          .eq("id", e.id),
      );
    }
  }
}
