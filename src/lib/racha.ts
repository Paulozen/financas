// Caixa do racha (dinheiro de terceiros; fora das finanças do casal).
import { mesDe } from "./datas";
import type { RachaMovimento } from "./tipos";

export function saldoRacha(movs: RachaMovimento[]): number {
  return movs.reduce((s, m) => s + (m.sentido === "entrada" ? m.valor : -m.valor), 0);
}

export function resumoMesRacha(movs: RachaMovimento[], mes: string) {
  const doMes = movs.filter((m) => mesDe(m.data) === mes);
  return {
    entrou: doMes.filter((m) => m.sentido === "entrada").reduce((s, m) => s + m.valor, 0),
    saiu: doMes.filter((m) => m.sentido === "saida").reduce((s, m) => s + m.valor, 0),
  };
}

export const ROTULO_RACHA = {
  mensalidade: "Mensalidade",
  diaria: "Diária",
  amistoso: "Amistoso",
  juiz: "Juiz",
  outro: "Outro",
} as const;
