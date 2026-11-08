import { describe, expect, it } from "vitest";
import { resumoMesRacha, saldoRacha } from "./racha";
import { resumoGuardado, serieGuardado, serieReservas, totalGuardado } from "./reservas";
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

describe("total guardado com contas", () => {
  it("separa em conta e reservas, respeitando a visão", () => {
    const reservas = [
      { id: "r1", ativa: true, nome: "Caixinhas (A)", dono_membro_id: "a" },
      { id: "r2", ativa: true, nome: "Ações (B)", dono_membro_id: "b" },
      { id: "r3", ativa: false, nome: "Antiga", dono_membro_id: "a" },
    ] as (Reserva & { dono_membro_id: string | null })[];
    const saldos = [
      { reserva_id: "r1", data: "2026-10-30", valor: 300000 },
      { reserva_id: "r2", data: "2026-10-30", valor: 50000 },
      { reserva_id: "r3", data: "2026-10-30", valor: 999 },
    ] as ReservaSaldo[];
    const contas = [
      { id: "c1", nome: "Conta A", tipo: "BANK", ativa: true, saldo: 600000, dono_membro_id: "a" },
      { id: "c2", nome: "Conta B", tipo: "BANK", ativa: true, saldo: 10000, dono_membro_id: "b" },
      { id: "c3", nome: "Cartão", tipo: "CREDIT", ativa: true, saldo: 800000, dono_membro_id: "a" },
      { id: "c4", nome: "Zerada", tipo: "BANK", ativa: true, saldo: 0, dono_membro_id: "a" },
    ];
    const casal = resumoGuardado(reservas, saldos, contas, "casal");
    expect(casal).toMatchObject({ totalConta: 610000, totalReservas: 350000, total: 960000 });
    expect(casal.emConta.map((c) => c.nome)).toEqual(["Conta A", "Conta B"]);
    expect(resumoGuardado(reservas, saldos, contas, "a")).toMatchObject({ totalConta: 600000, totalReservas: 300000, total: 900000 });
  });
});

describe("serieGuardado", () => {
  it("começa quando todas as fontes têm histórico e repete o último valor", () => {
    const s = serieGuardado(
      [{ id: "r1" } as Reserva],
      [
        { id: "a", casa_id: "c", reserva_id: "r1", data: "2026-01-01", valor: 1000 },
        { id: "b", casa_id: "c", reserva_id: "r1", data: "2026-01-05", valor: 1500 },
        { id: "c", casa_id: "c", reserva_id: "r1", data: "2026-01-09", valor: 1700 },
      ] as ReservaSaldo[],
      [
        { conta_externa_id: "k", data: "2026-01-06", valor: 300 },
        { conta_externa_id: "k", data: "2026-01-09", valor: 200 },
        { conta_externa_id: "outra", data: "2026-01-01", valor: 999 },
      ],
      ["k"],
    );
    expect(s).toEqual([
      { data: "2026-01-06", contas: 300, reservas: 1500, total: 1800 },
      { data: "2026-01-09", contas: 200, reservas: 1700, total: 1900 },
    ]);
  });
});
