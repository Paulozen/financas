"use client";

// Ações do usuário sobre as reservas automáticas (grupos de investimentos do Open Finance).
import { hojeISO } from "./datas";
import { checar } from "./db";
import { saldoPorReserva, type InvestimentoGrupo } from "./pluggy/grupos";
import { supabase } from "./supabase";
import type { Reserva } from "./tipos";

/** Grava o saldo do dia das reservas indicadas a partir das aplicações vinculadas. */
async function gravarSaldosDoDia(casaId: string, reservaIds: string[], investimentos: InvestimentoGrupo[]) {
  const sb = supabase();
  const hoje = hojeISO();
  const saldos = saldoPorReserva(investimentos, hoje);
  for (const id of reservaIds) {
    const valor = saldos.get(id) ?? 0;
    const [doDia] = checar(await sb.from("reserva_saldos").select("id").eq("reserva_id", id).eq("data", hoje)) as { id: string }[];
    if (doDia) checar(await sb.from("reserva_saldos").update({ valor }).eq("id", doDia.id));
    else checar(await sb.from("reserva_saldos").insert({ casa_id: casaId, reserva_id: id, data: hoje, valor }));
  }
}

/** Move uma aplicação para outra reserva (fica marcada para a sincronização não devolver). */
export async function moverAplicacao(casaId: string, aplicacao: InvestimentoGrupo, destinoId: string, todas: InvestimentoGrupo[]) {
  const origem = aplicacao.reserva_id;
  checar(await supabase().from("investimentos_externos").update({ reserva_id: destinoId, reserva_manual: true }).eq("id", aplicacao.id));
  const atualizadas = todas.map((i) => (i.id === aplicacao.id ? { ...i, reserva_id: destinoId } : i));
  await gravarSaldosDoDia(casaId, [destinoId, ...(origem ? [origem] : [])], atualizadas);
}

/**
 * Liga uma reserva (nova ou manual) a um grupo automático: as aplicações e o
 * histórico do grupo passam para ela, que vira a reserva automática do grupo.
 * O grupo antigo é apagado, para o mesmo dinheiro não contar duas vezes.
 */
export async function assumirGrupo(reservaId: string, grupo: Reserva) {
  const sb = supabase();
  checar(await sb.from("investimentos_externos").update({ reserva_id: reservaId }).eq("reserva_id", grupo.id));
  checar(await sb.from("reserva_saldos").delete().eq("reserva_id", reservaId));
  checar(await sb.from("reserva_saldos").update({ reserva_id: reservaId }).eq("reserva_id", grupo.id));
  checar(await sb.from("reservas").update({ grupo_chave: null }).eq("id", grupo.id));
  checar(await sb.from("reservas").update({ automatica: true, grupo_chave: grupo.grupo_chave, banco: grupo.banco }).eq("id", reservaId));
  checar(await sb.from("reservas").delete().eq("id", grupo.id));
}
