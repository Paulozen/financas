import { describe, expect, it } from "vitest";
import { aplicarRegras, bateRegra, validarRegra, type Regra } from "./regras";
import { citaConta, paresDeTransferencia } from "./transferencias";

const regra = (r: Partial<Regra>): Regra => ({
  id: Math.random().toString(36),
  nome: "r",
  operador: "and",
  condicoes: [],
  categoria_id: null,
  ignorar: false,
  nova_descricao: null,
  prioridade: 100,
  ativa: true,
  ...r,
});

describe("motor de regras", () => {
  it("compara sem acentos e sem maiúsculas, com grupos E/OU", () => {
    const r = regra({
      condicoes: [
        { campo: "valor", op: "menor", valor: "0" },
        { operador: "or", condicoes: [{ campo: "descricao", op: "contem", valor: "uber" }, { campo: "descricao", op: "comeca_com", valor: "99" }] },
      ],
    });
    expect(bateRegra(r, { descricao: "UBER *TRIP", valor: -2500 })).toBe(true);
    expect(bateRegra(r, { descricao: "99 Tecnologia", valor: -1800 })).toBe(true);
    expect(bateRegra(r, { descricao: "UBER *TRIP", valor: 2500 })).toBe(false);
    expect(bateRegra(regra({ condicoes: [{ campo: "descricao", op: "contem", valor: "farmacia" }] }), { descricao: "FARMÁCIA EXEMPLO", valor: -1 })).toBe(true);
  });
  it("valor em branco nunca bate; regex vazia é recusada", () => {
    expect(bateRegra(regra({ condicoes: [{ campo: "descricao", op: "contem", valor: " " }] }), { descricao: "x", valor: -1 })).toBe(false);
    expect(validarRegra({ nome: "a", condicoes: [{ campo: "descricao", op: "regex", valor: "x*" }], categoria_id: "c", ignorar: false, nova_descricao: null })).toMatch(/vazio/);
    expect(validarRegra({ nome: "a", condicoes: [{ campo: "descricao", op: "regex", valor: "(" }], categoria_id: "c", ignorar: false, nova_descricao: null })).toMatch(/inválida/);
  });
  it("a primeira categoria por prioridade vence; ignorar e descrição somam", () => {
    const res = aplicarRegras(
      [
        regra({ nome: "geral", prioridade: 50, condicoes: [{ campo: "descricao", op: "contem", valor: "pix" }], categoria_id: "outros" }),
        regra({ nome: "especifica", prioridade: 10, condicoes: [{ campo: "descricao", op: "contem", valor: "pix enviado fulano" }], categoria_id: "casa", nova_descricao: "Diarista" }),
        regra({ nome: "desligada", prioridade: 1, ativa: false, condicoes: [{ campo: "descricao", op: "contem", valor: "pix" }], ignorar: true }),
      ],
      { descricao: "PIX ENVIADO FULANO DE TAL", valor: -15000 },
    );
    expect(res).toEqual({ categoria_id: "casa", ignorar: false, descricao: "Diarista", regras: ["especifica", "geral"] });
  });
});

describe("transferências entre contas", () => {
  it("liga só quando os dois lados concordam", () => {
    const { pares, ambiguos } = paresDeTransferencia([
      { id: "a", conta_id: "c1", data: "2026-03-01", valor: -10000, descricao: "Pix enviado" },
      { id: "b", conta_id: "c2", data: "2026-03-02", valor: 10000, descricao: "Pix recebido" },
      { id: "c", conta_id: "c1", data: "2026-03-05", valor: -5000, descricao: "Pix" },
      { id: "d", conta_id: "c2", data: "2026-03-05", valor: 5000, descricao: "Pix" },
      { id: "e", conta_id: "c3", data: "2026-03-05", valor: 5000, descricao: "Pix" },
      { id: "f", conta_id: "c1", data: "2026-03-20", valor: -7000, descricao: "Loja" },
    ]);
    expect(pares.get("a")).toBe("b");
    expect(pares.get("b")).toBe("a");
    expect(pares.has("c")).toBe(false);
    expect(ambiguos.has("c")).toBe(true);
    expect(pares.has("f") || ambiguos.has("f")).toBe(false);
  });
  it("desempata pela conta citada na descrição", () => {
    const nomes: Record<string, string> = { c2: "Nubank · conta", c3: "Banco Inter · conta" };
    const { pares } = paresDeTransferencia(
      [
        { id: "c", conta_id: "c1", data: "2026-03-05", valor: -5000, descricao: "Transferência para NUBANK" },
        { id: "d", conta_id: "c2", data: "2026-03-05", valor: 5000, descricao: "Recebido" },
        { id: "e", conta_id: "c3", data: "2026-03-05", valor: 5000, descricao: "Recebido" },
      ],
      (id) => nomes[id] ?? "",
    );
    expect(pares.get("c")).toBe("d");
  });
  it("palavras genéricas não identificam conta", () => {
    expect(citaConta("PAGAMENTO CONTA CORRENTE", "Conta corrente")).toBe(false);
    expect(citaConta("NUBANK*IFOOD", "Nubank · conta 97-9")).toBe(true);
  });
});
