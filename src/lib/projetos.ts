// Cálculos de projetos (funções puras).
import { dataNoMes, mesDe, somarMeses } from "./datas";
import type { Ocorrencia, ProjetoItem } from "./tipos";

export const TIPOS_ITEM = [
  "buffet",
  "local",
  "fotografia",
  "vídeo",
  "decoração",
  "música",
  "vestido",
  "traje",
  "convites",
  "cerimonial",
  "outros",
];

/** Divide um total em N parcelas mensais iguais; a última absorve o arredondamento. */
export function dividirParcelas(total: number, n: number, primeira: string): { data: string; valor: number }[] {
  if (n < 1 || total <= 0) return [];
  const base = Math.floor(total / n);
  const dia = Number(primeira.slice(8, 10));
  return Array.from({ length: n }, (_, i) => ({
    data: i === 0 ? primeira : dataNoMes(somarMeses(mesDe(primeira), i), dia),
    valor: i === n - 1 ? total - base * (n - 1) : base,
  }));
}

export interface ResumoProjeto {
  orcado: number;
  contratado: number;
  /** pago antes de usar o app (não gera ocorrência) */
  pagoAntes: number;
  /** parcelas pagas no app */
  pagoParcelas: number;
  /** pagoAntes + pagoParcelas */
  pago: number;
  /** contratado − pago (nunca negativo) */
  faltaPagar: number;
  /** soma das parcelas não canceladas (valor real se paga, senão o previsto) */
  parcelado: number;
  /** contratado − pago antes − parcelado (negativo = parcelas passam do contratado) */
  faltaParcelar: number;
}

export function resumoProjeto(itens: ProjetoItem[], parcelas: Ocorrencia[]): ResumoProjeto {
  const ids = new Set(itens.map((i) => i.id));
  const doProjeto = parcelas.filter((p) => p.origem_id && ids.has(p.origem_id) && p.status !== "cancelado");
  const orcado = itens.reduce((s, i) => s + i.valor_orcado, 0);
  const contratado = itens.reduce((s, i) => s + i.valor_contratado, 0);
  const pagoAntes = itens.reduce((s, i) => s + (i.valor_pago_antes ?? 0), 0);
  const pagoParcelas = doProjeto.filter((p) => p.status === "pago").reduce((s, p) => s + (p.valor_real ?? 0), 0);
  const parcelado = doProjeto.reduce((s, p) => s + (p.status === "pago" ? (p.valor_real ?? 0) : p.valor_previsto), 0);
  const pago = pagoAntes + pagoParcelas;
  return {
    orcado,
    contratado,
    pagoAntes,
    pagoParcelas,
    pago,
    faltaPagar: Math.max(0, contratado - pago),
    parcelado,
    faltaParcelar: contratado - pagoAntes - parcelado,
  };
}
