"use client";

import { supabase } from "./supabase";

export interface ResumoSincronizacao {
  itens: number;
  contas: number;
  novas: number;
  jaImportadas: number;
  cartao: number;
  erros: string[];
}

const INTERVALO_AUTOMATICO = 6 * 3600 * 1000;
const CHAVE_TENTATIVA = "open-finance:ultima-tentativa";

/** Chama a rota do servidor que busca os dados na Pluggy. */
export async function sincronizarBancos(): Promise<ResumoSincronizacao> {
  let r: Response;
  try {
    r = await fetch("/api/pluggy/sincronizar", { method: "POST" });
  } catch {
    throw new Error("Sem conexão com o servidor para sincronizar.");
  }
  const corpo = await r.json().catch(() => null);
  if (!r.ok) throw new Error(corpo?.erro ?? `Falha ao sincronizar (erro ${r.status}).`);
  localStorage.setItem(CHAVE_TENTATIVA, String(Date.now()));
  return corpo as ResumoSincronizacao;
}

/** Ao abrir o app: sincroniza se a última sincronização tiver mais de 6 horas. */
export async function precisaSincronizar(casaId: string): Promise<boolean> {
  const tentativa = Number(localStorage.getItem(CHAVE_TENTATIVA) ?? 0);
  if (Date.now() - tentativa < INTERVALO_AUTOMATICO) return false;
  const { data } = await supabase().from("pluggy_itens").select("ultima_sincronizacao").eq("casa_id", casaId);
  // Nunca sincronizou: tenta (se o servidor não tiver bancos configurados, a rota avisa e
  // a tentativa fica registrada para não repetir a cada abertura).
  if (!data?.length) return true;
  const mais = Math.max(...data.map((d) => (d.ultima_sincronizacao ? Date.parse(d.ultima_sincronizacao) : 0)));
  return Date.now() - mais > INTERVALO_AUTOMATICO;
}

export function registrarTentativa() {
  localStorage.setItem(CHAVE_TENTATIVA, String(Date.now()));
}
