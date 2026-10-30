"use client";

import { buscarTodos, checar } from "./db";
import { planejar } from "./motor";
import { supabase } from "./supabase";
import type { Contrato, Divida, Ocorrencia, Recorrencia } from "./tipos";

const ORIGENS_DO_MOTOR = ["recorrencia", "fatura", "parcela_contrato", "meta_divida", "pagamento_divida"];

let emAndamento: Promise<void> | null = null;

/**
 * Garante as ocorrências até 12 meses à frente. Idempotente: pode ser chamada
 * ao abrir o app e depois de criar/editar regras. Chamadas simultâneas na
 * mesma aba são unificadas.
 */
export function garantirOcorrencias(casaId: string, hoje: string): Promise<void> {
  if (!emAndamento) {
    emAndamento = executar(casaId, hoje).finally(() => {
      emAndamento = null;
    });
  }
  return emAndamento;
}

async function executar(casaId: string, hoje: string) {
  const [recorrencias, contratos, dividas, ocorrencias] = await Promise.all([
    buscarTodos<Recorrencia>("recorrencias", casaId),
    buscarTodos<Contrato>("contratos", casaId),
    buscarTodos<Divida>("dividas", casaId),
    buscarTodos<Ocorrencia>("ocorrencias", casaId, (q) => q.in("origem_tipo", ORIGENS_DO_MOTOR)),
  ]);
  const plano = planejar({ hoje, recorrencias, contratos, dividas, ocorrencias });
  const sb = supabase();

  for (let i = 0; i < plano.inserir.length; i += 500) {
    checar(
      await sb
        .from("ocorrencias")
        .upsert(plano.inserir.slice(i, i + 500), { onConflict: "casa_id,chave", ignoreDuplicates: true }),
    );
  }
  for (let i = 0; i < plano.atualizar.length; i += 20) {
    await Promise.all(
      plano.atualizar.slice(i, i + 20).map(async ({ id, campos }) => checar(await sb.from("ocorrencias").update(campos).eq("id", id))),
    );
  }
  for (let i = 0; i < plano.remover.length; i += 200) {
    checar(await sb.from("ocorrencias").delete().in("id", plano.remover.slice(i, i + 200)));
  }
}
