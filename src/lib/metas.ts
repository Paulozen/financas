// Metas das reservas (ideia do Securo): progresso, quanto guardar por mês e situação.
import { difDias, difMeses, mesDe, somarDias, somarMeses } from "./datas";

export type SituacaoMeta = "concluida" | "adiantada" | "no_ritmo" | "atrasada" | "vencida" | "sem_data";

export const ROTULO_SITUACAO: Record<SituacaoMeta, string> = {
  concluida: "Concluída",
  adiantada: "Adiantada",
  no_ritmo: "No ritmo",
  atrasada: "Atrasada",
  vencida: "Prazo passou",
  sem_data: "Sem prazo",
};

export interface ResumoMeta {
  saldo: number;
  meta: number;
  /** 0..1 (pode passar de 1) */
  progresso: number;
  falta: number;
  situacao: SituacaoMeta;
  /** quanto guardar por mês até a data (null sem data ou já concluída) */
  porMes: number | null;
  /** média guardada por mês nos últimos ~90 dias (null sem histórico suficiente) */
  ritmo: number | null;
  /** mês (aaaa-mm) em que chega na meta no ritmo atual (null se não dá para estimar) */
  previsao: string | null;
}

/**
 * `historico`: saldos (data, valor) da reserva; `inicio`: quando a meta começou a valer
 * (primeiro ponto do histórico ou criação da reserva).
 */
export function resumoMeta({
  saldo,
  meta,
  data,
  inicio,
  historico,
  hoje,
}: {
  saldo: number;
  meta: number;
  data: string | null;
  inicio: string;
  historico: { data: string; valor: number }[];
  hoje: string;
}): ResumoMeta {
  const falta = Math.max(0, meta - saldo);
  const progresso = meta > 0 ? saldo / meta : 0;

  // Ritmo: variação entre o ponto mais antigo dos últimos 90 dias e hoje, por mês.
  const limite = somarDias(hoje, -90);
  const recentes = historico.filter((h) => h.data >= limite && h.data <= hoje).sort((a, b) => (a.data < b.data ? -1 : 1));
  let ritmo: number | null = null;
  if (recentes.length >= 2) {
    const dias = difDias(recentes[0].data, hoje);
    if (dias >= 14) ritmo = Math.round(((saldo - recentes[0].valor) / dias) * 30.4);
  }
  const previsao = falta === 0 ? mesDe(hoje) : ritmo && ritmo > 0 ? somarMeses(mesDe(hoje), Math.ceil(falta / ritmo)) : null;

  let situacao: SituacaoMeta;
  let porMes: number | null = null;
  if (falta === 0) situacao = "concluida";
  else if (!data) situacao = "sem_data";
  else if (data < hoje) situacao = "vencida";
  else {
    const meses = Math.max(1, difMeses(mesDe(hoje), mesDe(data)));
    porMes = Math.ceil(falta / meses);
    let razao: number;
    if (ritmo !== null) {
      // Com histórico: o ritmo dos últimos meses dá conta do que falta por mês?
      razao = ritmo / porMes;
    } else {
      // Sem histórico: caminho em linha reta do início até a data (onde deveria estar hoje).
      const total = Math.max(1, difDias(inicio, data));
      const decorrido = Math.min(total, Math.max(0, difDias(inicio, hoje)));
      const esperado = meta * (decorrido / total);
      razao = esperado > 0 ? saldo / esperado : 1;
    }
    situacao = razao >= 1.1 ? "adiantada" : razao >= 0.95 ? "no_ritmo" : "atrasada";
  }
  return { saldo, meta, progresso, falta, situacao, porMes, ritmo, previsao };
}
