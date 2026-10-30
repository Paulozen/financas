import { describe, expect, it } from "vitest";
import { dataNoMes, difMeses, formatarData, hojeISO, lerData, somarMeses } from "./datas";

describe("datas", () => {
  it("usa o fuso de Fortaleza", () => {
    // 02:00 UTC do dia 31 ainda é dia 30 em Fortaleza (UTC-3)
    expect(hojeISO(new Date("2026-10-31T02:00:00Z"))).toBe("2026-10-30");
  });
  it("aritmética de meses", () => {
    expect(somarMeses("2026-11", 2)).toBe("2027-01");
    expect(somarMeses("2026-01", -1)).toBe("2025-12");
    expect(difMeses("2026-10", "2027-02")).toBe(4);
    expect(dataNoMes("2027-02", 31)).toBe("2027-02-28");
  });
  it("lê e formata", () => {
    expect(lerData("29/10/2026")).toBe("2026-10-29");
    expect(lerData("2026-10-29")).toBe("2026-10-29");
    expect(lerData("20261029120000[-3:BRT]")).toBe("2026-10-29");
    expect(lerData("31/02/2026")).toBeNull();
    expect(formatarData("2026-10-29")).toBe("29/10/2026");
  });
});
