// Aplicações INVENTADAS no formato de /investments da Pluggy (já convertidas).
import { describe, expect, it } from "vitest";
import { chaveGrupo, contaNoTotal, nomeGrupo, saldoPorReserva, type InvestimentoGrupo } from "./grupos";

const inv = (p: Partial<InvestimentoGrupo>): InvestimentoGrupo => ({
  id: "i1",
  pluggy_item_id: "item-a",
  tipo: "FIXED_INCOME",
  subtipo: "CDB",
  saldo: 10000,
  status: "ACTIVE",
  vencimento: "2029-01-01",
  reserva_id: null,
  ...p,
});

describe("grupos de investimentos", () => {
  const hoje = "2026-10-31";

  it("só entra no total aplicação ativa, com saldo e não vencida", () => {
    expect(contaNoTotal(inv({}), hoje)).toBe(true);
    expect(contaNoTotal(inv({ status: "TOTAL_WITHDRAWAL", saldo: 0 }), hoje)).toBe(false);
    expect(contaNoTotal(inv({ saldo: 0 }), hoje)).toBe(false);
    expect(contaNoTotal(inv({ vencimento: "2026-10-01" }), hoje)).toBe(false);
    expect(contaNoTotal(inv({ vencimento: null }), hoje)).toBe(true);
  });

  it("chave junta mesmo item e mesmo tipo", () => {
    expect(chaveGrupo(inv({}))).toBe(chaveGrupo(inv({ id: "i2", saldo: 5 })));
    expect(chaveGrupo(inv({}))).not.toBe(chaveGrupo(inv({ subtipo: "STOCK", tipo: "EQUITY" })));
    expect(chaveGrupo(inv({}))).not.toBe(chaveGrupo(inv({ pluggy_item_id: "item-b" })));
  });

  it("nomes legíveis por dono, banco e tipo", () => {
    expect(nomeGrupo("FIXED_INCOME", "CDB", "Picpay", "Ana")).toBe("Caixinhas PicPay (Ana)");
    expect(nomeGrupo("EQUITY", "STOCK", "Banco Exemplo", "Bruno")).toBe("Ações Banco Exemplo (Bruno)");
    expect(nomeGrupo("FIXED_INCOME", "CDB", "Banco Exemplo", null)).toBe("CDBs Banco Exemplo");
    expect(nomeGrupo("MUTUAL_FUND", "INVESTMENT_FUND", null, "Ana")).toBe("Fundos (Ana)");
  });

  it("saldo por reserva soma só o que entra no total", () => {
    const m = saldoPorReserva(
      [
        inv({ id: "a", reserva_id: "r1", saldo: 10000 }),
        inv({ id: "b", reserva_id: "r1", saldo: 2500 }),
        inv({ id: "c", reserva_id: "r1", saldo: 0, status: "TOTAL_WITHDRAWAL" }),
        inv({ id: "d", reserva_id: "r2", saldo: 999, vencimento: "2026-01-01" }),
        inv({ id: "e", reserva_id: null, saldo: 777 }),
      ],
      hoje,
    );
    expect(Object.fromEntries(m)).toEqual({ r1: 12500, r2: 0 });
  });
});
