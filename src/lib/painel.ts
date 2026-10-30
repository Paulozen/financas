// Cálculos do painel (funções puras). Leem só as ocorrências.
import { mesDe, primeiroDia, somarDias, somarMeses } from "./datas";
import type { Ocorrencia } from "./tipos";

/** Valor que conta: real se pago, senão o previsto. */
export function valorConta(o: Ocorrencia): number {
  return o.status === "pago" ? (o.valor_real ?? 0) : o.valor_previsto;
}

function comSinal(o: Ocorrencia, v = valorConta(o)): number {
  return o.tipo === "entrada" ? v : -v;
}

export interface Totais {
  entradas: number;
  saidas: number;
  saldo: number;
}

function totais(lista: Ocorrencia[]): Totais {
  const entradas = lista.filter((o) => o.tipo === "entrada").reduce((s, o) => s + valorConta(o), 0);
  const saidas = lista.filter((o) => o.tipo === "saida").reduce((s, o) => s + valorConta(o), 0);
  return { entradas, saidas, saldo: entradas - saidas };
}

/**
 * Sobra do mês. Previsto: todas as não canceladas do mês (real se pago, senão
 * previsto). Realizado: só as pagas.
 */
/** Conta na sobra e na projeção? Canceladas e pagas com dinheiro guardado ficam de fora. */
export const contaNaSobra = (o: Ocorrencia) => o.status !== "cancelado" && !o.paga_com_reserva;

export function sobraDoMes(ocorrencias: Ocorrencia[], mes: string): { previsto: Totais; realizado: Totais } {
  const doMes = ocorrencias.filter((o) => contaNaSobra(o) && mesDe(o.vencimento) === mes);
  return { previsto: totais(doMes), realizado: totais(doMes.filter((o) => o.status === "pago")) };
}

export interface MesProjecao {
  mes: string;
  sobra: number;
  /** saldo acumulado em conta, se o saldo de hoje foi informado */
  acumulado: number | null;
}

/**
 * Projeção da sobra dos próximos `meses` meses (a partir do mês atual).
 * Pendências atrasadas de meses anteriores contam no mês atual.
 * Se houver saldo em conta informado (valor + data), soma ao saldo o que ainda
 * não está refletido nele: pendentes e o que foi pago depois da data do saldo.
 */
export function projecao(
  ocorrencias: Ocorrencia[],
  hoje: string,
  saldoConta: { valor: number; data: string } | null,
  meses = 12,
): MesProjecao[] {
  const mesAtual = mesDe(hoje);
  const ativas = ocorrencias.filter(contaNaSobra);
  const atrasadasAntes = ativas.filter((o) => o.status === "pendente" && o.vencimento < primeiroDia(mesAtual));
  let acumulado = saldoConta?.valor ?? 0;
  const lista: MesProjecao[] = [];
  for (let i = 0; i < meses; i++) {
    const mes = somarMeses(mesAtual, i);
    let doMes = ativas.filter((o) => mesDe(o.vencimento) === mes);
    if (i === 0) doMes = doMes.concat(atrasadasAntes);
    const sobra = doMes.reduce((s, o) => s + comSinal(o), 0);
    if (saldoConta) {
      const naoRefletido = doMes.filter(
        (o) => o.status === "pendente" || (o.status === "pago" && (o.pago_em ?? o.vencimento) > saldoConta.data),
      );
      acumulado += naoRefletido.reduce((s, o) => s + comSinal(o), 0);
    }
    lista.push({ mes, sobra, acumulado: saldoConta ? acumulado : null });
  }
  return lista;
}

/** Atrasados (pendentes vencidos) e os que vencem nos próximos `dias` dias. */
export function vencimentos(ocorrencias: Ocorrencia[], hoje: string, dias = 15) {
  const limite = somarDias(hoje, dias);
  const pendentes = ocorrencias
    .filter((o) => o.status === "pendente")
    .sort((a, b) => (a.vencimento < b.vencimento ? -1 : a.vencimento > b.vencimento ? 1 : 0));
  return {
    atrasados: pendentes.filter((o) => o.vencimento < hoje),
    proximos: pendentes.filter((o) => o.vencimento >= hoje && o.vencimento <= limite),
  };
}

/** Saídas do mês por categoria (maior primeiro). */
export function gastosPorCategoria(ocorrencias: Ocorrencia[], mes: string): { categoria_id: string | null; total: number }[] {
  const mapa = new Map<string | null, number>();
  for (const o of ocorrencias) {
    if (o.tipo !== "saida" || o.status === "cancelado" || mesDe(o.vencimento) !== mes) continue;
    mapa.set(o.categoria_id, (mapa.get(o.categoria_id) ?? 0) + valorConta(o));
  }
  return [...mapa.entries()]
    .map(([categoria_id, total]) => ({ categoria_id, total }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
}

export interface ContaComSaldo {
  tipo: string;
  ativa: boolean;
  saldo: number | null;
  saldo_em: string | null;
  dono_membro_id: string | null;
}

/**
 * "Saldo em conta hoje" usado na projeção. Com contas correntes conectadas, é a
 * soma dos saldos delas (por dono, conforme a visão; na visão Casal, todas).
 * Sem contas conectadas, vale o saldo informado à mão nas Configurações.
 */
export function saldoEmConta(
  contas: ContaComSaldo[],
  visao: string,
  manual: { valor: number; data: string } | null,
): { valor: number; data: string; automatico: boolean } | null {
  const bancos = contas.filter((c) => c.tipo === "BANK" && c.ativa && c.saldo !== null && c.saldo_em);
  if (!bancos.length) return manual ? { ...manual, automatico: false } : null;
  const daVisao = visao === "casal" ? bancos : bancos.filter((c) => c.dono_membro_id === visao);
  const datas = bancos.map((c) => c.saldo_em!).sort();
  return {
    valor: daVisao.reduce((s, c) => s + (c.saldo ?? 0), 0),
    data: datas[0].slice(0, 10),
    automatico: true,
  };
}
