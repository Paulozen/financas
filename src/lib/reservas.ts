// Evolução das reservas (função pura).
import type { Reserva, ReservaSaldo } from "./tipos";

/** Saldo mais recente de cada reserva. */
export function saldoAtual(reservaId: string, saldos: ReservaSaldo[]): ReservaSaldo | null {
  let ultimo: ReservaSaldo | null = null;
  for (const s of saldos) {
    if (s.reserva_id !== reservaId) continue;
    if (!ultimo || s.data > ultimo.data) ultimo = s;
  }
  return ultimo;
}

export function totalGuardado(reservas: Reserva[], saldos: ReservaSaldo[]): number {
  return reservas.filter((r) => r.ativa).reduce((s, r) => s + (saldoAtual(r.id, saldos)?.valor ?? 0), 0);
}

/**
 * Série temporal: uma linha por data com o saldo de cada reserva (repete o
 * último valor conhecido) e o total.
 */
export function serieReservas(reservas: Reserva[], saldos: ReservaSaldo[]): Record<string, number | string>[] {
  const ids = new Set(reservas.map((r) => r.id));
  const doGrafico = saldos.filter((s) => ids.has(s.reserva_id)).sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  const datas = [...new Set(doGrafico.map((s) => s.data))];
  const atual: Record<string, number> = {};
  return datas.map((data) => {
    for (const s of doGrafico) if (s.data === data) atual[s.reserva_id] = s.valor;
    const linha: Record<string, number | string> = { data };
    let total = 0;
    for (const r of reservas) {
      if (atual[r.id] !== undefined) {
        linha[r.id] = atual[r.id];
        total += atual[r.id];
      }
    }
    linha.total = total;
    return linha;
  });
}
