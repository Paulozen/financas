import { describe, expect, it } from "vitest";
import { categoriaDoPacote } from "./pacote-regras";
import { fluxoDiario } from "./fluxo";
import { resumoMeta } from "./metas";
import type { Ocorrencia } from "./tipos";

describe("resumoMeta", () => {
  const base = { meta: 1200000, inicio: "2026-01-01", hoje: "2026-07-01", historico: [] };
  it("no ritmo quando o saldo acompanha a linha reta até a data", () => {
    const r = resumoMeta({ ...base, saldo: 600000, data: "2027-01-01" });
    expect(r.situacao).toBe("no_ritmo");
    expect(r.porMes).toBe(100000);
    expect(r.falta).toBe(600000);
  });
  it("atrasada, adiantada, vencida e concluída", () => {
    expect(resumoMeta({ ...base, saldo: 200000, data: "2027-01-01" }).situacao).toBe("atrasada");
    expect(resumoMeta({ ...base, saldo: 900000, data: "2027-01-01" }).situacao).toBe("adiantada");
    expect(resumoMeta({ ...base, saldo: 200000, data: "2026-06-01" }).situacao).toBe("vencida");
    expect(resumoMeta({ ...base, saldo: 1300000, data: "2027-01-01" }).situacao).toBe("concluida");
    expect(resumoMeta({ ...base, saldo: 100, data: null }).situacao).toBe("sem_data");
  });
  it("ritmo e previsão pelo histórico dos últimos 90 dias", () => {
    const r = resumoMeta({
      ...base,
      saldo: 400000,
      data: null,
      historico: [
        { data: "2026-04-02", valor: 100000 },
        { data: "2026-05-15", valor: 250000 },
      ],
    });
    expect(r.ritmo).toBeGreaterThan(90000);
    expect(r.ritmo).toBeLessThan(110000);
    expect(r.previsao).toBe("2027-03");
  });
});

describe("resumoMeta com ponto de partida (fórmula do Securo)", () => {
  const b = { meta: 1000000, data: "2027-01-01", inicio: "2026-01-01", historico: [], hoje: "2026-07-02" };
  const base = { desde: "2026-01-01", inicial: 400000 };
  it("mede o progresso a partir do que havia quando a meta foi definida", () => {
    // precisa 600 mil em 365 dias; passados ~182 dias espera ~299 mil a mais
    expect(resumoMeta({ ...b, saldo: 700000, base }).situacao).toBe("no_ritmo");
    expect(resumoMeta({ ...b, saldo: 800000, base }).situacao).toBe("adiantada");
    expect(resumoMeta({ ...b, saldo: 550000, base }).situacao).toBe("atrasada");
  });
});

describe("pacote de regras", () => {
  const cats = [
    { id: "a", nome: "Alimentação", tipo: "saida", ativa: true },
    { id: "m", nome: "Mercado", tipo: "saida", ativa: true },
    { id: "t", nome: "Transporte", tipo: "saida", ativa: true },
    { id: "l", nome: "Lazer", tipo: "saida", ativa: true },
  ];
  it("reconhece lojas comuns e usa a primeira categoria que existe", () => {
    expect(categoriaDoPacote("IFOOD *RESTAURANTE EXEMPLO", cats)).toBe("a");
    expect(categoriaDoPacote("UBER *TRIP", cats)).toBe("t");
    expect(categoriaDoPacote("Supermercado Exemplo", cats)).toBe("m");
    expect(categoriaDoPacote("NETFLIX.COM", cats)).toBe("l");
    expect(categoriaDoPacote("Loja qualquer 123", cats)).toBeNull();
  });
});


describe("fluxoDiario", () => {
  const oc = (o: Partial<Ocorrencia>): Ocorrencia =>
    ({ id: "x", tipo: "saida", status: "pendente", valor_previsto: 0, valor_real: null, vencimento: "2026-03-10", pago_em: null, ...o }) as Ocorrencia;
  it("acha o ponto mais baixo e o dia em que fica negativo", () => {
    const f = fluxoDiario(
      [
        oc({ valor_previsto: 80000, vencimento: "2026-03-05" }),
        oc({ valor_previsto: 50000, vencimento: "2026-03-08" }),
        oc({ tipo: "entrada", valor_previsto: 300000, vencimento: "2026-03-10" }),
        oc({ status: "pago", valor_real: 20000, pago_em: "2026-03-02", vencimento: "2026-03-02" }),
        oc({ valor_previsto: 10000, vencimento: "2026-02-20" }),
      ],
      { valor: 150000, data: "2026-03-01" },
      "2026-03-03",
      10,
    );
    expect(f.inicial).toBe(130000);
    expect(f.dias[0].saldo).toBe(120000);
    expect(f.negativoEm).toBe("2026-03-08");
    expect(f.menor).toEqual({ data: "2026-03-08", saldo: -10000 });
    expect(f.dias.at(-1)!.saldo).toBe(290000);
  });
});
