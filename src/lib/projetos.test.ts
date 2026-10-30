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

  it("resume orçado, contratado, pago e falta pagar", () => {
    const itens = [
      { id: "a", valor_orcado: 500000, valor_contratado: 450000 },
      { id: "b", valor_orcado: 200000, valor_contratado: 0 },
    ] as ProjetoItem[];
    const parc = (status: Ocorrencia["status"], prev: number, real: number | null) =>
      ({ origem_id: "a", status, valor_previsto: prev, valor_real: real }) as Ocorrencia;
    const r = resumoProjeto(itens, [parc("pago", 150000, 150000), parc("pendente", 150000, null), parc("cancelado", 1, null)]);
    expect(r).toEqual({ orcado: 700000, contratado: 450000, pago: 150000, faltaPagar: 300000, agendado: 300000 });
  });
});
