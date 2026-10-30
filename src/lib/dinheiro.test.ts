import { describe, expect, it } from "vitest";
import { formatarNumero, formatarReais, lerValor, mascararDigitos } from "./dinheiro";

describe("dinheiro", () => {
  it("formata em reais", () => {
    expect(formatarReais(123456)).toBe("R$ 1.234,56");
    expect(formatarReais(5)).toBe("R$ 0,05");
    expect(formatarNumero(-100000)).toBe("-1.000,00");
  });

  it("lê formatos brasileiros", () => {
    expect(lerValor("1.234,56")).toBe(123456);
    expect(lerValor("-1.234,56")).toBe(-123456);
    expect(lerValor("+R$ 1,83")).toBe(183);
    expect(lerValor("−R$ 100,00")).toBe(-10000);
    expect(lerValor("-R$ 100,00")).toBe(-10000);
    expect(lerValor("(50,00)")).toBe(-5000);
    expect(lerValor("1234.5")).toBe(123450);
    expect(lerValor("1.234")).toBe(123400);
    expect(lerValor("abc")).toBeNull();
    expect(lerValor("")).toBeNull();
    expect(lerValor(12.34)).toBe(1234);
  });

  it("máscara de dígitos", () => {
    expect(mascararDigitos("R$ 1.234,56")).toBe(123456);
    expect(mascararDigitos("")).toBe(0);
  });
});
