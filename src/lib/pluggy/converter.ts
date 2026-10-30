// Conversão das respostas da Pluggy para o formato do app (funções puras).
import { FUSO, mesDe } from "../datas";
import { normalizarDescricao } from "../importacao/texto";
import type { PluggyConta, PluggyFatura, PluggyTransacao } from "./tipos";

/** Reais (número) -> centavos. */
export const centavos = (v: number | null | undefined) => Math.round((v ?? 0) * 100);

/**
 * Data local (Fortaleza) de um timestamp da Pluggy. Meia-noite UTC é tratada como
 * "só data" (vários bancos mandam assim); outros horários são convertidos.
 */
export function dataLocal(iso: string): string {
  if (/T00:00:00(\.0+)?Z$/.test(iso) || iso.length === 10) return iso.slice(0, 10);
  return new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
}

export interface TransacaoExternaNova {
  pluggy_id: string;
  data: string;
  descricao: string;
  /** conta corrente: positivo = entrada; cartão: positivo = compra */
  valor: number;
  tipo_pluggy: string;
  status_pluggy: string | null;
  categoria_pluggy: string | null;
  parcela_num: number | null;
  parcelas_total: number | null;
  data_compra: string | null;
  bill_id: string | null;
  fatura_mes: string | null;
}

/**
 * Converte uma transação. Na conta corrente a Pluggy já usa o sinal do app
 * (débito negativo). No cartão a compra vem positiva e o pagamento negativo,
 * que é o que guardamos (o cartão só alimenta a fatura).
 */
export function converterTransacao(t: PluggyTransacao, tipoConta: PluggyConta["type"], faturas: PluggyFatura[] = []): TransacaoExternaNova {
  const cc = t.creditCardMetadata ?? null;
  const fatura = cc?.billId ? faturas.find((f) => f.id === cc.billId) : undefined;
  const data = dataLocal(t.date);
  return {
    pluggy_id: t.id,
    data,
    descricao: (t.description ?? "").trim() || "(sem descrição)",
    valor: centavos(t.amount),
    tipo_pluggy: t.type,
    status_pluggy: t.status ?? null,
    categoria_pluggy: t.category ?? null,
    parcela_num: cc?.installmentNumber ?? null,
    parcelas_total: cc?.totalInstallments ?? null,
    data_compra: cc?.purchaseDate ? dataLocal(cc.purchaseDate) : null,
    bill_id: cc?.billId ?? null,
    fatura_mes:
      tipoConta === "CREDIT"
        ? fatura
          ? mesDe(dataLocal(fatura.dueDate))
          : cc?.billForecastDate
            ? mesDe(dataLocal(cc.billForecastDate))
            : mesDe(data)
        : null,
  };
}

/**
 * Nome do banco de um item. No Meu Pluggy o conector se chama sempre "MeuPluggy";
 * aí usamos o nome da primeira conta corrente (ex.: "BANCO INTER 06-6" -> "Banco Inter").
 */
export function nomeBanco(conector: string | null | undefined, contas: Pick<PluggyConta, "type" | "name" | "marketingName">[]): string | null {
  if (conector && !/meu ?pluggy/i.test(conector)) return conector;
  const conta = contas.find((c) => c.type === "BANK") ?? contas[0];
  const nome = (conta?.name || conta?.marketingName || "").split(/\s[-(]|\s\d|\s(?:instituicao|instituição|s\.a)/i)[0].trim();
  if (!nome) return conector ?? null;
  return nome
    .toLowerCase()
    .replace(/(^|\s)\S/g, (l) => l.toUpperCase());
}

/** Nome de exibição da conta: o comercial se houver, senão o nome técnico. */
export function nomeConta(c: PluggyConta): string {
  const base = (c.marketingName || c.name || (c.type === "CREDIT" ? "Cartão" : "Conta")).trim();
  const final = c.number ? ` ${String(c.number).slice(-4)}` : "";
  return `${base}${final}`;
}

export interface ImportadaPorArquivo {
  id: string;
  data: string;
  valor: number;
  descricao: string;
}

function semelhanca(a: string, b: string): number {
  const ta = new Set(normalizarDescricao(a).split(" ").filter((p) => p.length > 2));
  const tb = new Set(normalizarDescricao(b).split(" ").filter((p) => p.length > 2));
  if (!ta.size || !tb.size) return 0;
  let comum = 0;
  for (const p of ta) if (tb.has(p)) comum++;
  return comum / Math.min(ta.size, tb.size);
}

type Comparavel = Pick<TransacaoExternaNova, "pluggy_id" | "data" | "valor" | "descricao">;

/**
 * Reconhece, numa conta, transações que já entraram por arquivo. Cada importada
 * casa com no máximo uma transação. Devolve pluggy_id -> id da importada.
 *
 * - Se a maior parte das transações da conta no período coberto pelos arquivos
 *   tem par com mesmo valor e data (±1 dia), é a mesma conta do arquivo: basta
 *   valor + data (a descrição só desempata), porque o texto do banco muda.
 * - Senão, só casa com o mesmo dia, mesmo valor e descrição parecida (evita
 *   confundir com outra conta que teve um valor igual no mesmo dia).
 */
export function acharJaImportadas(novas: Comparavel[], importadas: ImportadaPorArquivo[]) {
  const resultado = new Map<string, string>();
  if (!novas.length || !importadas.length) return resultado;
  const distancia = (a: string, b: string) => Math.abs(Date.parse(a) - Date.parse(b)) / 864e5;
  const porValor = new Map<number, ImportadaPorArquivo[]>();
  for (const i of importadas) porValor.set(i.valor, [...(porValor.get(i.valor) ?? []), i]);
  const temPar = (n: Comparavel) => (porValor.get(n.valor) ?? []).some((i) => distancia(i.data, n.data) <= 1);

  const datas = importadas.map((i) => i.data).sort();
  const noPeriodo = novas.filter((n) => distancia(n.data, datas[0]) <= 1 || (n.data >= datas[0] && n.data <= datas.at(-1)!) || distancia(n.data, datas.at(-1)!) <= 1);
  const mesmaConta = noPeriodo.length >= 5 && noPeriodo.filter(temPar).length / noPeriodo.length >= 0.5;

  const usadas = new Set<string>();
  for (const n of novas) {
    const candidatas = (porValor.get(n.valor) ?? [])
      .filter((i) => !usadas.has(i.id) && distancia(i.data, n.data) <= (mesmaConta ? 1 : 0))
      .map((i) => ({ i, s: semelhanca(i.descricao, n.descricao), d: distancia(i.data, n.data) }))
      .filter((x) => mesmaConta || x.s >= 0.5)
      .sort((a, b) => a.d - b.d || b.s - a.s);
    if (candidatas[0]) {
      usadas.add(candidatas[0].i.id);
      resultado.set(n.pluggy_id, candidatas[0].i.id);
    }
  }
  return resultado;
}

/** Lê PLUGGY_ITEMS_<NOME>=id1,id2 do ambiente: lista de { itemId, dono (nome) }. */
export function itensDoAmbiente(env: Record<string, string | undefined>): { itemId: string; dono: string }[] {
  const lista: { itemId: string; dono: string }[] = [];
  for (const [k, v] of Object.entries(env)) {
    if (!k.startsWith("PLUGGY_ITEMS_") || !v) continue;
    const dono = k.slice("PLUGGY_ITEMS_".length);
    for (const id of v.split(",").map((s) => s.trim()).filter(Boolean)) lista.push({ itemId: id, dono });
  }
  return lista;
}
