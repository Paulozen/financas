// Leitura de XLSX com exceljs (carregado só quando necessário).
import { lerCSV } from "./csv";

function celulaParaTexto(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (v instanceof Date) {
    // exceljs devolve datas em UTC.
    return v.toISOString().slice(0, 10);
  }
  if (typeof v === "number") return String(v);
  if (typeof v === "object") {
    const o = v as { text?: string; result?: unknown; richText?: { text: string }[] };
    if (o.richText) return o.richText.map((r) => r.text).join("");
    if (o.text !== undefined) return String(o.text);
    if (o.result !== undefined) return celulaParaTexto(o.result);
  }
  return String(v).trim();
}

/**
 * Lê a primeira aba com dados. Se a planilha tiver uma única coluna em que
 * cada célula é uma linha inteira de CSV (caso de alguns bancos), reprocessa
 * o texto como CSV.
 */
export async function lerXLSX(dados: ArrayBuffer): Promise<string[][]> {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(dados);
  for (const ws of wb.worksheets) {
    const linhas: string[][] = [];
    ws.eachRow({ includeEmpty: false }, (row) => {
      const valores = Array.isArray(row.values) ? row.values.slice(1) : [];
      linhas.push(valores.map(celulaParaTexto));
    });
    const comDados = linhas.filter((l) => l.some((c) => c !== ""));
    if (!comDados.length) continue;
    return reprocessarSeColunaUnica(comDados);
  }
  return [];
}

export function reprocessarSeColunaUnica(linhas: string[][]): string[][] {
  const colunaUnica = linhas.every((l) => l.filter((c) => c !== "").length <= 1);
  const pareceCSV = linhas.slice(0, 10).filter((l) => /[;,\t]/.test(l[0] ?? "")).length >= Math.min(3, linhas.length);
  if (colunaUnica && pareceCSV) {
    return lerCSV(linhas.map((l) => l.find((c) => c !== "") ?? "").join("\n"));
  }
  return linhas;
}
