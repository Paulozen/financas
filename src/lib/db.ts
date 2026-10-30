"use client";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/** Lança o erro do Supabase (se houver) e devolve os dados. */
export function checar<T>(resposta: { data: T; error: PostgrestError | null }): T {
  if (resposta.error) throw resposta.error;
  return resposta.data;
}

type Consulta = ReturnType<ReturnType<SupabaseClient["from"]>["select"]>;

/**
 * Busca todas as linhas de uma tabela da casa, paginando (o Supabase limita
 * a 1000 linhas por requisição).
 */
export async function buscarTodos<T>(
  tabela: string,
  casaId: string,
  filtrar?: (q: Consulta) => Consulta,
  ordem = "id",
): Promise<T[]> {
  const tamanho = 1000;
  const linhas: T[] = [];
  for (let de = 0; ; de += tamanho) {
    let q: Consulta = supabase().from(tabela).select("*").eq("casa_id", casaId);
    if (filtrar) q = filtrar(q);
    const dados = checar(await q.order(ordem).range(de, de + tamanho - 1)) as T[];
    linhas.push(...dados);
    if (dados.length < tamanho) break;
  }
  return linhas;
}
