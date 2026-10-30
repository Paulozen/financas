// Motor de ocorrências: função pura que compara o que as regras pedem com o que
// já existe no banco e devolve o que inserir, atualizar e remover.
//
// Regras:
// - Gera até 12 meses à frente do mês atual (idempotente pela coluna `chave`).
// - Só mexe em ocorrências PENDENTES com vencimento a partir de hoje; pagas e
//   canceladas nunca mudam. Pendentes atrasadas também ficam como estão.
// - Só gerencia ocorrências cujas regras foram passadas (regra excluída = órfãs
//   ficam intocadas; a tela de exclusão decide o que fazer com elas).
import { dataNoMes, mesDe, somarMeses } from "./datas";
import type { Contrato, Divida, Ocorrencia, OrigemTipo, Recorrencia, Status, Tipo } from "./tipos";

export const HORIZONTE_MESES = 12;
export const OBS_META_CUMPRIDA = "Meta cumprida com pagamentos avulsos";
export const OBS_META_NAO_CUMPRIDA = "Meta do mês não cumprida";

export interface NovaOcorrencia {
  casa_id: string;
  origem_tipo: OrigemTipo;
  origem_id: string;
  chave: string;
  descricao: string;
  tipo: Tipo;
  dono_membro_id: string | null;
  categoria_id: string | null;
  valor_previsto: number;
  vencimento: string;
  parcela_num: number | null;
  status: Status;
  valor_real: number | null;
  pago_em: string | null;
  observacao: string | null;
}

export interface EntradaMotor {
  hoje: string;
  recorrencias: Recorrencia[];
  contratos: Contrato[];
  dividas: Divida[];
  /** Ocorrências existentes ligadas a essas regras (de qualquer status). */
  ocorrencias: Ocorrencia[];
}

export interface PlanoMotor {
  inserir: NovaOcorrencia[];
  atualizar: { id: string; campos: Partial<Ocorrencia> }[];
  remover: string[];
}

/** Média (arredondada) dos últimos 3 valores reais pagos, ou null. */
export function mediaUltimos3(ocorrencias: Ocorrencia[]): number | null {
  const pagos = ocorrencias
    .filter((o) => o.status === "pago" && o.valor_real !== null)
    .sort((a, b) => (a.vencimento < b.vencimento ? 1 : a.vencimento > b.vencimento ? -1 : 0))
    .slice(0, 3);
  if (!pagos.length) return null;
  return Math.round(pagos.reduce((s, o) => s + (o.valor_real ?? 0), 0) / pagos.length);
}

/** Valor previsto para os próximos meses de uma regra. */
export function valorEstimado(regra: Recorrencia, daRegra: Ocorrencia[]): number {
  if (regra.modo === "fixa" || regra.valor_manual) return regra.valor;
  return mediaUltimos3(daRegra) ?? regra.valor;
}

function base(o: Partial<NovaOcorrencia> & Pick<NovaOcorrencia, "casa_id" | "origem_tipo" | "origem_id" | "chave" | "descricao" | "tipo" | "valor_previsto" | "vencimento">): NovaOcorrencia {
  return {
    dono_membro_id: null,
    categoria_id: null,
    parcela_num: null,
    status: "pendente",
    valor_real: null,
    pago_em: null,
    observacao: null,
    ...o,
  };
}

function desejadasRecorrencia(r: Recorrencia, existentes: Ocorrencia[], hoje: string): NovaOcorrencia[] {
  if (!r.ativa) return [];
  const mesFim = somarMeses(mesDe(hoje), HORIZONTE_MESES);
  // Não cria meses anteriores ao cadastro da regra (evita uma fila de "atrasados").
  const criado = mesDe(r.criado_em.slice(0, 10));
  let mes = mesDe(r.inicio) > criado ? mesDe(r.inicio) : criado;
  const valor = valorEstimado(r, existentes);
  const lista: NovaOcorrencia[] = [];
  for (; mes <= mesFim; mes = somarMeses(mes, 1)) {
    const venc = dataNoMes(mes, r.dia);
    if (venc < r.inicio) continue;
    if (r.fim && venc > r.fim) break;
    lista.push(
      base({
        casa_id: r.casa_id,
        origem_tipo: r.cartao_id ? "fatura" : "recorrencia",
        origem_id: r.id,
        chave: `rec:${r.id}:${mes}`,
        descricao: r.descricao,
        tipo: r.tipo,
        dono_membro_id: r.dono_membro_id,
        categoria_id: r.categoria_id,
        valor_previsto: valor,
        vencimento: venc,
      }),
    );
  }
  return lista;
}

function desejadasContrato(c: Contrato, hoje: string): NovaOcorrencia[] {
  const mesFim = somarMeses(mesDe(hoje), HORIZONTE_MESES);
  const lista: NovaOcorrencia[] = [];
  for (let k = c.parcelas_pagas_antes + 1; k <= c.num_parcelas; k++) {
    const mes = somarMeses(mesDe(c.primeira_parcela), k - 1);
    if (mes > mesFim) break;
    lista.push(
      base({
        casa_id: c.casa_id,
        origem_tipo: "parcela_contrato",
        origem_id: c.id,
        chave: `ctr:${c.id}:${k}`,
        descricao: `${c.nome} ${k}/${c.num_parcelas}`,
        tipo: "saida",
        dono_membro_id: c.dono_membro_id,
        categoria_id: c.categoria_id,
        valor_previsto: c.valor_parcela,
        vencimento: dataNoMes(mes, c.dia),
        parcela_num: k,
      }),
    );
  }
  return lista;
}

/** Total já pago de uma dívida (pagamentos avulsos + metas pagas diretamente). */
export function pagoDivida(d: Divida, ocorrencias: Ocorrencia[]): number {
  return ocorrencias
    .filter(
      (o) =>
        o.origem_id === d.id &&
        (o.origem_tipo === "pagamento_divida" || o.origem_tipo === "meta_divida") &&
        o.status === "pago",
    )
    .reduce((s, o) => s + (o.valor_real ?? 0), 0);
}

/**
 * Metas mensais de uma dívida. Pagamentos avulsos do mês abatem a meta; se
 * cobrirem a meta, ela fica "cumprida" (paga com valor 0) e não conta de novo.
 * Metas de meses passados não cumpridas são canceladas (tratadas no plano).
 */
function desejadasDivida(d: Divida, daDivida: Ocorrencia[], hoje: string): NovaOcorrencia[] {
  if (!d.meta_mensal) return [];
  const mesHoje = mesDe(hoje);
  const mesFim = somarMeses(mesHoje, HORIZONTE_MESES);
  let restante = d.valor_total - pagoDivida(d, daDivida);
  const dia = Number(d.inicio.slice(8, 10));
  const lista: NovaOcorrencia[] = [];
  const inicio = mesDe(d.inicio) > mesHoje ? mesDe(d.inicio) : mesHoje;
  // Os pagamentos do mês já foram descontados de "restante"; para saber a meta
  // do mês, somamos de volta.
  for (let mes = inicio; mes <= mesFim; mes = somarMeses(mes, 1)) {
    const doMes = daDivida.filter((o) => o.status === "pago" && mesDe(o.pago_em ?? o.vencimento) === mes);
    const avulsosMes = doMes
      .filter((o) => o.origem_tipo === "pagamento_divida")
      .reduce((s, o) => s + (o.valor_real ?? 0), 0);
    const metaPagaDireto = doMes.some((o) => o.origem_tipo === "meta_divida" && (o.valor_real ?? 0) > 0);
    const restanteInicioMes = restante + avulsosMes;
    if (restanteInicioMes <= 0) break;
    const meta = Math.min(d.meta_mensal, restanteInicioMes);
    const falta = Math.max(0, meta - avulsosMes);
    const chave = `meta:${d.id}:${mes}`;
    const comum = {
      casa_id: d.casa_id,
      origem_tipo: "meta_divida" as const,
      origem_id: d.id,
      chave,
      descricao: `Meta: ${d.descricao}`,
      tipo: "saida" as const,
      dono_membro_id: d.dono_membro_id,
      categoria_id: d.categoria_id,
      vencimento: dataNoMes(mes, dia),
    };
    if (metaPagaDireto) {
      // A própria meta foi paga; o motor não mexe nela.
      lista.push(base({ ...comum, valor_previsto: meta }));
    } else if (falta === 0) {
      lista.push(
        base({
          ...comum,
          valor_previsto: meta,
          status: "pago",
          valor_real: 0,
          pago_em: comum.vencimento,
          observacao: OBS_META_CUMPRIDA,
        }),
      );
    } else {
      lista.push(base({ ...comum, valor_previsto: falta }));
      restante -= falta;
    }
  }
  return lista;
}

const CAMPOS_COMPARADOS = ["descricao", "tipo", "dono_membro_id", "categoria_id", "vencimento", "parcela_num"] as const;

export function planejar(e: EntradaMotor): PlanoMotor {
  const { hoje } = e;
  const mesHoje = mesDe(hoje);
  const porOrigem = new Map<string, Ocorrencia[]>();
  for (const o of e.ocorrencias) {
    if (!o.origem_id) continue;
    const l = porOrigem.get(o.origem_id) ?? [];
    l.push(o);
    porOrigem.set(o.origem_id, l);
  }

  const desejadas: NovaOcorrencia[] = [];
  const gerenciadas = new Set<string>();
  for (const r of e.recorrencias) {
    gerenciadas.add(r.id);
    desejadas.push(...desejadasRecorrencia(r, porOrigem.get(r.id) ?? [], hoje));
  }
  for (const c of e.contratos) {
    gerenciadas.add(c.id);
    desejadas.push(...desejadasContrato(c, hoje));
  }
  for (const d of e.dividas) {
    gerenciadas.add(d.id);
    desejadas.push(...desejadasDivida(d, porOrigem.get(d.id) ?? [], hoje));
  }

  const existentes = new Map<string, Ocorrencia>();
  for (const o of e.ocorrencias) if (o.chave) existentes.set(o.chave, o);

  const plano: PlanoMotor = { inserir: [], atualizar: [], remover: [] };
  const chavesDesejadas = new Set<string>();

  for (const d of desejadas) {
    chavesDesejadas.add(d.chave);
    const atual = existentes.get(d.chave);
    if (!atual) {
      plano.inserir.push(d);
      continue;
    }
    const ehMeta = d.origem_tipo === "meta_divida";
    const metaAutomatica = ehMeta && atual.status === "pago" && atual.observacao === OBS_META_CUMPRIDA;

    if (metaAutomatica || (ehMeta && atual.status === "pendente" && d.status === "pago")) {
      // Metas: o motor controla o "cumprida automaticamente".
      if (d.status === "pago" && atual.status !== "pago") {
        plano.atualizar.push({
          id: atual.id,
          campos: { status: "pago", valor_real: 0, pago_em: d.pago_em, observacao: OBS_META_CUMPRIDA, valor_previsto: d.valor_previsto },
        });
      } else if (d.status === "pendente" && atual.status === "pago") {
        plano.atualizar.push({
          id: atual.id,
          campos: { status: "pendente", valor_real: null, pago_em: null, observacao: null, valor_previsto: d.valor_previsto },
        });
      }
      continue;
    }

    if (atual.status !== "pendente") continue;
    // Pendentes atrasadas não mudam, exceto metas (que acompanham o mês atual).
    if (atual.vencimento < hoje && !(ehMeta && mesDe(atual.vencimento) === mesHoje)) continue;

    const campos: Partial<Ocorrencia> = {};
    for (const k of CAMPOS_COMPARADOS) {
      // Previsto ajustado (à mão ou pela fatura do banco): valor e vencimento ficam como estão.
      if (k === "vencimento" && atual.previsto_manual) continue;
      if (atual[k] !== d[k]) (campos as Record<string, unknown>)[k] = d[k];
    }
    if (!atual.previsto_manual && atual.valor_previsto !== d.valor_previsto) campos.valor_previsto = d.valor_previsto;
    if (Object.keys(campos).length) plano.atualizar.push({ id: atual.id, campos });
  }

  for (const o of e.ocorrencias) {
    if (!o.chave || !o.origem_id || !gerenciadas.has(o.origem_id) || chavesDesejadas.has(o.chave)) continue;
    if (o.origem_tipo === "meta_divida") {
      // Meta de mês passado não cumprida: cancela. Meta futura sem sentido: remove.
      if (mesDe(o.vencimento) < mesHoje) {
        if (o.status === "pendente")
          plano.atualizar.push({ id: o.id, campos: { status: "cancelado", observacao: OBS_META_NAO_CUMPRIDA } });
      } else if (o.status === "pendente" || (o.status === "pago" && o.observacao === OBS_META_CUMPRIDA)) {
        plano.remover.push(o.id);
      }
      continue;
    }
    if (o.status === "pendente" && o.vencimento >= hoje) plano.remover.push(o.id);
  }

  return plano;
}
