"use client";

import { hojeISO } from "./datas";
import { checar } from "./db";
import { supabase } from "./supabase";
import type { Categoria } from "./tipos";

/** Cria um cartão e a despesa variável "Fatura <nome>" que gera uma ocorrência por mês. */
export async function criarCartao(
  casaId: string,
  categorias: Categoria[],
  d: { nome: string; dono_membro_id: string | null; dia_vencimento: number; dia_fechamento?: number | null },
): Promise<string> {
  const sb = supabase();
  const novo = checar(
    await sb
      .from("cartoes")
      .insert({ casa_id: casaId, nome: d.nome, dono_membro_id: d.dono_membro_id, dia_vencimento: d.dia_vencimento, dia_fechamento: d.dia_fechamento ?? null })
      .select("id")
      .single(),
  ) as { id: string };
  checar(
    await sb.from("recorrencias").insert({
      casa_id: casaId,
      descricao: `Fatura ${d.nome}`,
      dono_membro_id: d.dono_membro_id,
      dia: d.dia_vencimento,
      tipo: "saida",
      modo: "variavel",
      valor: 0,
      valor_manual: false,
      inicio: `${hojeISO().slice(0, 7)}-01`,
      categoria_id: categorias.find((c) => c.tipo === "saida" && c.nome === "Cartão")?.id ?? null,
      cartao_id: novo.id,
    }),
  );
  return novo.id;
}
