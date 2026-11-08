import { describe, expect, it } from "vitest";
import { deslocarPeriodo, detectarFixos, gastosDetalhados, gastosRealizadosPorDia, periodoDe, relatorio, ritmoDoMes, type CompraDoCartao, type Gasto } from "./analises";
import type { Categoria, Ocorrencia } from "./tipos";

// Dados inventados.
const oc = (o: Partial<Ocorrencia>): Ocorrencia => ({
  id: Math.random().toString(36).slice(2),
  casa_id: "c",
  origem_tipo: "pontual",
  origem_id: null,
  chave: null,
  descricao: "Gasto",
  tipo: "saida",
  dono_membro_id: null,
  categoria_id: "mercado",
  valor_previsto: 10000,
  valor_real: null,
  previsto_manual: false,
  vencimento: "2026-03-10",
  pago_em: null,
  status: "pendente",
  observacao: null,
  fonte: null,
  parcela_num: null,
  transacao_importada_id: null,
  ...o,
});

const compra = (c: Partial<CompraDoCartao>): CompraDoCartao => ({
  id: Math.random().toString(36).slice(2),
  descricao: "Loja Exemplo",
  valor: 5000,
  data: "2026-02-20",
  data_compra: null,
  parcela_num: null,
  parcelas_total: null,
  fatura_mes: "2026-03",
  categoria_id: "lazer",
  cartao_id: "cartao1",
  ...c,
});

const cat = (id: string, nome: string, extra: Partial<Categoria> = {}): Categoria => ({
  id,
  casa_id: "c",
  nome,
  tipo: "saida",
  cor: "#000",
  ativa: true,
  ordem: 0,
  ...extra,
});

describe("gastosDetalhados", () => {
  it("abre a fatura nas compras e guarda o resto sem detalhe", () => {
    const fatura = oc({ origem_tipo: "fatura", origem_id: "regra1", categoria_id: "cartao", valor_previsto: 20000, vencimento: "2026-03-05" });
    const lista = gastosDetalhados(
      [fatura, oc({ valor_previsto: 3000 })],
      [compra({ valor: 12000 }), compra({ valor: 5000, categoria_id: "mercado" }), compra({ valor: -17000, descricao: "Pagamento recebido" })],
      new Map([["regra1", "cartao1"]]),
    );
    expect(lista.filter((g) => g.origem === "cartao").map((g) => g.valor)).toEqual([12000, 5000]);
    expect(lista.find((g) => g.origem === "fatura_resto")?.valor).toBe(3000);
    expect(lista.reduce((s, g) => s + g.valor, 0)).toBe(23000);
  });

  it("fatura de cartão sem compras fica inteira", () => {
    const lista = gastosDetalhados([oc({ origem_tipo: "fatura", origem_id: "regra2", valor_previsto: 8000 })], [compra({})], new Map([["regra2", "cartao2"]]));
    expect(lista).toHaveLength(1);
    expect(lista[0].valor).toBe(8000);
  });
});

describe("gastosRealizadosPorDia", () => {
  it("usa a data da compra e não conta de novo a fatura paga do mesmo cartão", () => {
    const lista = gastosRealizadosPorDia(
      [
        oc({ origem_tipo: "fatura", origem_id: "regra1", status: "pago", valor_real: 9000, pago_em: "2026-03-05" }),
        oc({ status: "pago", valor_real: 2000, pago_em: "2026-03-07" }),
        oc({ status: "pendente" }),
      ],
      [compra({ data: "2026-02-21", data_compra: "2026-02-20", valor: 9000 })],
      new Map([["regra1", "cartao1"]]),
    );
    expect(lista).toEqual([
      { data: "2026-02-20", valor: 9000 },
      { data: "2026-03-07", valor: 2000 },
    ]);
  });
});

describe("ritmoDoMes", () => {
  it("compara com o mês anterior até o mesmo dia", () => {
    const r = ritmoDoMes(
      [
        { data: "2026-02-01", valor: 1000 },
        { data: "2026-02-03", valor: 1000 },
        { data: "2026-02-20", valor: 5000 },
        { data: "2026-03-01", valor: 1500 },
        { data: "2026-03-02", valor: 1500 },
      ],
      "2026-03",
      "2026-03-03",
    );
    expect(r.dia).toBe(3);
    expect(r.atual).toEqual([1500, 3000, 3000]);
    expect(r.anterior).toHaveLength(28);
    expect(r.anteriorAteODia).toBe(2000);
    expect(r.variacao).toBeCloseTo(0.5);
    expect(r.mediaDia).toBe(1000);
  });
});

describe("períodos", () => {
  it("trimestre e ano", () => {
    expect(periodoDe("trimestre", "2026-05")).toEqual({ tipo: "trimestre", inicio: "2026-04", fim: "2026-06" });
    expect(deslocarPeriodo(periodoDe("trimestre", "2026-02"), -1)).toEqual({ tipo: "trimestre", inicio: "2025-10", fim: "2025-12" });
    expect(periodoDe("ano", "2026-05")).toEqual({ tipo: "ano", inicio: "2026-01", fim: "2026-12" });
  });
});

describe("detectarFixos", () => {
  const g = (mes: string, valor: number, extra: Partial<Gasto> = {}): Gasto => ({
    chave: mes + valor,
    data: `${mes}-10`,
    mes,
    descricao: "Streaming Exemplo",
    valor,
    categoria_id: "lazer",
    origem: "cartao",
    cadastrada: false,
    parcelada: false,
    realizado: true,
    ...extra,
  });
  it("acha o que se repete com valor parecido em 3 de 4 meses", () => {
    const fixos = detectarFixos([g("2026-01", 3990), g("2026-02", 3990), g("2026-03", 4290), g("2026-03", 100000, { descricao: "Compra grande" })], "2026-03");
    expect(fixos).toHaveLength(1);
    expect(fixos[0].meses).toBe(3);
  });
  it("ignora cadastrados, parcelas e valores muito diferentes", () => {
    expect(detectarFixos([g("2026-01", 3990, { cadastrada: true }), g("2026-02", 3990, { cadastrada: true }), g("2026-03", 3990, { cadastrada: true })], "2026-03")).toEqual([]);
    expect(detectarFixos([g("2026-01", 1000), g("2026-02", 5000), g("2026-03", 1000)], "2026-03")).toEqual([]);
  });
});

describe("relatorio", () => {
  it("sobra, taxa, limite estourado e categoria acima da média", () => {
    const categorias = [cat("mercado", "Mercado", { limite_mensal: 50000 }), cat("lazer", "Lazer")];
    const ocorrencias = [
      oc({ tipo: "entrada", categoria_id: null, valor_previsto: 300000, vencimento: "2026-03-05" }),
      oc({ categoria_id: "mercado", valor_previsto: 60000, vencimento: "2026-03-10" }),
      oc({ categoria_id: "lazer", valor_previsto: 30000, vencimento: "2026-03-12" }),
      oc({ categoria_id: "lazer", valor_previsto: 10000, vencimento: "2026-02-12" }),
    ];
    const gastos = gastosDetalhados(ocorrencias, [], new Map());
    const r = relatorio({
      ocorrencias,
      gastos,
      porDia: [],
      categorias,
      periodo: periodoDe("mes", "2026-03"),
      hoje: "2026-04-02",
      formatar: (c) => String(c / 100),
      ehEssencial: (c) => c?.id !== "lazer",
    });
    expect(r.sobra).toBe(210000);
    expect(r.taxa).toBeCloseTo(0.7);
    expect(r.categorias[0]).toMatchObject({ categoria_id: "mercado", total: 60000 });
    expect(r.naoEssenciais.total).toBe(30000);
    expect(r.avisos.map((a) => a.icone)).toEqual(expect.arrayContaining(["cofre", "limite", "seta", "corte"]));
    expect(r.mesAMes).toHaveLength(12);
  });
});
