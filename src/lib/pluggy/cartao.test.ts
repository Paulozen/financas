// Compras INVENTADAS no formato das transações de cartão da Pluggy (já convertidas).
import { describe, expect, it } from "vitest";
import { comprometidoPorMes, descricaoBase, ehPagamentoDeFatura, gastosDaFatura, mediaAVista, parcelasEmAberto, previsaoFaturas, type CompraCartao } from "./cartao";

const compra = (p: Partial<CompraCartao>): CompraCartao => ({
  descricao: "LOJA EXEMPLO",
  valor: 10000,
  data: "2026-10-05",
  data_compra: "2026-10-05",
  parcela_num: null,
  parcelas_total: null,
  fatura_mes: "2026-11",
  ...p,
});

describe("cartão: parcelas", () => {
  it("tira o 'x/y' da descrição", () => {
    expect(descricaoBase("LOJA EXEMPLO PARC 02/06")).toBe("LOJA EXEMPLO");
    expect(descricaoBase("Celular Exemplo 3/10")).toBe("Celular Exemplo");
    expect(descricaoBase("CURSO ONLINE PARCELA 2 DE 12")).toBe("CURSO ONLINE");
  });

  it("calcula as parcelas futuras a partir da última conhecida", () => {
    // banco só mostra a parcela 3/6 (fatura de nov); as 4..6 vão para dez, jan, fev
    const lista = parcelasEmAberto(
      [compra({ descricao: "TV EXEMPLO 3/6", valor: 50000, parcela_num: 3, parcelas_total: 6, data_compra: "2026-08-20", fatura_mes: "2026-11" })],
      "2026-11",
    );
    expect(lista).toHaveLength(1);
    expect(lista[0]).toMatchObject({ descricao: "TV EXEMPLO", parcelaAtual: 2, total: 6, valorParcela: 50000, falta: 200000 });
    expect(lista[0].proximas.map((p) => `${p.numero}@${p.mes}`)).toEqual(["3@2026-11", "4@2026-12", "5@2027-01", "6@2027-02"]);
  });

  it("junta parcelas futuras que o banco já mandou, sem contar em dobro", () => {
    const base = { descricao: "SOFA EXEMPLO", valor: 30000, parcelas_total: 4, data_compra: "2026-10-01" };
    const lista = parcelasEmAberto(
      [
        compra({ ...base, descricao: "SOFA EXEMPLO 1/4", parcela_num: 1, fatura_mes: "2026-10" }),
        compra({ ...base, descricao: "SOFA EXEMPLO 2/4", parcela_num: 2, fatura_mes: "2026-11" }),
        compra({ ...base, descricao: "SOFA EXEMPLO 3/4", parcela_num: 3, fatura_mes: "2026-12" }),
      ],
      "2026-11",
    );
    expect(lista[0].proximas.map((p) => p.mes)).toEqual(["2026-11", "2026-12", "2027-01"]);
    expect(lista[0].falta).toBe(90000);
  });

  it("compra quitada não aparece; comprometido soma por mês", () => {
    const quitada = compra({ descricao: "X 2/2", parcela_num: 2, parcelas_total: 2, fatura_mes: "2026-10" });
    const a = compra({ descricao: "A 1/3", valor: 1000, parcela_num: 1, parcelas_total: 3, fatura_mes: "2026-11", data_compra: "2026-10-10" });
    const b = compra({ descricao: "B 1/2", valor: 500, parcela_num: 1, parcelas_total: 2, fatura_mes: "2026-11", data_compra: "2026-10-11" });
    const lista = parcelasEmAberto([quitada, a, b], "2026-11");
    expect(lista).toHaveLength(2);
    expect(Object.fromEntries(comprometidoPorMes(lista))).toEqual({ "2026-11": 1500, "2026-12": 1500, "2027-01": 1000 });
  });
});

describe("cartão: previsão de fatura e gastos", () => {
  const compras = [
    compra({ valor: 30000, fatura_mes: "2026-08" }),
    compra({ valor: 60000, fatura_mes: "2026-09" }),
    compra({ valor: 90000, fatura_mes: "2026-10" }),
    compra({ valor: 999999, fatura_mes: "2026-07" }), // fora dos últimos 3
    compra({ descricao: "PAGAMENTO FATURA", valor: -150000, fatura_mes: "2026-10", categoria_pluggy: "Credit card payment" }),
    compra({ descricao: "NOTEBOOK 1/10", valor: 20000, parcela_num: 1, parcelas_total: 10, fatura_mes: "2026-10", data_compra: "2026-09-15" }),
  ];

  it("média à vista dos últimos 3 meses fechados (sem parcelas e sem pagamento)", () => {
    expect(ehPagamentoDeFatura(compras[4])).toBe(true);
    expect(mediaAVista(compras, ["2026-07", "2026-08", "2026-09", "2026-10"])).toBe(60000);
  });

  it("previsto da fatura futura = parcelas do mês + média à vista", () => {
    const p = previsaoFaturas(compras, ["2026-08", "2026-09", "2026-10"], ["2026-11", "2026-12"]);
    expect(Object.fromEntries(p)).toEqual({ "2026-11": 80000, "2026-12": 80000 });
  });

  it("gastos da fatura por categoria", () => {
    const lista = [
      compra({ valor: 1000, categoria_id: "a" }),
      compra({ valor: 3000, categoria_id: "b" }),
      compra({ valor: 500, categoria_id: "a" }),
      compra({ valor: -2000, descricao: "PAGAMENTO", categoria_pluggy: "Credit card payment" }),
      compra({ valor: 700, fatura_mes: "2026-12" }),
    ];
    expect(gastosDaFatura(lista, "2026-11")).toEqual([
      { categoria_id: "b", total: 3000 },
      { categoria_id: "a", total: 1500 },
    ]);
  });
});
