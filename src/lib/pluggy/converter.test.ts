// Fixtures INVENTADAS no formato da API Pluggy (v2/transactions, bills).
import { describe, expect, it } from "vitest";
import { acharJaImportadas, centavos, converterTransacao, dataLocal, itensDoAmbiente, nomeBanco, nomeConta } from "./converter";
import type { PluggyFatura, PluggyTransacao } from "./tipos";

const tx = (p: Partial<PluggyTransacao>): PluggyTransacao => ({
  id: "tx-1",
  accountId: "acc-1",
  date: "2026-10-12T00:00:00.000Z",
  description: "Pix recebido Fulano",
  amount: 25,
  type: "CREDIT",
  status: "POSTED",
  category: "Transfer - PIX",
  creditCardMetadata: null,
  ...p,
});

describe("pluggy: conversão", () => {
  it("valores em centavos e datas no fuso de Fortaleza", () => {
    expect(centavos(-1234.5)).toBe(-123450);
    expect(dataLocal("2026-10-12T00:00:00.000Z")).toBe("2026-10-12");
    // 01:56 UTC do dia 30 ainda é dia 29 em Fortaleza
    expect(dataLocal("2026-10-30T01:56:00.000Z")).toBe("2026-10-29");
    expect(dataLocal("2026-10-30T15:00:00.000Z")).toBe("2026-10-30");
  });

  it("conta corrente mantém o sinal (débito negativo)", () => {
    const c = converterTransacao(tx({ amount: -100, type: "DEBIT", description: "  Pix enviado Beltrano " }), "BANK");
    expect(c).toMatchObject({ valor: -10000, descricao: "Pix enviado Beltrano", fatura_mes: null, parcela_num: null });
  });

  it("cartão: compra positiva, parcela e mês da fatura pelo billId", () => {
    const faturas: PluggyFatura[] = [{ id: "bill-9", dueDate: "2026-11-10T00:00:00.000Z", totalAmount: 900 }];
    const c = converterTransacao(
      tx({
        amount: 150,
        type: "DEBIT",
        description: "LOJA EXEMPLO PARC 2/6",
        creditCardMetadata: { installmentNumber: 2, totalInstallments: 6, billId: "bill-9", purchaseDate: "2026-09-20T00:00:00.000Z", paymentType: "INSTALLMENT" },
      }),
      "CREDIT",
      faturas,
    );
    expect(c).toMatchObject({ valor: 15000, parcela_num: 2, parcelas_total: 6, fatura_mes: "2026-11", data_compra: "2026-09-20", bill_id: "bill-9" });
    // sem fatura conhecida: usa a data prevista da fatura
    const d = converterTransacao(tx({ type: "DEBIT", creditCardMetadata: { billForecastDate: "2027-01-10T00:00:00.000Z" } }), "CREDIT");
    expect(d.fatura_mes).toBe("2027-01");
  });

  it("nome do banco: usa o conector, ou o nome da conta quando o conector é o MeuPluggy", () => {
    const contas = [{ type: "CREDIT" as const, name: "GOLD 1234" }, { type: "BANK" as const, name: "BANCO EXEMPLO 01-2" }];
    expect(nomeBanco("Banco Real Exemplo", contas)).toBe("Banco Real Exemplo");
    expect(nomeBanco("MeuPluggy", contas)).toBe("Banco Exemplo");
    expect(nomeBanco("MeuPluggy", [{ type: "BANK", name: "EXEMPLO PAGAMENTOS S.A - Instituição (Conta Pré-paga) 12-3" }])).toBe("Exemplo Pagamentos");
    expect(nomeBanco("MeuPluggy", [{ type: "BANK", name: "Exemplo Pay Instituição de Pagamento (Conta Pré-paga) 12-3" }])).toBe("Exemplo Pay");
  });

  it("nome da conta e itens por dono no ambiente", () => {
    expect(nomeConta({ id: "a", itemId: "i", type: "CREDIT", marketingName: "Cartão Exemplo Gold", number: "1234567890" })).toBe("Cartão Exemplo Gold 7890");
    expect(nomeConta({ id: "b", itemId: "i", type: "BANK", subtype: "CHECKING_ACCOUNT", name: "BANCO EXEMPLO 01-2", number: "0001-2" })).toBe("Banco Exemplo · conta 01-2");
    expect(nomeConta({ id: "c", itemId: "i", type: "BANK", subtype: "SAVINGS_ACCOUNT", name: "PICPAY INSTITUICAO DE PAGAMENTO S.A", number: "123" })).toBe("PicPay · poupança 123");
    expect(itensDoAmbiente({ PLUGGY_ITEMS_ANA: "i1, i2", PLUGGY_ITEMS_BRUNO: "", PLUGGY_CLIENT_ID: "x" })).toEqual([
      { itemId: "i1", dono: "ANA" },
      { itemId: "i2", dono: "ANA" },
    ]);
  });
});

describe("pluggy: reconhecer o que já veio por arquivo", () => {
  const imp = (id: string, data: string, valor: number, descricao: string) => ({ id, data, valor, descricao });

  it("mesma conta do arquivo: casa por valor e data (±1 dia) mesmo com texto diferente", () => {
    const importadas = [
      imp("f1", "2026-10-01", 2500, "Pix recebido · Fulano de Tal"),
      imp("f2", "2026-10-02", -10000, "Pix enviado · Mercado Exemplo"),
      imp("f3", "2026-10-03", 183, "Rendimento recebido · Rendimento de conta"),
      imp("f4", "2026-10-04", -5000, "Dinheiro guardado · No cofrinho Viagem"),
      imp("f5", "2026-10-05", 2500, "Pix recebido · Ciclano"),
    ];
    const novas = [
      { pluggy_id: "p1", data: "2026-10-01", valor: 2500, descricao: "PIX RECEBIDO DE FULANO" },
      { pluggy_id: "p2", data: "2026-10-03", valor: -10000, descricao: "PAGAMENTO PIX" }, // um dia depois
      { pluggy_id: "p3", data: "2026-10-03", valor: 183, descricao: "Rendimento" },
      { pluggy_id: "p4", data: "2026-10-04", valor: -5000, descricao: "Aplicação cofrinho" },
      { pluggy_id: "p5", data: "2026-10-05", valor: 2500, descricao: "PIX" },
      { pluggy_id: "p6", data: "2026-10-31", valor: 2500, descricao: "PIX" }, // depois do arquivo: nova
    ];
    const m = acharJaImportadas(novas, importadas);
    expect(Object.fromEntries(m)).toEqual({ p1: "f1", p2: "f2", p3: "f3", p4: "f4", p5: "f5" });
  });

  it("outra conta: não confunde valor igual no mesmo dia sem descrição parecida", () => {
    const importadas = [imp("f1", "2026-10-01", -5000, "Pix enviado · Mercado Exemplo"), imp("f2", "2026-10-02", -1000, "Pix enviado · Padaria")];
    const novas = [
      { pluggy_id: "p1", data: "2026-10-01", valor: -5000, descricao: "COMPRA POSTO DE GASOLINA" },
      { pluggy_id: "p2", data: "2026-10-05", valor: -800, descricao: "Tarifa" },
      { pluggy_id: "p3", data: "2026-10-06", valor: -900, descricao: "Tarifa" },
      { pluggy_id: "p4", data: "2026-10-07", valor: -700, descricao: "Tarifa" },
      { pluggy_id: "p5", data: "2026-10-08", valor: -600, descricao: "Tarifa" },
      { pluggy_id: "p6", data: "2026-10-02", valor: -1000, descricao: "PIX ENVIADO PADARIA" },
    ];
    expect(Object.fromEntries(acharJaImportadas(novas, importadas))).toEqual({ p6: "f2" });
  });

  it("cada importada casa uma vez só (linhas idênticas)", () => {
    const importadas = [imp("f1", "2026-10-01", -100, "Troco guardado"), imp("f2", "2026-10-01", -100, "Troco guardado")];
    const novas = ["a", "b", "c"].map((id) => ({ pluggy_id: id, data: "2026-10-01", valor: -100, descricao: "Troco guardado" }));
    const m = acharJaImportadas([...novas, ...Array.from({ length: 3 }, (_, i) => ({ pluggy_id: `x${i}`, data: "2026-10-01", valor: -100, descricao: "Troco" }))], importadas);
    expect(m.size).toBe(2);
  });
});
