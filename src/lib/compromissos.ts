// Resumos de parcelados e dívidas flexíveis (funções puras).
import { pagoDivida } from "./motor";
import type { Contrato, Divida, Ocorrencia } from "./tipos";

export interface ResumoContrato {
  pagas: number;
  restantes: number;
  totalPago: number;
  saldoDevedor: number;
  parcelas: Ocorrencia[];
}

export function resumoContrato(c: Contrato, ocorrencias: Ocorrencia[]): ResumoContrato {
  const parcelas = ocorrencias
    .filter((o) => o.origem_tipo === "parcela_contrato" && o.origem_id === c.id)
    .sort((a, b) => (a.parcela_num ?? 0) - (b.parcela_num ?? 0));
  const pagasApp = parcelas.filter((o) => o.status === "pago");
  const pagas = c.parcelas_pagas_antes + pagasApp.length;
  const totalPago = c.valor_pago_antes + pagasApp.reduce((s, o) => s + (o.valor_real ?? 0), 0);
  return {
    pagas,
    restantes: Math.max(0, c.num_parcelas - pagas),
    totalPago,
    saldoDevedor: Math.max(0, c.valor_total - totalPago),
    parcelas,
  };
}

export interface ResumoDivida {
  pago: number;
  restante: number;
  percentual: number;
  quitada: boolean;
  pagamentos: Ocorrencia[];
}

export function resumoDivida(d: Divida, ocorrencias: Ocorrencia[]): ResumoDivida {
  const daDivida = ocorrencias.filter((o) => o.origem_id === d.id);
  const pago = pagoDivida(d, daDivida);
  const restante = Math.max(0, d.valor_total - pago);
  return {
    pago,
    restante,
    percentual: d.valor_total > 0 ? Math.min(100, Math.round((pago / d.valor_total) * 100)) : 100,
    quitada: restante === 0,
    pagamentos: daDivida
      .filter((o) => o.status === "pago" && (o.valor_real ?? 0) > 0)
      .sort((a, b) => ((a.pago_em ?? "") < (b.pago_em ?? "") ? 1 : -1)),
  };
}
