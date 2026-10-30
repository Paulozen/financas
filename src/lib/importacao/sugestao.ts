// Sugestão de ação para cada linha do extrato (função pura).
import { difDias } from "../datas";
import type { Ocorrencia, RachaTipo } from "../tipos";
import type { TransacaoExtrato } from "./extrato";
import { normalizarDescricao, semAcentos } from "./texto";

export type Acao = "novo" | "vincular" | "racha" | "ignorar";

export interface RegraAprendida {
  padrao: string;
  acao: Acao;
  categoria_id: string | null;
  dono_membro_id: string | null;
  racha_tipo: string | null;
}

export interface Sugestao {
  acao: Acao;
  categoria_id: string | null;
  /** undefined = usar o dono padrão do extrato */
  dono_membro_id?: string | null;
  racha_tipo: RachaTipo | null;
  vinculo_id: string | null;
  motivo: string;
}

/** Movimentos entre a conta e o cofrinho / rendimentos: sugerir "Ignorar". */
const INTERNOS = /(troco guardado|dinheiro guardado|dinheiro resgatado|rendimento|cofrinho|aplicacao|resgate)/;

export function ehMovimentoInterno(t: Pick<TransacaoExtrato, "tipo" | "descricao">): boolean {
  return INTERNOS.test(semAcentos(`${t.tipo} ${t.descricao}`));
}

/** Padrão usado pelas regras aprendidas. */
export function padraoDe(t: Pick<TransacaoExtrato, "descricao">): string {
  return normalizarDescricao(t.descricao);
}

/**
 * Pendentes candidatas a vínculo: mesmo sentido, valor próximo (até 10% ou
 * R$ 5) e vencimento até ±5 dias da data do extrato. Mais próximas primeiro.
 */
export function candidatas(t: TransacaoExtrato, pendentes: Ocorrencia[]): Ocorrencia[] {
  const tipo = t.valor >= 0 ? "entrada" : "saida";
  const valor = Math.abs(t.valor);
  return pendentes
    .filter((o) => {
      if (o.status !== "pendente" || o.tipo !== tipo) return false;
      const tolerancia = Math.max(500, Math.round(o.valor_previsto * 0.1));
      return Math.abs(o.valor_previsto - valor) <= tolerancia && Math.abs(difDias(o.vencimento, t.data)) <= 5;
    })
    .sort(
      (a, b) =>
        Math.abs(a.valor_previsto - valor) - Math.abs(b.valor_previsto - valor) ||
        Math.abs(difDias(a.vencimento, t.data)) - Math.abs(difDias(b.vencimento, t.data)),
    );
}

export interface ContextoSugestao {
  regras: RegraAprendida[];
  pendentes: Ocorrencia[];
  /** racha ativo e o extrato é de quem organiza */
  racha?: { mensalidade: number; diaria: number } | null;
}

export function sugerir(t: TransacaoExtrato, ctx: ContextoSugestao): Sugestao {
  const vazio = { categoria_id: null, racha_tipo: null, vinculo_id: null };
  const regra = ctx.regras.find((r) => r.padrao === padraoDe(t));
  if (regra && regra.acao !== "vincular") {
    return {
      ...vazio,
      acao: regra.acao,
      categoria_id: regra.categoria_id,
      dono_membro_id: regra.acao === "novo" ? regra.dono_membro_id : undefined,
      racha_tipo: (regra.racha_tipo as RachaTipo | null) ?? null,
      motivo: "regra aprendida",
    };
  }
  if (ehMovimentoInterno(t)) return { ...vazio, acao: "ignorar", motivo: "movimento interno (cofrinho/rendimento)" };
  const [melhor] = candidatas(t, ctx.pendentes);
  if (melhor) return { ...vazio, acao: "vincular", vinculo_id: melhor.id, categoria_id: melhor.categoria_id, motivo: "parece um lançamento previsto" };
  if (ctx.racha && t.valor > 0) {
    if (t.valor === ctx.racha.mensalidade) return { ...vazio, acao: "racha", racha_tipo: "mensalidade", motivo: "valor da mensalidade do racha" };
    if (t.valor === ctx.racha.diaria) return { ...vazio, acao: "racha", racha_tipo: "diaria", motivo: "valor da diária do racha" };
  }
  return { ...vazio, acao: "novo", motivo: "" };
}
