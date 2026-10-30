// Cartões de crédito vindos do Open Finance (funções puras).
// As compras NÃO viram ocorrências: a fatura é a ocorrência. Aqui calculamos
// parcelas em aberto e a previsão das faturas futuras.
import { somarMeses } from "../datas";
import { normalizarDescricao, semAcentos } from "../importacao/texto";

export interface CompraCartao {
  id?: string;
  descricao: string;
  /** positivo = compra; negativo = pagamento/estorno */
  valor: number;
  data: string;
  data_compra: string | null;
  parcela_num: number | null;
  parcelas_total: number | null;
  fatura_mes: string | null;
  categoria_pluggy?: string | null;
  categoria_id?: string | null;
}

/** Pagamento da fatura dentro do próprio cartão (não é gasto). */
export function ehPagamentoDeFatura(c: Pick<CompraCartao, "descricao" | "valor" | "categoria_pluggy">): boolean {
  return c.valor < 0 && /credit card payment|pagamento|pgto/.test(semAcentos(`${c.categoria_pluggy ?? ""} ${c.descricao}`));
}

export const ehParcelada = (c: Pick<CompraCartao, "parcelas_total">) => (c.parcelas_total ?? 1) > 1;

/** Descrição sem o "2/6", "PARC 02/06", "PARCELA 2 DE 6"... */
export function descricaoBase(d: string): string {
  return d
    .replace(/\b(parc(ela)?\.?\s*)?\d{1,2}\s*(\/|de)\s*\d{1,2}\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function chaveCompra(c: CompraCartao): string {
  return [normalizarDescricao(descricaoBase(c.descricao)), c.data_compra ?? "", c.parcelas_total, c.valor].join("|");
}

export interface ParcelaEmAberto {
  descricao: string;
  /** última parcela conhecida (já lançada em alguma fatura) */
  parcelaAtual: number;
  total: number;
  valorParcela: number;
  /** quanto ainda vai ser cobrado nas próximas faturas */
  falta: number;
  /** parcelas por mês de fatura daqui para a frente (conhecidas + calculadas) */
  proximas: { mes: string; numero: number; valor: number }[];
}

/**
 * Compras parceladas com parcelas ainda por vir, a partir do mês `aPartirDe`
 * (normalmente o primeiro mês sem fatura fechada). Junta as parcelas que o
 * banco já mostra (algumas instituições mandam as futuras) com as calculadas.
 */
export function parcelasEmAberto(compras: CompraCartao[], aPartirDe: string): ParcelaEmAberto[] {
  const grupos = new Map<string, CompraCartao[]>();
  for (const c of compras) {
    if (!ehParcelada(c) || c.valor <= 0 || !c.parcela_num || !c.fatura_mes) continue;
    const k = chaveCompra(c);
    grupos.set(k, [...(grupos.get(k) ?? []), c]);
  }
  const lista: ParcelaEmAberto[] = [];
  for (const g of grupos.values()) {
    const total = g[0].parcelas_total!;
    const valor = g[0].valor;
    const porNumero = new Map<number, string>();
    for (const c of g) porNumero.set(c.parcela_num!, c.fatura_mes!);
    // Parcela de referência: a de maior número conhecida; dela calculamos o mês das seguintes.
    const maior = Math.max(...porNumero.keys());
    const mesMaior = porNumero.get(maior)!;
    for (let n = maior + 1; n <= total; n++) porNumero.set(n, somarMeses(mesMaior, n - maior));
    const proximas = [...porNumero.entries()]
      .filter(([, mes]) => mes >= aPartirDe)
      .map(([numero, mes]) => ({ mes, numero, valor }))
      .sort((a, b) => a.numero - b.numero);
    if (!proximas.length) continue;
    lista.push({
      descricao: descricaoBase(g[0].descricao),
      parcelaAtual: proximas[0].numero - 1,
      total,
      valorParcela: valor,
      falta: proximas.length * valor,
      proximas,
    });
  }
  return lista.sort((a, b) => b.falta - a.falta);
}

/** Total das parcelas por mês de fatura (o "comprometido"). */
export function comprometidoPorMes(parcelas: ParcelaEmAberto[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of parcelas) for (const x of p.proximas) m.set(x.mes, (m.get(x.mes) ?? 0) + x.valor);
  return new Map([...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)));
}

/** Média das compras à vista (não parceladas) por fatura, nos últimos `n` meses fechados. */
export function mediaAVista(compras: CompraCartao[], mesesFechados: string[], n = 3): number {
  const ultimos = [...mesesFechados].sort().slice(-n);
  if (!ultimos.length) return 0;
  const soma = compras
    .filter((c) => !ehParcelada(c) && c.fatura_mes && ultimos.includes(c.fatura_mes) && !ehPagamentoDeFatura(c))
    .reduce((s, c) => s + c.valor, 0);
  return Math.max(0, Math.round(soma / ultimos.length));
}

/**
 * Previsão das faturas sem fatura fechada: parcelas já conhecidas daquele mês
 * + média das compras à vista dos últimos 3 meses fechados.
 */
export function previsaoFaturas(compras: CompraCartao[], mesesFechados: string[], meses: string[]): Map<string, number> {
  const aPartirDe = [...meses].sort()[0];
  const comprometido = comprometidoPorMes(parcelasEmAberto(compras, aPartirDe));
  const media = mediaAVista(compras, mesesFechados);
  return new Map(meses.map((m) => [m, (comprometido.get(m) ?? 0) + media]));
}

/** Gastos do cartão numa fatura, por categoria do app (pagamentos da fatura fora). */
export function gastosDaFatura(compras: CompraCartao[], mes: string): { categoria_id: string | null; total: number }[] {
  const mapa = new Map<string | null, number>();
  for (const c of compras) {
    if (c.fatura_mes !== mes || ehPagamentoDeFatura(c)) continue;
    mapa.set(c.categoria_id ?? null, (mapa.get(c.categoria_id ?? null) ?? 0) + c.valor);
  }
  return [...mapa.entries()]
    .map(([categoria_id, total]) => ({ categoria_id, total }))
    .filter((g) => g.total > 0)
    .sort((a, b) => b.total - a.total);
}
