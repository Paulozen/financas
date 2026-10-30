import { describe, expect, it } from "vitest";
import { resumoMesRacha, saldoRacha } from "./racha";
import { serieReservas, totalGuardado } from "./reservas";
import type { RachaMovimento, Reserva, ReservaSaldo } from "./tipos";

describe("reservas", () => {
  const reservas = [
    { id: "a", ativa: true },
    { id: "b", ativa: true },
  ] as Reserva[];
  const saldos = [
    { reserva_id: "a", data: "2026-08-01", valor: 1000 },
    { reserva_id: "b", data: "2026-09-01", valor: 500 },
    { reserva_id: "a", data: "2026-10-01", valor: 1200 },
  ] as ReservaSaldo[];

  it("total usa o saldo mais recente de cada reserva", () => {
    expect(totalGuardado(reservas, saldos)).toBe(1700);
  });

  it("série repete o último valor conhecido", () => {
    expect(serieReservas(reservas, saldos)).toEqual([
      { data: "2026-08-01", a: 1000, total: 1000 },
      { data: "2026-09-01", a: 1000, b: 500, total: 1500 },
      { data: "2026-10-01", a: 1200, b: 500, total: 1700 },
    ]);
  });
});

describe("racha", () => {
  const m = (sentido: "entrada" | "saida", valor: number, data: string) => ({ sentido, valor, data }) as RachaMovimento;
  it("saldo e resumo do mês", () => {
    const movs = [m("entrada", 2500, "2026-10-01"), m("entrada", 4000, "2026-10-08"), m("saida", 10000, "2026-10-08"), m("entrada", 500, "2026-09-30")];
    expect(saldoRacha(movs)).toBe(-3000);
    expect(resumoMesRacha(movs, "2026-10")).toEqual({ entrou: 6500, saiu: 10000 });
  });
});
