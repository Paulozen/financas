"use client";

// Caixa de entrada do Open Finance: transações de conta corrente "a revisar".
// Reaproveita as sugestões e a confirmação da importação por arquivo.
import { categoriaDoPacote } from "./pacote-regras";
import { aplicarRegras, type Regra } from "./regras";
import { paresDeTransferencia } from "./transferencias";
import type { LinhaPrevia } from "@/components/importar/previa";
import { somarDias } from "./datas";
import { buscarTodos, checar } from "./db";
import type { TransacaoExtrato } from "./importacao/extrato";
import { padraoDe, sugerir, type RegraAprendida } from "./importacao/sugestao";
import { supabase } from "./supabase";
import { categoriaDaPluggy } from "./pluggy/categorias";
import type { Casa, Categoria, Membro, Ocorrencia, RachaTipo } from "./tipos";

export interface TransacaoExterna {
  id: string;
  conta_externa_id: string;
  pluggy_id: string;
  data: string;
  descricao: string;
  valor: number;
  categoria_pluggy: string | null;
  situacao: "pendente" | "confirmada" | "duplicada" | "cartao";
  acao: string | null;
  automatica: boolean;
  categoria_id: string | null;
  confirmada_em: string | null;
  transacao_importada_id: string | null;
}

export interface ContaExterna {
  id: string;
  nome: string;
  tipo: "BANK" | "CREDIT";
  subtipo: string | null;
  dono_membro_id: string | null;
  ativa: boolean;
  saldo: number | null;
  saldo_em: string | null;
  cartao_id: string | null;
  pluggy_item_id: string;
  dados: { limite?: number | null; disponivel?: number | null; vencimento?: string | null };
}

export interface LinhaCaixa extends LinhaPrevia {
  externa: TransacaoExterna;
  conta: ContaExterna | undefined;
}

export const hashPluggy = (pluggyId: string) => `pluggy:${pluggyId}`;

/** Monta as linhas da caixa de entrada com as sugestões já preenchidas. */
export async function carregarCaixa(casa: Casa, categorias: Categoria[]): Promise<{ linhas: LinhaCaixa[]; pendentes: Ocorrencia[] }> {
  const [externas, contas, regras, regrasCasal] = await Promise.all([
    buscarTodos<TransacaoExterna>("transacoes_externas", casa.id, (q) => q.eq("situacao", "pendente"), "data"),
    buscarTodos<ContaExterna>("contas_externas", casa.id),
    buscarTodos<RegraAprendida>("regras_importacao", casa.id),
    buscarTodos<Regra>("regras", casa.id, (q) => q.eq("ativa", true)),
  ]);
  const ativas = new Map(contas.filter((c) => c.ativa && c.tipo === "BANK").map((c) => [c.id, c]));
  const lista = externas.filter((t) => ativas.has(t.conta_externa_id)).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  if (!lista.length) return { linhas: [], pendentes: [] };

  const datas = lista.map((t) => t.data).sort();
  const pendentes = await buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) =>
    q
      .eq("status", "pendente")
      .gte("vencimento", somarDias(datas[0], -10))
      .lte("vencimento", somarDias(datas.at(-1)!, 10)),
  );

  // Transferências entre contas de vocês: a outra perna pode já ter sido revisada,
  // então entram todas as transações de conta corrente do período (±2 dias).
  const vizinhas = await buscarTodos<TransacaoExterna>("transacoes_externas", casa.id, (q) =>
    q
      .neq("situacao", "cartao")
      .gte("data", somarDias(datas[0], -2))
      .lte("data", somarDias(datas.at(-1)!, 2)),
  );
  const nomeConta = (id: string) => ativas.get(id)?.nome ?? "";
  const transferencias = paresDeTransferencia(
    vizinhas
      .filter((t) => ativas.has(t.conta_externa_id))
      .map((t) => ({ id: t.id, conta_id: t.conta_externa_id, data: t.data, valor: t.valor, descricao: t.descricao })),
    nomeConta,
  );
  const porId = new Map(vizinhas.map((t) => [t.id, t]));
  const categoriasValidas = new Set(categorias.filter((c) => c.ativa).map((c) => c.id));

  const usados = new Set<string>();
  const linhas = lista.map((externa, indice): LinhaCaixa => {
    const conta = ativas.get(externa.conta_externa_id);
    const t: TransacaoExtrato = {
      indice,
      data: externa.data,
      hora: "",
      tipo: externa.categoria_pluggy ?? "",
      descricao: externa.descricao,
      valor: externa.valor,
    };
    const racha =
      casa.racha_ativo && casa.racha_membro_id && conta?.dono_membro_id === casa.racha_membro_id
        ? { mensalidade: casa.racha_mensalidade, diaria: casa.racha_diaria }
        : null;
    const padrao = padraoDe(t);
    let s = sugerir(t, { regras, pendentes: pendentes.filter((p) => !usados.has(p.id)), racha });
    if (s.motivo !== "regra aprendida") {
      // Regras do casal (tela Regras): ignorar, categoria e nova descrição.
      const r = aplicarRegras(regrasCasal, { descricao: t.descricao, valor: t.valor }, categoriasValidas);
      const par = transferencias.pares.get(externa.id);
      if (r?.ignorar) s = { ...s, acao: "ignorar", vinculo_id: null, motivo: `regra: ${r.regras[0]}` };
      else if (par && s.motivo !== "pagamento de fatura") {
        const outra = porId.get(par);
        s = {
          ...s,
          acao: "ignorar",
          vinculo_id: null,
          motivo: `transferência entre contas de vocês (${outra ? nomeConta(outra.conta_externa_id) : "outra conta"})`,
        };
      } else if (r) {
        if (s.acao === "novo" && r.categoria_id) s = { ...s, categoria_id: r.categoria_id, motivo: `regra: ${r.regras[0]}` };
        else if (s.acao === "novo") s = { ...s, motivo: `regra: ${r.regras[0]}` };
      } else if (transferencias.ambiguos.has(externa.id) && !s.motivo) {
        s = { ...s, motivo: "talvez transferência entre contas de vocês" };
      }
      if (r?.descricao) t.descricao = r.descricao;
    }
    if (s.vinculo_id) usados.add(s.vinculo_id);
    // Sem regra aprendida: pacote de lojas conhecidas e, por fim, a categoria da Pluggy.
    const categoria =
      s.categoria_id ??
      (s.acao === "novo"
        ? ((t.valor < 0 ? categoriaDoPacote(t.descricao, categorias) : null) ??
          categoriaDaPluggy(externa.categoria_pluggy, t.valor >= 0 ? "entrada" : "saida", categorias))
        : null);
    const donoPadrao = conta?.dono_membro_id ?? "";
    return {
      t,
      hash: hashPluggy(externa.pluggy_id),
      jaImportada: false,
      acao: s.acao,
      categoria_id: categoria ?? "",
      dono: s.dono_membro_id === undefined ? donoPadrao : (s.dono_membro_id ?? ""),
      racha_tipo: s.racha_tipo ?? ((t.valor < 0 ? "juiz" : "mensalidade") as RachaTipo),
      vinculo_id: s.vinculo_id ?? "",
      motivo: s.motivo,
      padrao,
      externa,
      conta,
    };
  });
  return { linhas, pendentes };
}

/** Linha da caixa -> formato aceito por confirmar_caixa_entrada / confirmar_importacao. */
export function paraConfirmacao(l: LinhaPrevia) {
  return {
    hash: l.hash,
    data: l.t.data,
    descricao: l.t.descricao,
    valor: l.t.valor,
    acao: l.acao,
    categoria_id: l.acao === "novo" ? l.categoria_id : "",
    dono_membro_id: l.acao === "novo" ? l.dono : "",
    racha_tipo: l.acao === "racha" ? l.racha_tipo : "",
    vinculo_id: l.acao === "vincular" ? l.vinculo_id : null,
    padrao: l.padrao,
    aprender: l.acao === "racha" || l.acao === "ignorar" || (l.acao === "novo" && !!l.categoria_id),
    com_reserva: (l.acao === "novo" || l.acao === "vincular") && l.t.valor < 0 && !!l.com_reserva,
  };
}

export async function confirmarCaixa(casa: Casa, membro: Membro, linhas: Record<string, unknown>[], automatica = false) {
  return checar(
    await supabase().rpc("confirmar_caixa_entrada", { p_casa: casa.id, p_membro: membro.id, p_linhas: linhas, p_automatica: automatica }),
  ) as Record<string, number>;
}

/** Confirma sozinhas as transações que batem com uma regra aprendida. Devolve quantas. */
export async function aplicarRegrasAutomaticas(casa: Casa, membro: Membro, categorias: Categoria[]): Promise<number> {
  const { linhas } = await carregarCaixa(casa, categorias);
  const porRegra = linhas.filter((l) => (l.motivo === "regra aprendida" || l.motivo.startsWith("regra: ")) && (l.acao !== "vincular" || l.vinculo_id));
  if (!porRegra.length) return 0;
  await confirmarCaixa(casa, membro, porRegra.map(paraConfirmacao), true);
  return porRegra.length;
}

export async function desfazerConfirmacao(externaId: string) {
  checar(await supabase().rpc("desfazer_confirmacao", { p_externa: externaId }));
}
