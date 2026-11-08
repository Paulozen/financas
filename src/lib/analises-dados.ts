"use client";

// Busca no banco o que o Painel e as Análises precisam para os gastos detalhados.
import type { ContaExterna } from "./caixa-entrada";
import { buscarTodos } from "./db";
import type { CompraCartao } from "./pluggy/cartao";
import { gastosDetalhados, gastosRealizadosPorDia, type CompraDoCartao } from "./analises";
import type { Ocorrencia } from "./tipos";

export interface BaseGastos {
  ocorrencias: Ocorrencia[];
  compras: (CompraCartao & { conta_externa_id: string })[];
  contasExternas: ContaExterna[];
  regrasCartao: { id: string; cartao_id: string | null }[];
}

export async function carregarBaseGastos(casaId: string): Promise<BaseGastos> {
  const [ocorrencias, compras, contasExternas, regrasCartao] = await Promise.all([
    buscarTodos<Ocorrencia>("ocorrencias", casaId, undefined, "vencimento"),
    buscarTodos<CompraCartao & { conta_externa_id: string }>("transacoes_externas", casaId, (q) => q.eq("situacao", "cartao"), "data"),
    buscarTodos<ContaExterna>("contas_externas", casaId),
    buscarTodos<{ id: string; cartao_id: string | null }>("recorrencias", casaId, (q) => q.not("cartao_id", "is", null)),
  ]);
  return { ocorrencias, compras, contasExternas, regrasCartao };
}

/** Ocorrências, gastos detalhados e gastos dia a dia da visão (membro ou casal). */
export function gastosDaVisao(base: BaseGastos, visao: string) {
  const ocorrencias = visao === "casal" ? base.ocorrencias : base.ocorrencias.filter((o) => o.dono_membro_id === visao);
  // Compras de cartões ligados, do dono conforme a visão.
  const contas = new Map(base.contasExternas.filter((c) => c.tipo === "CREDIT" && c.ativa && c.cartao_id).map((c) => [c.id, c]));
  const compras: CompraDoCartao[] = [];
  for (const c of base.compras) {
    const conta = contas.get(c.conta_externa_id);
    if (!conta || (visao !== "casal" && conta.dono_membro_id !== visao)) continue;
    compras.push({ ...c, cartao_id: conta.cartao_id! });
  }
  const cartaoDaRegra = new Map(base.regrasCartao.filter((r) => r.cartao_id).map((r) => [r.id, r.cartao_id!]));
  return {
    ocorrencias,
    compras,
    gastos: gastosDetalhados(ocorrencias, compras, cartaoDaRegra),
    porDia: gastosRealizadosPorDia(ocorrencias, compras, cartaoDaRegra),
  };
}
