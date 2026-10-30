"use client";

// Caixa de entrada do Open Finance: transações de conta corrente "a revisar".
// Reaproveita as sugestões e a confirmação da importação por arquivo.
import type { LinhaPrevia } from "@/components/importar/previa";
import { somarDias } from "./datas";
import { buscarTodos, checar } from "./db";
import type { TransacaoExtrato } from "./importacao/extrato";
import { padraoDe, sugerir, type RegraAprendida } from "./importacao/sugestao";
import { supabase } from "./supabase";
import type { Casa, Membro, Ocorrencia, RachaTipo } from "./tipos";

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
export async function carregarCaixa(casa: Casa): Promise<{ linhas: LinhaCaixa[]; pendentes: Ocorrencia[] }> {
  const [externas, contas, regras] = await Promise.all([
    buscarTodos<TransacaoExterna>("transacoes_externas", casa.id, (q) => q.eq("situacao", "pendente"), "data"),
    buscarTodos<ContaExterna>("contas_externas", casa.id),
    buscarTodos<RegraAprendida>("regras_importacao", casa.id),
  ]);
  const ativas = new Map(contas.filter((c) => c.ativa && c.tipo === "BANK").map((c) => [c.id, c]));
  const lista = externas.filter((t) => ativas.has(t.conta_externa_id)).sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : 0));
  if (!lista.length) return { linhas: [], pendentes: [] };

  const datas = lista.map((t) => t.data).sort();
  const pendentes = await buscarTodos<Ocorrencia>("ocorrencias", casa.id, (q) =>
    q.eq("status", "pendente").gte("vencimento", somarDias(datas[0], -10)).lte("vencimento", somarDias(datas.at(-1)!, 10)),
  );

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
    const s = sugerir(t, { regras, pendentes: pendentes.filter((p) => !usados.has(p.id)), racha });
    if (s.vinculo_id) usados.add(s.vinculo_id);
    const donoPadrao = conta?.dono_membro_id ?? "";
    return {
      t,
      hash: hashPluggy(externa.pluggy_id),
      jaImportada: false,
      acao: s.acao,
      categoria_id: s.categoria_id ?? "",
      dono: s.dono_membro_id === undefined ? donoPadrao : (s.dono_membro_id ?? ""),
      racha_tipo: s.racha_tipo ?? ((t.valor < 0 ? "juiz" : "mensalidade") as RachaTipo),
      vinculo_id: s.vinculo_id ?? "",
      motivo: s.motivo,
      padrao: padraoDe(t),
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
  };
}

export async function confirmarCaixa(casa: Casa, membro: Membro, linhas: Record<string, unknown>[], automatica = false) {
  return checar(
    await supabase().rpc("confirmar_caixa_entrada", { p_casa: casa.id, p_membro: membro.id, p_linhas: linhas, p_automatica: automatica }),
  ) as Record<string, number>;
}

/** Confirma sozinhas as transações que batem com uma regra aprendida. Devolve quantas. */
export async function aplicarRegrasAutomaticas(casa: Casa, membro: Membro): Promise<number> {
  const { linhas } = await carregarCaixa(casa);
  const porRegra = linhas.filter((l) => l.motivo === "regra aprendida" && (l.acao !== "vincular" || l.vinculo_id));
  if (!porRegra.length) return 0;
  await confirmarCaixa(casa, membro, porRegra.map(paraConfirmacao), true);
  return porRegra.length;
}

export async function desfazerConfirmacao(externaId: string) {
  checar(await supabase().rpc("desfazer_confirmacao", { p_externa: externaId }));
}
