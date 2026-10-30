"use client";

import { checar } from "./db";
import { supabase } from "./supabase";
import type { Ocorrencia } from "./tipos";

export interface DadosPagamento {
  valor: number;
  data: string;
  observacao: string;
  /** Parcelas de contrato e despesas variáveis: usar como estimativa das próximas. */
  usarComoEstimativa?: boolean;
  /** pago com dinheiro guardado: fora da sobra e da projeção */
  comReserva?: boolean;
}

/** Pode oferecer "usar este valor como estimativa das próximas"? */
export function aceitaEstimativa(o: Ocorrencia, modoRegra?: "fixa" | "variavel"): boolean {
  if (o.origem_tipo === "parcela_contrato" || o.origem_tipo === "fatura") return true;
  return o.origem_tipo === "recorrencia" && modoRegra === "variavel";
}

export async function pagar(o: Ocorrencia, d: DadosPagamento) {
  const sb = supabase();
  checar(
    await sb
      .from("ocorrencias")
      .update({ status: "pago", valor_real: d.valor, pago_em: d.data, observacao: d.observacao || null, paga_com_reserva: !!d.comReserva })
      .eq("id", o.id),
  );
  if (d.usarComoEstimativa && o.origem_id) {
    if (o.origem_tipo === "parcela_contrato") {
      checar(await sb.from("contratos").update({ valor_parcela: d.valor }).eq("id", o.origem_id));
    } else if (o.origem_tipo === "recorrencia" || o.origem_tipo === "fatura") {
      checar(await sb.from("recorrencias").update({ valor: d.valor, valor_manual: true }).eq("id", o.origem_id));
    }
  }
}

/** Desfaz um pagamento. Pagamentos avulsos de dívida são apagados. */
export async function desfazerPagamento(o: Ocorrencia) {
  const sb = supabase();
  if (o.origem_tipo === "pagamento_divida") {
    checar(await sb.from("ocorrencias").delete().eq("id", o.id));
    return;
  }
  checar(
    await sb
      .from("ocorrencias")
      .update({ status: "pendente", valor_real: null, pago_em: null, transacao_importada_id: null })
      .eq("id", o.id),
  );
}

export async function marcarComReserva(o: Ocorrencia, comReserva: boolean) {
  checar(await supabase().from("ocorrencias").update({ paga_com_reserva: comReserva }).eq("id", o.id));
}

export async function cancelarOcorrencia(o: Ocorrencia, cancelar: boolean) {
  checar(
    await supabase()
      .from("ocorrencias")
      .update({ status: cancelar ? "cancelado" : "pendente" })
      .eq("id", o.id),
  );
}

export async function ajustarPrevisto(o: Ocorrencia, valor: number) {
  checar(await supabase().from("ocorrencias").update({ valor_previsto: valor, previsto_manual: true }).eq("id", o.id));
}

export async function excluirOcorrencia(id: string) {
  checar(await supabase().from("ocorrencias").delete().eq("id", id));
}

/** Remove as ocorrências pendentes de hoje em diante de uma regra. */
export async function removerFuturasPendentes(origemId: string, hoje: string) {
  checar(
    await supabase()
      .from("ocorrencias")
      .delete()
      .eq("origem_id", origemId)
      .eq("status", "pendente")
      .gte("vencimento", hoje),
  );
}
