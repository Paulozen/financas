// Datas de negócio como texto ISO "aaaa-mm-dd" para evitar problemas de fuso.
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export const FUSO = "America/Fortaleza";

/** Data de hoje (aaaa-mm-dd) no fuso de Fortaleza. */
export function hojeISO(agora: Date = new Date()): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: FUSO,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(agora);
  return partes; // en-CA já é aaaa-mm-dd
}

export function diasNoMes(ano: number, mes: number): number {
  return new Date(Date.UTC(ano, mes, 0)).getUTCDate();
}

/** "aaaa-mm" do mês de uma data ISO. */
export function mesDe(dataISO: string): string {
  return dataISO.slice(0, 7);
}

/** Soma n meses a um mês "aaaa-mm". */
export function somarMeses(mes: string, n: number): string {
  const [a, m] = mes.split("-").map(Number);
  const total = a * 12 + (m - 1) + n;
  const ano = Math.floor(total / 12);
  const mm = (total % 12) + 1;
  return `${ano}-${String(mm).padStart(2, "0")}`;
}

/** Diferença em meses entre dois meses "aaaa-mm" (b - a). */
export function difMeses(a: string, b: string): number {
  const [aa, am] = a.split("-").map(Number);
  const [ba, bm] = b.split("-").map(Number);
  return (ba - aa) * 12 + (bm - am);
}

/** Data do dia `dia` no mês "aaaa-mm", limitada ao último dia do mês. */
export function dataNoMes(mes: string, dia: number): string {
  const [a, m] = mes.split("-").map(Number);
  const d = Math.min(dia, diasNoMes(a, m));
  return `${mes}-${String(d).padStart(2, "0")}`;
}

export function somarDias(dataISO: string, n: number): string {
  const d = new Date(`${dataISO}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function difDias(a: string, b: string): number {
  const da = Date.parse(`${a}T12:00:00Z`);
  const db = Date.parse(`${b}T12:00:00Z`);
  return Math.round((db - da) / 86400000);
}

export function primeiroDia(mes: string): string {
  return `${mes}-01`;
}

export function ultimoDia(mes: string): string {
  const [a, m] = mes.split("-").map(Number);
  return `${mes}-${String(diasNoMes(a, m)).padStart(2, "0")}`;
}

/** "aaaa-mm-dd" -> "dd/mm/aaaa" */
export function formatarData(dataISO: string | null | undefined): string {
  if (!dataISO) return "";
  const [a, m, d] = dataISO.slice(0, 10).split("-");
  return `${d}/${m}/${a}`;
}

/** "aaaa-mm-dd" -> "dd/mm" */
export function formatarDiaMes(dataISO: string): string {
  const [, m, d] = dataISO.slice(0, 10).split("-");
  return `${d}/${m}`;
}

/** "aaaa-mm" -> "outubro de 2026" */
export function nomeMes(mes: string): string {
  return format(parseISO(`${mes}-01`), "MMMM 'de' yyyy", { locale: ptBR });
}

/** "aaaa-mm" -> "out/26" */
export function nomeMesCurto(mes: string): string {
  return format(parseISO(`${mes}-01`), "MMM/yy", { locale: ptBR });
}

/** Lê "dd/mm/aaaa", "dd/mm/aa", "aaaa-mm-dd" ou "dd-mm-aaaa" e devolve ISO. */
export function lerData(texto: string): string | null {
  const s = texto.trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return validar(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (m) {
    let ano = +m[3];
    if (ano < 100) ano += 2000;
    return validar(ano, +m[2], +m[1]);
  }
  m = s.match(/^(\d{4})(\d{2})(\d{2})/); // OFX: 20261029...
  if (m) return validar(+m[1], +m[2], +m[3]);
  return null;
}

function validar(a: number, m: number, d: number): string | null {
  if (m < 1 || m > 12 || d < 1 || d > diasNoMes(a, m)) return null;
  return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
