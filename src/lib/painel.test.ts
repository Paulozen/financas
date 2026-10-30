import { describe, expect, it } from "vitest";
import { gastosPorCategoria, projecao, saldoEmConta, sobraDoMes, vencimentos } from "./painel";
import type { Ocorrencia } from "./tipos";

let seq = 0;
function oc(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: `o${++seq}`,
    casa_id: "c",
    origem_tipo: "pontual",
    origem_id: null,
    chave: null,
    descricao: "x",
    tipo: "saida",
    dono_membro_id: null,
    categoria_id: null,
    valor_previsto: 0,
    valor_real: null,
    previsto_manual: false,
    vencimento: "2026-10-10",
    pago_em: null,
    status: "pendente",
    observacao: null,
    fonte: null,
    parcela_num: null,
    transacao_importada_id: null,
    ...p,
  };
}

const HOJE = "2026-10-20";

describe("sobra do mês", () => {
  it("previsto usa real se pago; realizado só pagas; ignora canceladas e outros meses", () => {
    const lista = [
      oc({ tipo: "entrada", valor_previsto: 500000, valor_real: 520000, status: "pago" }),
      oc({ valor_previsto: 150000, valor_real: 150000, status: "pago" }),
      oc({ valor_previsto: 30000 }),
      oc({ valor_previsto: 99999, status: "cancelado" }),
      oc({ valor_previsto: 77777, vencimento: "2026-11-01" }),
    ];
    expect(sobraDoMes(lista, "2026-10")).toEqual({
      previsto: { entradas: 520000, saidas: 180000, saldo: 340000 },
      realizado: { entradas: 520000, saidas: 150000, saldo: 370000 },
    });
  });
});

describe("projeção", () => {
  const lista = [
    oc({ tipo: "entrada", valor_previsto: 500000, valor_real: 500000, status: "pago", vencimento: "2026-10-05", pago_em: "2026-10-05" }),
    oc({ valor_previsto: 200000, vencimento: "2026-10-25" }),
    oc({ valor_previsto: 50000, vencimento: "2026-09-10" }), // atrasada de setembro -> conta em outubro
    oc({ valor_previsto: 10000, vencimento: "2026-08-10", status: "pago", valor_real: 10000 }), // passado pago: fora
    oc({ tipo: "entrada", valor_previsto: 500000, vencimento: "2026-11-05" }),
    oc({ valor_previsto: 600000, vencimento: "2026-11-25" }),
  ];

  it("soma por mês, atrasadas no mês atual, negativos aparecem", () => {
    const p = projecao(lista, HOJE, null, 3);
    expect(p).toEqual([
      { mes: "2026-10", sobra: 250000, acumulado: null },
      { mes: "2026-11", sobra: -100000, acumulado: null },
      { mes: "2026-12", sobra: 0, acumulado: null },
    ]);
  });

  it("saldo acumulado parte do saldo informado e só soma o que não está refletido", () => {
    const p = projecao(lista, HOJE, { valor: 300000, data: "2026-10-15" }, 2);
    // out: salário pago em 05/10 já está no saldo; pendentes -200.000 e -50.000
    expect(p[0].acumulado).toBe(50000);
    expect(p[1].acumulado).toBe(-50000);
  });
});

describe("vencimentos e categorias", () => {
  it("separa atrasados e próximos 15 dias", () => {
    const lista = [
      oc({ vencimento: "2026-10-19", descricao: "atrasado" }),
      oc({ vencimento: "2026-10-20", descricao: "hoje" }),
      oc({ vencimento: "2026-11-04", descricao: "limite" }),
      oc({ vencimento: "2026-11-05", descricao: "fora" }),
      oc({ vencimento: "2026-10-01", status: "pago" }),
    ];
    const v = vencimentos(lista, HOJE);
    expect(v.atrasados.map((o) => o.descricao)).toEqual(["atrasado"]);
    expect(v.proximos.map((o) => o.descricao)).toEqual(["hoje", "limite"]);
  });

  it("agrupa saídas do mês por categoria", () => {
    const lista = [
      oc({ categoria_id: "a", valor_previsto: 100 }),
      oc({ categoria_id: "b", valor_previsto: 300 }),
      oc({ categoria_id: "a", valor_previsto: 50, valor_real: 250, status: "pago" }),
      oc({ categoria_id: "a", tipo: "entrada", valor_previsto: 999 }),
    ];
    expect(gastosPorCategoria(lista, "2026-10")).toEqual([
      { categoria_id: "a", total: 350 },
      { categoria_id: "b", total: 300 },
    ]);
  });
});

describe("pago com dinheiro guardado", () => {
  it("fica fora da sobra e da projeção, mas continua nos gastos por categoria", () => {
    const lista = [
      oc({ tipo: "entrada", valor_previsto: 500000, valor_real: 500000, status: "pago" }),
      oc({ categoria_id: "casamento", valor_previsto: 300000, valor_real: 300000, status: "pago", paga_com_reserva: true }),
      oc({ categoria_id: "casamento", valor_previsto: 200000, vencimento: "2026-10-25", paga_com_reserva: true }), // a pagar com a caixinha
      oc({ categoria_id: "mercado", valor_previsto: 50000, valor_real: 50000, status: "pago" }),
    ];
    expect(sobraDoMes(lista, "2026-10").previsto).toEqual({ entradas: 500000, saidas: 50000, saldo: 450000 });
    expect(projecao(lista, HOJE, null, 1)[0].sobra).toBe(450000);
    expect(gastosPorCategoria(lista, "2026-10")).toEqual([
      { categoria_id: "casamento", total: 500000 },
      { categoria_id: "mercado", total: 50000 },
    ]);
  });
});

describe("saldo em conta", () => {
  const conta = (dono: string | null, saldo: number, p: Partial<{ tipo: string; ativa: boolean }> = {}) => ({
    tipo: "BANK",
    ativa: true,
    saldo,
    saldo_em: "2026-10-30T12:00:00.000Z",
    dono_membro_id: dono,
    ...p,
  });
  const manual = { valor: 99, data: "2026-10-01" };

  it("sem conta conectada usa o informado à mão", () => {
    expect(saldoEmConta([], "casal", manual)).toEqual({ ...manual, automatico: false });
    expect(saldoEmConta([conta("a", 100, { tipo: "CREDIT" })], "casal", null)).toBeNull();
  });

  it("com contas conectadas soma por dono conforme a visão (cartão e inativas fora)", () => {
    const contas = [conta("a", 100000), conta("b", 50000), conta("a", 2500), conta("a", 999999, { tipo: "CREDIT" }), conta("b", 7, { ativa: false })];
    expect(saldoEmConta(contas, "casal", manual)).toEqual({ valor: 152500, data: "2026-10-30", automatico: true });
    expect(saldoEmConta(contas, "a", manual)?.valor).toBe(102500);
    expect(saldoEmConta(contas, "b", manual)?.valor).toBe(50000);
  });
});
