// Do arquivo às transações: cabeçalho, mapeamento de colunas, perfis e hash.
import { lerData } from "../datas";
import { lerValor } from "../dinheiro";
import { detectarSeparador, lerCSV } from "./csv";
import { ehOFX, lerOFX } from "./ofx";
import { decodificar, semAcentos } from "./texto";
import { lerXLSX } from "./xlsx";

export interface Mapeamento {
  /** índice da linha de cabeçalho */
  cabecalho: number;
  data: number;
  hora?: number | null;
  /** coluna com o tipo do lançamento no extrato (ex.: "Pix recebido") */
  tipo?: number | null;
  /** colunas concatenadas para a descrição */
  descricao: number[];
  valor?: number | null;
  credito?: number | null;
  debito?: number | null;
  /** inverte o sinal do valor (extratos que mostram débitos positivos) */
  inverter?: boolean;
}

export interface Perfil {
  id: string;
  nome: string;
  assinatura: string;
  mapeamento: Mapeamento;
}

export interface TransacaoExtrato {
  /** posição no arquivo */
  indice: number;
  data: string;
  hora: string;
  /** tipo do lançamento no extrato */
  tipo: string;
  descricao: string;
  /** centavos, positivo = entrada */
  valor: number;
  fitid?: string;
}

export type Arquivo =
  | { formato: "ofx"; transacoes: TransacaoExtrato[] }
  | { formato: "tabela"; linhas: string[][] };

const PALAVRAS_DATA = /^(data|date|dt)\b/;
const PALAVRAS_OUTRAS = /(valor|descri|hist|lancamento|credito|debito|amount|origem|destino|tipo)/;

/** Primeira linha que parece cabeçalho (tem "data" e outra coluna conhecida). */
export function encontrarCabecalho(linhas: string[][]): number {
  for (let i = 0; i < Math.min(linhas.length, 30); i++) {
    const cels = linhas[i].map(semAcentos);
    if (cels.some((c) => PALAVRAS_DATA.test(c)) && cels.some((c) => PALAVRAS_OUTRAS.test(c))) return i;
  }
  return 0;
}

/** Assinatura do cabeçalho, para reconhecer o perfil nas próximas vezes. */
export function assinaturaCabecalho(cabecalho: string[]): string {
  return cabecalho.map(semAcentos).filter(Boolean).join("|");
}

export const PERFIL_PICPAY: Perfil = {
  id: "picpay",
  nome: "PicPay (data, hora, tipo, origem/destino, valor)",
  assinatura: "data|hora|tipo|origem / destino|valor|forma de pagamento",
  mapeamento: { cabecalho: 0, data: 0, hora: 1, tipo: 2, descricao: [2, 3], valor: 4 },
};

export const PERFIS_PRONTOS: Perfil[] = [PERFIL_PICPAY];

/** Sugestão de mapeamento a partir dos nomes das colunas. */
export function sugerirMapeamento(linhas: string[][], cabecalho: number): Mapeamento {
  const cab = (linhas[cabecalho] ?? []).map(semAcentos);
  const achar = (re: RegExp) => {
    const i = cab.findIndex((c) => re.test(c));
    return i >= 0 ? i : null;
  };
  const descricao = [achar(/descri|hist|origem|destino|memo|estabelecimento/)].filter((i): i is number => i !== null);
  return {
    cabecalho,
    data: achar(/^(data|date|dt)/) ?? 0,
    hora: achar(/^hora/),
    tipo: achar(/^tipo/),
    descricao: descricao.length ? descricao : [1],
    valor: achar(/^(valor|amount|quantia)/),
    credito: achar(/credito|entrada/),
    debito: achar(/debito|saida/),
  };
}

export async function lerArquivo(nome: string, dados: ArrayBuffer): Promise<Arquivo> {
  if (/\.xlsx$/i.test(nome)) return { formato: "tabela", linhas: await lerXLSX(dados) };
  const texto = decodificar(new Uint8Array(dados));
  if (/\.ofx$/i.test(nome) || ehOFX(texto)) {
    return {
      formato: "ofx",
      transacoes: lerOFX(texto).map((t, indice) => ({ indice, data: t.data, hora: "", tipo: t.tipo, descricao: t.descricao, valor: t.valor, fitid: t.fitid })),
    };
  }
  return { formato: "tabela", linhas: lerCSV(texto, detectarSeparador(texto)) };
}

/** Aplica o mapeamento às linhas de dados. Linhas sem data ou valor válidos são descartadas. */
export function aplicarMapeamento(linhas: string[][], m: Mapeamento): { transacoes: TransacaoExtrato[]; descartadas: number } {
  const transacoes: TransacaoExtrato[] = [];
  let descartadas = 0;
  linhas.slice(m.cabecalho + 1).forEach((l, i) => {
    const data = lerData(l[m.data] ?? "");
    let valor: number | null = null;
    if (m.valor !== null && m.valor !== undefined) valor = lerValor(l[m.valor] ?? "");
    else {
      const c = m.credito !== null && m.credito !== undefined ? lerValor(l[m.credito] ?? "") : null;
      const d = m.debito !== null && m.debito !== undefined ? lerValor(l[m.debito] ?? "") : null;
      if (c !== null || d !== null) valor = Math.abs(c ?? 0) - Math.abs(d ?? 0);
    }
    if (!data || valor === null) {
      descartadas++;
      return;
    }
    if (m.inverter) valor = -valor;
    const partes = m.descricao.map((c) => (l[c] ?? "").trim()).filter(Boolean);
    transacoes.push({
      indice: i,
      data,
      hora: m.hora !== null && m.hora !== undefined ? (l[m.hora] ?? "").trim() : "",
      tipo: m.tipo !== null && m.tipo !== undefined ? (l[m.tipo] ?? "").trim() : "",
      descricao: [...new Set(partes)].join(" · ") || "(sem descrição)",
      valor,
    });
  });
  return { transacoes, descartadas };
}

async function sha256(texto: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(texto));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash de deduplicação. OFX: FITID. Demais: (conta/perfil, data, hora, tipo,
 * descrição, valor); linhas idênticas no mesmo arquivo recebem um índice de
 * repetição (#2, #3...).
 */
export async function calcularHashes(conta: string, transacoes: TransacaoExtrato[]): Promise<string[]> {
  const vistos = new Map<string, number>();
  return Promise.all(
    transacoes.map((t) => {
      let base: string;
      if (t.fitid) base = `ofx|${conta}|${t.fitid}`;
      else base = [conta, t.data, t.hora, semAcentos(t.tipo), semAcentos(t.descricao), t.valor].join("|");
      const n = (vistos.get(base) ?? 0) + 1;
      vistos.set(base, n);
      return sha256(n > 1 ? `${base}#${n}` : base);
    }),
  );
}
