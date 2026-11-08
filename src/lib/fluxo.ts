// Fluxo de caixa dia a dia (ideia do Securo): saldo em conta projetado a partir de hoje
// com as entradas e saídas pendentes na data de vencimento. Mostra o ponto mais baixo e o
// dia em que o saldo fica negativo, o que a projeção mensal esconde.
import { somarDias } from "./datas";
import { contaNaSobra, valorConta } from "./painel";
import type { Ocorrencia } from "./tipos";

export interface FluxoDiario {
  dias: { data: string; saldo: number; entradas: number; saidas: number }[];
  menor: { data: string; saldo: number };
  /** primeiro dia com saldo negativo (null se não fica) */
  negativoEm: string | null;
  inicial: number;
}

/**
 * `saldo`: saldo em conta conhecido e a data dele. Pagamentos registrados depois dessa
 * data ainda não estão no saldo e entram hoje; pendentes atrasados também entram hoje.
 */
export function fluxoDiario(ocorrencias: Ocorrencia[], saldo: { valor: number; data: string }, hoje: string, dias = 60): FluxoDiario {
  const sinal = (o: Ocorrencia, v: number) => (o.tipo === "entrada" ? v : -v);
  const ativas = ocorrencias.filter(contaNaSobra);
  let atual = saldo.valor;
  for (const o of ativas)
    if (o.status === "pago" && (o.pago_em ?? o.vencimento) > saldo.data && (o.pago_em ?? o.vencimento) <= hoje) atual += sinal(o, valorConta(o));
  const inicial = atual;
  const fim = somarDias(hoje, dias);
  const porDia = new Map<string, { entradas: number; saidas: number }>();
  for (const o of ativas) {
    if (o.status !== "pendente") continue;
    const d = o.vencimento < hoje ? hoje : o.vencimento;
    if (d > fim) continue;
    const e = porDia.get(d) ?? { entradas: 0, saidas: 0 };
    if (o.tipo === "entrada") e.entradas += o.valor_previsto;
    else e.saidas += o.valor_previsto;
    porDia.set(d, e);
  }
  const lista: FluxoDiario["dias"] = [];
  let menor = { data: hoje, saldo: atual };
  let negativoEm: string | null = null;
  for (let i = 0; i <= dias; i++) {
    const data = somarDias(hoje, i);
    const m = porDia.get(data) ?? { entradas: 0, saidas: 0 };
    atual += m.entradas - m.saidas;
    lista.push({ data, saldo: atual, ...m });
    if (atual < menor.saldo) menor = { data, saldo: atual };
    if (atual < 0 && !negativoEm) negativoEm = data;
  }
  return { dias: lista, menor, negativoEm, inicial };
}
