// Análises, ritmo de gastos e avisos (funções puras). Inspirado nos "Insights" do Kova.
//
// Duas visões do mesmo dinheiro:
// - Competência (categorias, limites, maiores gastos): o mês da ocorrência (vencimento),
//   como na sobra do Painel. Uma fatura de cartão com compras conhecidas é "aberta"
//   nas compras (cada uma com a sua categoria); o que a fatura tiver a mais fica como
//   "fatura sem detalhe".
// - Dia a dia (ritmo, média por dia, dia mais caro): quando o dinheiro foi gasto —
//   compras do cartão pela data da compra e as outras saídas pela data do pagamento.
import { ehPagamentoDeFatura, ehParcelada, type CompraCartao } from "./pluggy/cartao";
import { difDias, mesDe, primeiroDia, somarMeses, ultimoDia } from "./datas";
import { normalizarDescricao } from "./importacao/texto";
import { contaNaSobra, valorConta } from "./painel";
import type { Categoria, Ocorrencia } from "./tipos";

export interface CompraDoCartao extends CompraCartao {
  /** cartão do app a que a conta do banco está ligada */
  cartao_id: string;
}

export interface Gasto {
  chave: string;
  /** data em que o dinheiro foi gasto (compra ou pagamento; senão o vencimento) */
  data: string;
  /** mês de competência (aaaa-mm) */
  mes: string;
  descricao: string;
  valor: number;
  categoria_id: string | null;
  origem: "ocorrencia" | "cartao" | "fatura_resto";
  /** saída que se repete por cadastro (recorrente, contrato…): não entra na detecção de fixos */
  cadastrada: boolean;
  parcelada: boolean;
  realizado: boolean;
  /** compra do cartão ou ocorrência sem categoria escolhida */
  semCategoria: boolean;
  /** id da compra (transacoes_externas) ou da ocorrência, para categorizar */
  ref: string;
}

/**
 * Saídas detalhadas: ocorrências de saída (não canceladas) com as faturas abertas nas compras.
 * `cartaoDaRegra`: id da recorrência de fatura -> id do cartão.
 */
export function gastosDetalhados(ocorrencias: Ocorrencia[], compras: CompraDoCartao[], cartaoDaRegra: Map<string, string>): Gasto[] {
  const comprasPorFatura = new Map<string, CompraDoCartao[]>();
  for (const c of compras) {
    if (!c.fatura_mes || c.valor <= 0 || ehPagamentoDeFatura(c)) continue;
    const k = `${c.cartao_id}|${c.fatura_mes}`;
    comprasPorFatura.set(k, [...(comprasPorFatura.get(k) ?? []), c]);
  }
  const lista: Gasto[] = [];
  for (const o of ocorrencias) {
    if (o.tipo !== "saida" || o.status === "cancelado") continue;
    const valor = valorConta(o);
    const mes = mesDe(o.vencimento);
    const cartao = o.origem_tipo === "fatura" && o.origem_id ? cartaoDaRegra.get(o.origem_id) : undefined;
    const doCartao = cartao ? comprasPorFatura.get(`${cartao}|${mes}`) : undefined;
    if (doCartao?.length) {
      let soma = 0;
      for (const c of doCartao) {
        soma += c.valor;
        lista.push({
          chave: `c:${c.id ?? `${c.descricao}|${c.data}|${c.valor}`}`,
          data: c.data_compra ?? c.data,
          mes,
          descricao: c.descricao,
          valor: c.valor,
          categoria_id: c.categoria_id ?? o.categoria_id,
          origem: "cartao",
          cadastrada: false,
          parcelada: ehParcelada(c),
          realizado: true,
          semCategoria: !c.categoria_id,
          ref: c.id ?? "",
        });
      }
      if (valor - soma > 0)
        lista.push({
          chave: `r:${o.id}`,
          data: o.pago_em ?? o.vencimento,
          mes,
          descricao: `${o.descricao} (sem detalhe)`,
          valor: valor - soma,
          categoria_id: o.categoria_id,
          origem: "fatura_resto",
          cadastrada: true,
          parcelada: false,
          realizado: o.status === "pago",
          semCategoria: false,
          ref: o.id,
        });
      continue;
    }
    if (valor <= 0) continue;
    lista.push({
      chave: `o:${o.id}`,
      data: o.status === "pago" ? (o.pago_em ?? o.vencimento) : o.vencimento,
      mes,
      descricao: o.descricao,
      valor,
      categoria_id: o.categoria_id,
      origem: "ocorrencia",
      cadastrada: o.origem_tipo !== "pontual",
      parcelada: o.parcela_num !== null,
      realizado: o.status === "pago",
      semCategoria: !o.categoria_id,
      ref: o.id,
    });
  }
  return lista;
}

/**
 * Gastos que já aconteceram, dia a dia: compras dos cartões pela data da compra e as
 * outras saídas pagas pela data do pagamento. Faturas de cartões com compras
 * conhecidas ficam de fora (as compras já contam).
 */
export function gastosRealizadosPorDia(ocorrencias: Ocorrencia[], compras: CompraDoCartao[], cartaoDaRegra: Map<string, string>) {
  const cartoesComCompras = new Set(compras.map((c) => c.cartao_id));
  const lista: { data: string; valor: number }[] = [];
  for (const c of compras) if (c.valor > 0 && !ehPagamentoDeFatura(c)) lista.push({ data: c.data_compra ?? c.data, valor: c.valor });
  for (const o of ocorrencias) {
    if (o.tipo !== "saida" || o.status !== "pago") continue;
    const cartao = o.origem_tipo === "fatura" && o.origem_id ? cartaoDaRegra.get(o.origem_id) : undefined;
    if (cartao && cartoesComCompras.has(cartao)) continue;
    lista.push({ data: o.pago_em ?? o.vencimento, valor: o.valor_real ?? 0 });
  }
  return lista;
}

export interface Ritmo {
  /** acumulado do mês atual, dia a dia, até `hoje` (ou o mês todo, se já passou) */
  atual: number[];
  /** acumulado do mês anterior, o mês todo */
  anterior: number[];
  /** gasto por dia no mês atual */
  diario: number[];
  /** último dia com dado no mês atual (1-based) */
  dia: number;
  totalAteHoje: number;
  anteriorAteODia: number;
  /** variação contra o mês anterior até o mesmo dia (null sem base) */
  variacao: number | null;
  mediaDia: number;
}

export function ritmoDoMes(gastos: { data: string; valor: number }[], mes: string, hoje: string): Ritmo {
  const serie = (m: string, ate: number) => {
    const n = Number(ultimoDia(m).slice(8));
    const porDia = new Array(n).fill(0);
    for (const g of gastos) if (mesDe(g.data) === m) porDia[Number(g.data.slice(8)) - 1] += g.valor;
    const acumulado: number[] = [];
    let s = 0;
    for (let i = 0; i < Math.min(n, ate); i++) acumulado.push((s += porDia[i]));
    return { porDia: porDia.slice(0, ate), acumulado, n };
  };
  const mesHoje = mesDe(hoje);
  const ateHoje = mes < mesHoje ? 99 : mes === mesHoje ? Number(hoje.slice(8)) : 0;
  const atual = serie(mes, ateHoje);
  const anterior = serie(somarMeses(mes, -1), 99);
  const dia = atual.acumulado.length;
  const totalAteHoje = atual.acumulado.at(-1) ?? 0;
  const anteriorAteODia = anterior.acumulado[Math.min(dia, anterior.n) - 1] ?? 0;
  return {
    atual: atual.acumulado,
    anterior: anterior.acumulado,
    diario: atual.porDia,
    dia,
    totalAteHoje,
    anteriorAteODia,
    variacao: anteriorAteODia > 0 && dia > 0 ? (totalAteHoje - anteriorAteODia) / anteriorAteODia : null,
    mediaDia: dia > 0 ? Math.round(totalAteHoje / dia) : 0,
  };
}

// ---------------------------------------------------------------- períodos

export type TipoPeriodo = "mes" | "trimestre" | "ano";
export interface Periodo {
  tipo: TipoPeriodo;
  /** primeiro mês (aaaa-mm) */
  inicio: string;
  /** último mês (aaaa-mm) */
  fim: string;
}

export function periodoDe(tipo: TipoPeriodo, mes: string): Periodo {
  const [a, m] = mes.split("-").map(Number);
  if (tipo === "mes") return { tipo, inicio: mes, fim: mes };
  if (tipo === "ano") return { tipo, inicio: `${a}-01`, fim: `${a}-12` };
  const primeiro = Math.floor((m - 1) / 3) * 3 + 1;
  const inicio = `${a}-${String(primeiro).padStart(2, "0")}`;
  return { tipo, inicio, fim: somarMeses(inicio, 2) };
}

export function deslocarPeriodo(p: Periodo, n: number): Periodo {
  const passo = p.tipo === "mes" ? 1 : p.tipo === "trimestre" ? 3 : 12;
  return periodoDe(p.tipo, somarMeses(p.inicio, n * passo));
}

const noPeriodo = (mes: string, p: Periodo) => mes >= p.inicio && mes <= p.fim;

// ---------------------------------------------------------------- relatório

export interface Aviso {
  tom: "bom" | "atencao" | "info";
  icone: "cofre" | "grafico" | "seta" | "limite" | "corte" | "pizza" | "repetir";
  titulo: string;
  texto: string;
  /** "Ver como foi calculado" */
  como: string;
  categoria_id?: string;
}

export interface FixoDetectado {
  descricao: string;
  media: number;
  meses: number;
  categoria_id: string | null;
}

export interface Relatorio {
  periodo: Periodo;
  entradas: number;
  saidas: number;
  sobra: number;
  /** % da entrada que sobrou (null sem entradas) */
  taxa: number | null;
  anterior: { entradas: number; saidas: number; sobra: number };
  /** variação das saídas contra o período anterior */
  variacaoSaidas: number | null;
  /** soma das saídas detalhadas (inclui as pagas com dinheiro guardado) */
  gastos: number;
  categorias: { categoria_id: string | null; total: number; parte: number; anterior: number; media: number }[];
  maiores: Gasto[];
  naoEssenciais: { total: number; parte: number; categorias: { categoria_id: string | null; total: number }[] };
  limites: { categoria_id: string; total: number; limite: number }[];
  mediaDia: number;
  diaMaisCaro: { data: string; valor: number } | null;
  fixos: FixoDetectado[];
  mesAMes: { mes: string; entradas: number; saidas: number }[];
  avisos: Aviso[];
}

function totaisSobra(ocorrencias: Ocorrencia[], p: Periodo) {
  let entradas = 0;
  let saidas = 0;
  for (const o of ocorrencias) {
    if (!contaNaSobra(o) || !noPeriodo(mesDe(o.vencimento), p)) continue;
    if (o.tipo === "entrada") entradas += valorConta(o);
    else saidas += valorConta(o);
  }
  return { entradas, saidas, sobra: entradas - saidas };
}

function somaPorCategoria(gastos: Gasto[], p: Periodo) {
  const m = new Map<string | null, number>();
  for (const g of gastos) if (noPeriodo(g.mes, p)) m.set(g.categoria_id, (m.get(g.categoria_id) ?? 0) + g.valor);
  return m;
}

/**
 * Saídas que se repetem e ainda não estão cadastradas: mesma descrição em pelo menos 3
 * dos últimos 4 meses (até `ateMes`), com valor parecido (±35% da média).
 */
const GENERICAS = /^(pagamento|pagto|pgto|pix|transferencia|ted|doc|compra|debito|boleto)( (realizado|realizada|enviado|enviada|efetuado|efetuada|recebido|pago|paga))?$/;

export function detectarFixos(gastos: Gasto[], ateMes: string): FixoDetectado[] {
  const ultimos = [0, 1, 2, 3].map((i) => somarMeses(ateMes, -i));
  const grupos = new Map<string, { meses: Map<string, number>; descricao: string; categoria_id: string | null }>();
  for (const g of gastos) {
    if (g.cadastrada || g.parcelada || !ultimos.includes(g.mes)) continue;
    const k = normalizarDescricao(g.descricao).replace(/\d+/g, "").replace(/\s+/g, " ").trim();
    // Descrições genéricas de banco ("Pagamento realizado", "Pix enviado") não dizem o que é.
    if (k.length < 3 || GENERICAS.test(k)) continue;
    const grupo = grupos.get(k) ?? { meses: new Map(), descricao: g.descricao, categoria_id: g.categoria_id };
    grupo.meses.set(g.mes, (grupo.meses.get(g.mes) ?? 0) + g.valor);
    grupos.set(k, grupo);
  }
  const lista: FixoDetectado[] = [];
  for (const g of grupos.values()) {
    if (g.meses.size < 3) continue;
    const valores = [...g.meses.values()];
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    if (valores.some((v) => Math.abs(v - media) > media * 0.35)) continue;
    lista.push({ descricao: g.descricao, media: Math.round(media), meses: g.meses.size, categoria_id: g.categoria_id });
  }
  return lista.sort((a, b) => b.media - a.media);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

export function relatorio(args: {
  ocorrencias: Ocorrencia[];
  gastos: Gasto[];
  porDia: { data: string; valor: number }[];
  categorias: Categoria[];
  periodo: Periodo;
  hoje: string;
  formatar: (centavos: number) => string;
  ehEssencial: (c: Categoria | undefined) => boolean;
}): Relatorio {
  const { ocorrencias, gastos, porDia, categorias, periodo: p, hoje, formatar: f, ehEssencial } = args;
  const cat = new Map(categorias.map((c) => [c.id, c]));
  const nomeCat = (id: string | null) => (id ? (cat.get(id)?.nome ?? "Sem categoria") : "Sem categoria");

  const atual = totaisSobra(ocorrencias, p);
  const pAnt = deslocarPeriodo(p, -1);
  const anterior = totaisSobra(ocorrencias, pAnt);
  const taxa = atual.entradas > 0 ? atual.sobra / atual.entradas : null;
  const variacaoSaidas = anterior.saidas > 0 ? (atual.saidas - anterior.saidas) / anterior.saidas : null;

  // Categorias: período, anterior e média dos 6 períodos anteriores (só os que tiveram gasto).
  const doPeriodo = somaPorCategoria(gastos, p);
  const historico = [1, 2, 3, 4, 5, 6].map((i) => somaPorCategoria(gastos, deslocarPeriodo(p, -i)));
  const comDados = historico.filter((m) => m.size > 0);
  const media = (id: string | null) => (comDados.length ? comDados.reduce((s, m) => s + (m.get(id) ?? 0), 0) / comDados.length : 0);
  const totalGastos = [...doPeriodo.values()].reduce((s, v) => s + v, 0);
  const lista = [...doPeriodo.entries()]
    .filter(([, v]) => v > 0)
    .map(([categoria_id, total]) => ({
      categoria_id,
      total,
      parte: totalGastos ? total / totalGastos : 0,
      anterior: historico[0].get(categoria_id) ?? 0,
      media: Math.round(media(categoria_id)),
    }))
    .sort((a, b) => b.total - a.total);

  const doPeriodoGastos = gastos.filter((g) => noPeriodo(g.mes, p));
  const maiores = [...doPeriodoGastos].sort((a, b) => b.valor - a.valor).slice(0, 8);

  const ne = new Map<string | null, number>();
  for (const g of doPeriodoGastos) if (!ehEssencial(g.categoria_id ? cat.get(g.categoria_id) : undefined)) ne.set(g.categoria_id, (ne.get(g.categoria_id) ?? 0) + g.valor);
  const neTotal = [...ne.values()].reduce((s, v) => s + v, 0);

  // Limites: por mês. Num trimestre/ano o limite vale por mês × número de meses.
  const nMeses = p.tipo === "mes" ? 1 : p.tipo === "trimestre" ? 3 : 12;
  const limites = categorias
    .filter((c) => c.limite_mensal && c.tipo === "saida")
    .map((c) => ({ categoria_id: c.id, total: doPeriodo.get(c.id) ?? 0, limite: c.limite_mensal! * nMeses }))
    .sort((a, b) => b.total / b.limite - a.total / a.limite);

  // Dia a dia (realizado), até hoje.
  const inicioData = primeiroDia(p.inicio);
  const fimData = ultimoDia(p.fim) < hoje ? ultimoDia(p.fim) : hoje;
  const dias = fimData >= inicioData ? difDias(inicioData, fimData) + 1 : 0;
  const porData = new Map<string, number>();
  for (const g of porDia) if (g.data >= inicioData && g.data <= fimData) porData.set(g.data, (porData.get(g.data) ?? 0) + g.valor);
  const realizado = [...porData.values()].reduce((s, v) => s + v, 0);
  const mediaDia = dias > 0 ? Math.round(realizado / dias) : 0;
  const maisCaro = [...porData.entries()].sort((a, b) => b[1] - a[1])[0];

  const ultimoMesCompleto = mesDe(hoje) > p.fim ? p.fim : somarMeses(mesDe(hoje), -1);
  const fixos = detectarFixos(gastos, ultimoMesCompleto);

  const mesAMes = [] as Relatorio["mesAMes"];
  for (let i = 11; i >= 0; i--) {
    const m = somarMeses(p.fim, -i);
    const t = totaisSobra(ocorrencias, periodoDe("mes", m));
    mesAMes.push({ mes: m, entradas: t.entradas, saidas: t.saidas });
  }

  // ------------------------------------------------ avisos ("Vale sua atenção")
  const avisos: Aviso[] = [];
  const emAndamento = mesDe(hoje) >= p.inicio && mesDe(hoje) <= p.fim;
  if (atual.entradas > 0) {
    avisos.push(
      atual.sobra >= 0
        ? {
            tom: "bom",
            icone: "cofre",
            titulo: `${emAndamento ? "Deve sobrar" : "Sobrou"} ${f(atual.sobra)}`,
            texto: `${pct(taxa ?? 0)} das entradas ${emAndamento ? "devem ficar" : "ficaram"} com vocês.`,
            como: `Entradas ${f(atual.entradas)} − saídas ${f(atual.saidas)} = ${f(atual.sobra)}. Conta o que já foi pago pelo valor real e o resto pelo previsto. Pagamentos com dinheiro guardado e cancelados ficam de fora.`,
          }
        : {
            tom: "atencao",
            icone: "grafico",
            titulo: `As saídas passam as entradas em ${f(-atual.sobra)}`,
            texto: emAndamento ? "Vale rever as saídas previstas ou adiar algo para o mês seguinte." : "O período fechou no negativo.",
            como: `Entradas ${f(atual.entradas)} − saídas ${f(atual.saidas)}. Conta o que já foi pago pelo valor real e o resto pelo previsto.`,
          },
    );
  }
  for (const l of limites) {
    if (l.total < l.limite * 0.9) continue;
    const passou = l.total > l.limite;
    avisos.push({
      tom: passou ? "atencao" : "info",
      icone: "limite",
      titulo: passou ? `${nomeCat(l.categoria_id)} passou do limite` : `${nomeCat(l.categoria_id)} está perto do limite`,
      texto: passou ? `${f(l.total - l.limite)} acima do limite de ${f(l.limite)}.` : `${pct(l.total / l.limite)} do limite de ${f(l.limite)}.`,
      como: `Soma das saídas da categoria no período (compras do cartão pela fatura): ${f(l.total)}. Limite: ${f(l.limite)}${nMeses > 1 ? ` (${f(l.limite / nMeses)} por mês × ${nMeses})` : ""}.`,
      categoria_id: l.categoria_id,
    });
  }
  for (const c of lista) {
    if (c.media <= 0 || c.total < c.media * 1.3 || c.total - c.media < 5000) continue;
    avisos.push({
      tom: "atencao",
      icone: "seta",
      titulo: `${nomeCat(c.categoria_id)}: ${pct(c.total / c.media - 1)} acima do normal`,
      texto: `${f(c.total)} neste período; a média é ${f(c.media)}.`,
      como: `Média dos ${comDados.length} períodos anteriores com gastos (até 6). Só avisa quando passa 30% e pelo menos R$ 50 da média.`,
      categoria_id: c.categoria_id ?? undefined,
    });
    if (avisos.filter((a) => a.icone === "seta").length >= 3) break;
  }
  if (neTotal > 0 && totalGastos > 0 && neTotal / totalGastos >= 0.15)
    avisos.push({
      tom: "info",
      icone: "corte",
      titulo: `Não essenciais: ${f(neTotal)} (${pct(neTotal / totalGastos)} dos gastos)`,
      texto: "Uma boa parte vai para gastos que dá para cortar.",
      como: `Soma das categorias marcadas como não essenciais (${[...ne.keys()].map(nomeCat).join(", ")}). Ajuste em Categorias → editar → "Gasto essencial".`,
    });
  const maior = lista[0];
  if (maior && maior.parte >= 0.4 && lista.length > 2)
    avisos.push({
      tom: "info",
      icone: "pizza",
      titulo: `${nomeCat(maior.categoria_id)} leva ${pct(maior.parte)} dos gastos`,
      texto: `${f(maior.total)} de ${f(totalGastos)}.`,
      como: "Parte da maior categoria na soma das saídas do período.",
      categoria_id: maior.categoria_id ?? undefined,
    });
  if (fixos.length)
    avisos.push({
      tom: "info",
      icone: "repetir",
      titulo: `${fixos.length} ${fixos.length === 1 ? "gasto se repete" : "gastos se repetem"} todo mês (~${f(fixos.reduce((s, x) => s + x.media, 0))}/mês)`,
      texto: "Não estão cadastrados como recorrentes. Cadastrar ajuda a prever a sobra.",
      como: "Saídas avulsas e compras do cartão com a mesma descrição em pelo menos 3 dos últimos 4 meses, com valor parecido (±35%). Parcelas ficam de fora.",
    });

  return {
    periodo: p,
    ...atual,
    taxa,
    anterior,
    variacaoSaidas,
    gastos: totalGastos,
    categorias: lista,
    maiores,
    naoEssenciais: {
      total: neTotal,
      parte: totalGastos ? neTotal / totalGastos : 0,
      categorias: [...ne.entries()].map(([categoria_id, total]) => ({ categoria_id, total })).sort((a, b) => b.total - a.total),
    },
    limites,
    mediaDia,
    diaMaisCaro: maisCaro ? { data: maisCaro[0], valor: maisCaro[1] } : null,
    fixos,
    mesAMes,
    avisos,
  };
}
