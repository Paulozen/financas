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

/**
 * Evolução do total guardado: contas correntes (histórico diário) + reservas, repetindo
 * o último valor conhecido de cada uma.
 */
export function serieGuardado(
  reservas: Reserva[],
  saldos: ReservaSaldo[],
  contaSaldos: { conta_externa_id: string; data: string; valor: number }[],
  contas: string[],
): { data: string; contas: number; reservas: number; total: number }[] {
  const ids = new Set(reservas.map((r) => r.id));
  const daConta = new Set(contas);
  const pontos = [
    ...saldos.filter((s) => ids.has(s.reserva_id)).map((s) => ({ chave: `r:${s.reserva_id}`, data: s.data, valor: s.valor })),
    ...contaSaldos.filter((s) => daConta.has(s.conta_externa_id)).map((s) => ({ chave: `c:${s.conta_externa_id}`, data: s.data, valor: s.valor })),
  ].sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : 0));
  // Começa quando todas as fontes já têm histórico; antes disso, o total pularia
  // só porque uma fonte entrou no histórico (e não porque o dinheiro mudou).
  const primeira = new Map<string, string>();
  for (const p of pontos) if (!primeira.has(p.chave)) primeira.set(p.chave, p.data);
  const inicio = [...primeira.values()].sort().at(-1) ?? "";
  const atual = new Map<string, number>();
  for (const p of pontos) if (p.data < inicio) atual.set(p.chave, p.valor);
  const datas = [...new Set(pontos.map((p) => p.data))].filter((d) => d >= inicio);
  return datas.map((data) => {
    for (const p of pontos) if (p.data === data) atual.set(p.chave, p.valor);
    let c = 0;
    let r = 0;
    for (const [k, v] of atual) if (k.startsWith("c:")) c += v;
    else r += v;
    return { data, contas: c, reservas: r, total: c + r };
  });
}

export interface ContaGuardada {
  id: string;
  nome: string;
  tipo: string;
  ativa: boolean;
  saldo: number | null;
  dono_membro_id: string | null;
}

/**
 * Total guardado separado em "em conta" (saldo das contas correntes/poupanças
 * conectadas) e "reservas" (caixinhas, CDBs, ações e reservas manuais).
 * Na visão de um membro, só o que é dele; na visão Casal, tudo.
 */
export function resumoGuardado(reservas: (Reserva & { dono_membro_id: string | null })[], saldos: ReservaSaldo[], contas: ContaGuardada[], visao: string) {
  const daVisao = <T extends { dono_membro_id: string | null }>(l: T[]) => (visao === "casal" ? l : l.filter((x) => x.dono_membro_id === visao));
  const emConta = daVisao(contas.filter((c) => c.tipo === "BANK" && c.ativa && (c.saldo ?? 0) !== 0)).map((c) => ({
    id: c.id,
    nome: c.nome,
    dono_membro_id: c.dono_membro_id,
    valor: c.saldo ?? 0,
  }));
  const guardadas = daVisao(reservas.filter((r) => r.ativa)).map((r) => ({
    id: r.id,
    nome: r.nome,
    dono_membro_id: r.dono_membro_id,
    valor: saldoAtual(r.id, saldos)?.valor ?? 0,
  }));
  const totalConta = emConta.reduce((s, c) => s + c.valor, 0);
  const totalReservas = guardadas.reduce((s, r) => s + r.valor, 0);
  return { emConta, reservas: guardadas, totalConta, totalReservas, total: totalConta + totalReservas };
}
