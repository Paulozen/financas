import { describe, expect, it } from "vitest";
import { resumoContrato, resumoDivida } from "./compromissos";
import type { Contrato, Divida, Ocorrencia } from "./tipos";

function oc(p: Partial<Ocorrencia>): Ocorrencia {
  return {
    id: Math.random().toString(36),
    casa_id: "c",
    origem_tipo: "parcela_contrato",
    origem_id: "k1",
    chave: null,
    descricao: "x",
    tipo: "saida",
    dono_membro_id: null,
    categoria_id: null,
    valor_previsto: 100000,
    valor_real: null,
    previsto_manual: false,
    vencimento: "2026-11-15",
    pago_em: null,
    status: "pendente",
    observacao: null,
    fonte: null,
    parcela_num: null,
    transacao_importada_id: null,
    ...p,
  };
}

describe("resumos", () => {
  it("parcelado soma pagas antes do app e o valor real pago", () => {
    const c = { id: "k1", valor_total: 1000000, num_parcelas: 10, parcelas_pagas_antes: 2, valor_pago_antes: 200000 } as Contrato;
    const r = resumoContrato(c, [
      oc({ parcela_num: 3, status: "pago", valor_real: 104500 }),
      oc({ parcela_num: 4 }),
    ]);
    expect(r).toMatchObject({ pagas: 3, restantes: 7, totalPago: 304500, saldoDevedor: 695500 });
  });

  it("dívida: restante, percentual e quitação", () => {
    const d = { id: "d1", valor_total: 500000 } as Divida;
    const pag = (v: number) => oc({ origem_tipo: "pagamento_divida", origem_id: "d1", status: "pago", valor_real: v, pago_em: "2026-10-01" });
    expect(resumoDivida(d, [pag(100000)])).toMatchObject({ pago: 100000, restante: 400000, percentual: 20, quitada: false });
    expect(resumoDivida(d, [pag(300000), pag(200000)]).quitada).toBe(true);
  });
});
