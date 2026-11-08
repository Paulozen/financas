// Passos depois de baixar os dados da Pluggy (roda no servidor, com a sessão do usuário):
// 1. faturas do banco -> ocorrências de fatura do cartão vinculado (valor e vencimento);
// 2. faturas futuras -> previsão (parcelas conhecidas + média à vista);
// 3. compras do cartão sem categoria -> categoria sugerida (regra aprendida, pacote de lojas ou Pluggy);
// 4. investimentos -> reservas automáticas (dono + banco + tipo) e saldo do dia no histórico;
// 5. saldo do dia de cada conta corrente no histórico (evolução do patrimônio).
import type { SupabaseClient } from "@supabase/supabase-js";
import { mesDe } from "../datas";
import { padraoDe } from "../importacao/sugestao";
import { previsaoFaturas, type CompraCartao } from "./cartao";
import { categoriaDoPacote } from "../pacote-regras";
import { categoriaDaPluggy } from "./categorias";
import { chaveGrupo, contaNoTotal, nomeGrupo, saldoPorReserva, type InvestimentoGrupo } from "./grupos";

function checar<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

interface Conta {
  id: string;
  cartao_id: string | null;
  ativa: boolean;
}
interface Fatura {
  vencimento: string;
  valor: number;
}
interface OcorrenciaFatura {
  id: string;
  vencimento: string;
  valor_previsto: number;
  status: string;
}
interface Compra extends CompraCartao {
  id: string;
}

export async function aposSincronizar(sb: SupabaseClient, casaId: string, hoje: string): Promise<void> {
  await atualizarFaturas(sb, casaId, hoje);
  await categorizarComprasDeCartao(sb, casaId);
  await atualizarReservas(sb, casaId, hoje);
  await gravarSaldosContas(sb, casaId, hoje);
}

/** Um ponto por dia e por conta corrente no histórico de saldos. */
async function gravarSaldosContas(sb: SupabaseClient, casaId: string, hoje: string) {
  const contas = checar(
    await sb.from("contas_externas").select("id, saldo").eq("casa_id", casaId).eq("tipo", "BANK").not("saldo", "is", null),
  ) as { id: string; saldo: number }[];
  if (!contas.length) return;
  checar(
    await sb
      .from("conta_saldos")
      .upsert(
        contas.map((c) => ({ casa_id: casaId, conta_externa_id: c.id, data: hoje, valor: c.saldo })),
        { onConflict: "conta_externa_id,data" },
      ),
  );
}

async function atualizarFaturas(sb: SupabaseClient, casaId: string, hoje: string) {
  const contas = checar(await sb.from("contas_externas").select("id, cartao_id, ativa").eq("casa_id", casaId).eq("tipo", "CREDIT")) as Conta[];
  for (const conta of contas.filter((c) => c.cartao_id && c.ativa)) {
    const [regra] = checar(await sb.from("recorrencias").select("id").eq("casa_id", casaId).eq("cartao_id", conta.cartao_id!)) as { id: string }[];
    if (!regra) continue;
    const faturas = checar(await sb.from("faturas_externas").select("vencimento, valor").eq("conta_externa_id", conta.id)) as Fatura[];
    const compras = checar(
      await sb
        .from("transacoes_externas")
        .select("id, descricao, valor, data, data_compra, parcela_num, parcelas_total, fatura_mes, categoria_pluggy")
        .eq("conta_externa_id", conta.id),
    ) as Compra[];
    // Sem fatura nem compra o banco não mandou dados deste cartão: não mexe no previsto.
    if (!faturas.length && !compras.length) continue;

    const ocorrencias = checar(
      await sb
        .from("ocorrencias")
        .select("id, vencimento, valor_previsto, status")
        .eq("casa_id", casaId)
        .eq("origem_tipo", "fatura")
        .eq("origem_id", regra.id)
        .eq("status", "pendente"),
    ) as OcorrenciaFatura[];

    const porMes = new Map(faturas.map((f) => [mesDe(f.vencimento), f]));
    const fechados = [...porMes.keys()].sort();
    const ultimoFechado = fechados.at(-1) ?? "";
    const futuros = ocorrencias.map((o) => mesDe(o.vencimento)).filter((m) => m > ultimoFechado && m >= mesDe(hoje));
    const previsao = previsaoFaturas(compras, fechados, futuros);

    for (const o of ocorrencias) {
      const mes = mesDe(o.vencimento);
      const fatura = porMes.get(mes);
      const campos: Record<string, unknown> = {};
      if (fatura) {
        // Fatura fechada: valor e vencimento do banco; continua pendente até o pagamento ser vinculado.
        if (o.valor_previsto !== fatura.valor) campos.valor_previsto = fatura.valor;
        if (o.vencimento !== fatura.vencimento) campos.vencimento = fatura.vencimento;
      } else if (previsao.has(mes)) {
        const valor = previsao.get(mes)!;
        if (valor > 0 && o.valor_previsto !== valor) campos.valor_previsto = valor;
      }
      if (Object.keys(campos).length) {
        checar(await sb.from("ocorrencias").update({ ...campos, previsto_manual: true }).eq("id", o.id));
      }
    }
  }
}

async function categorizarComprasDeCartao(sb: SupabaseClient, casaId: string) {
  const semCategoria = checar(
    await sb.from("transacoes_externas").select("id, descricao, valor, categoria_pluggy").eq("casa_id", casaId).eq("situacao", "cartao").is("categoria_id", null),
  ) as { id: string; descricao: string; valor: number; categoria_pluggy: string | null }[];
  if (!semCategoria.length) return;
  const [categorias, regras] = await Promise.all([
    sb.from("categorias").select("id, nome, tipo, ativa").eq("casa_id", casaId).then(checar),
    sb.from("regras_importacao").select("padrao, categoria_id").eq("casa_id", casaId).not("categoria_id", "is", null).then(checar),
  ]);
  const porRegra = new Map((regras as { padrao: string; categoria_id: string }[]).map((r) => [r.padrao, r.categoria_id]));
  const grupos = new Map<string, string[]>();
  for (const t of semCategoria) {
    if (t.valor <= 0) continue; // pagamentos e estornos não ganham categoria de gasto
    const cat =
      porRegra.get(padraoDe(t)) ??
      categoriaDoPacote(t.descricao, categorias as { id: string; nome: string; tipo: string; ativa: boolean }[]) ??
      categoriaDaPluggy(t.categoria_pluggy, "saida", categorias as { id: string; nome: string; tipo: string; ativa: boolean }[]);
    if (cat) grupos.set(cat, [...(grupos.get(cat) ?? []), t.id]);
  }
  for (const [cat, ids] of grupos) {
    for (let i = 0; i < ids.length; i += 200) {
      checar(await sb.from("transacoes_externas").update({ categoria_id: cat }).in("id", ids.slice(i, i + 200)));
    }
  }
}

/**
 * Reservas automáticas: cada aplicação ativa sem grupo entra no grupo do seu
 * dono + banco + tipo (o grupo é criado se faltar) e o saldo de cada reserva
 * com aplicações é gravado no histórico do dia (um registro por dia).
 */
async function atualizarReservas(sb: SupabaseClient, casaId: string, hoje: string) {
  const [investimentos, itens, membros, automaticas] = await Promise.all([
    sb.from("investimentos_externos").select("id, pluggy_item_id, tipo, subtipo, saldo, status, vencimento, reserva_id").eq("casa_id", casaId).then(checar),
    sb.from("pluggy_itens").select("pluggy_item_id, banco, dono_membro_id").eq("casa_id", casaId).then(checar),
    sb.from("membros").select("id, nome").eq("casa_id", casaId).then(checar),
    sb.from("reservas").select("id, grupo_chave").eq("casa_id", casaId).not("grupo_chave", "is", null).then(checar),
  ]);
  const lista = (investimentos as InvestimentoGrupo[]).map((i) => ({ ...i, saldo: Number(i.saldo) }));
  const porChave = new Map((automaticas as { id: string; grupo_chave: string }[]).map((r) => [r.grupo_chave, r.id]));
  const itemDe = new Map((itens as { pluggy_item_id: string; banco: string | null; dono_membro_id: string | null }[]).map((i) => [i.pluggy_item_id, i]));
  const nomeMembro = new Map((membros as { id: string; nome: string }[]).map((m) => [m.id, m.nome]));

  // 1. Aplicações novas (ou soltas) entram no grupo certo.
  const vincular = new Map<string, string[]>();
  for (const inv of lista) {
    if (inv.reserva_id || !contaNoTotal(inv, hoje)) continue;
    const chave = chaveGrupo(inv);
    let reservaId = porChave.get(chave);
    if (!reservaId) {
      const item = itemDe.get(inv.pluggy_item_id);
      const dono = item?.dono_membro_id ?? null;
      const nova = checar(
        await sb
          .from("reservas")
          .insert({
            casa_id: casaId,
            nome: nomeGrupo(inv.tipo, inv.subtipo, item?.banco ?? null, dono ? (nomeMembro.get(dono) ?? null) : null),
            banco: item?.banco ?? null,
            dono_membro_id: dono,
            observacao: "Reserva automática: saldo atualizado a cada sincronização do Open Finance.",
            automatica: true,
            grupo_chave: chave,
          })
          .select("id")
          .single(),
      ) as { id: string };
      reservaId = nova.id;
      porChave.set(chave, reservaId);
    }
    vincular.set(reservaId, [...(vincular.get(reservaId) ?? []), inv.id]);
    inv.reserva_id = reservaId;
  }
  for (const [reservaId, ids] of vincular) {
    for (let i = 0; i < ids.length; i += 200) {
      checar(await sb.from("investimentos_externos").update({ reserva_id: reservaId }).in("id", ids.slice(i, i + 200)));
    }
  }

  // 2. Saldo do dia de cada reserva com aplicações (para o gráfico de evolução).
  for (const [reservaId, saldo] of saldoPorReserva(lista, hoje)) {
    const [doDia] = checar(await sb.from("reserva_saldos").select("id, valor").eq("reserva_id", reservaId).eq("data", hoje)) as { id: string; valor: number }[];
    if (doDia) {
      if (Number(doDia.valor) !== saldo) checar(await sb.from("reserva_saldos").update({ valor: saldo }).eq("id", doDia.id));
    } else {
      checar(await sb.from("reserva_saldos").insert({ casa_id: casaId, reserva_id: reservaId, data: hoje, valor: saldo }));
    }
  }
}
