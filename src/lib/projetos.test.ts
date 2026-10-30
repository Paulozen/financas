import { describe, expect, it } from "vitest";
import { dividirParcelas, resumoProjeto } from "./projetos";
import type { Ocorrencia, ProjetoItem } from "./tipos";

describe("projetos", () => {
  it("divide em parcelas iguais e a última absorve o arredondamento", () => {
    const p = dividirParcelas(100000, 3, "2026-11-30");
    expect(p).toEqual([
      { data: "2026-11-30", valor: 33333 },
      { data: "2026-12-30", valor: 33333 },
      { data: "2027-01-30", valor: 33334 },
    ]);
    expect(dividirParcelas(100, 2, "2027-01-31")[1].data).toBe("2027-02-28");
    expect(dividirParcelas(0, 3, "2026-11-01")).toEqual([]);
  });

  const parc = (status: Ocorrencia["status"], prev: number, real: number | null, origem = "a") =>
    ({ origem_id: origem, status, valor_previsto: prev, valor_real: real }) as Ocorrencia;

  it("resume orçado, contratado, pago, falta pagar e parcelado", () => {
    const itens = [
      { id: "a", valor_orcado: 500000, valor_contratado: 450000, valor_pago_antes: 0 },
      { id: "b", valor_orcado: 200000, valor_contratado: 0, valor_pago_antes: 0 },
    ] as ProjetoItem[];
    const r = resumoProjeto(itens, [parc("pago", 150000, 150000), parc("pendente", 150000, null), parc("cancelado", 1, null)]);
    expect(r).toEqual({
      orcado: 700000,
      contratado: 450000,
      pagoAntes: 0,
      pagoParcelas: 150000,
      pago: 150000,
      faltaPagar: 300000,
      parcelado: 300000,
      faltaParcelar: 150000,
    });
  });

  it("pago antes do app entra no pago e no falta pagar (sem ser parcela)", () => {
    const itens = [
      { id: "a", valor_orcado: 1919000, valor_contratado: 1919000, valor_pago_antes: 411216 },
      { id: "b", valor_orcado: 130000, valor_contratado: 130000, valor_pago_antes: 130000 },
    ] as ProjetoItem[];
    const r = resumoProjeto(itens, [parc("pago", 100000, 100000), parc("pendente", 200000, null)]);
    expect(r.pagoAntes).toBe(541216);
    expect(r.pago).toBe(641216);
    expect(r.faltaPagar).toBe(2049000 - 641216);
    // falta parcelar = contratado − pago antes − parcelas
    expect(r.faltaParcelar).toBe(2049000 - 541216 - 300000);
    // item quitado só com o pago antes: nada a parcelar
    expect(resumoProjeto([itens[1]], []).faltaParcelar).toBe(0);
  });

  it("falta parcelar negativo quando as parcelas passam do contratado", () => {
    const itens = [{ id: "a", valor_orcado: 0, valor_contratado: 100000, valor_pago_antes: 20000 }] as ProjetoItem[];
    expect(resumoProjeto(itens, [parc("pendente", 90000, null)]).faltaParcelar).toBe(-10000);
  });
});
