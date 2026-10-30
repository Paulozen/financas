import { describe, expect, it } from "vitest";
import { mediaUltimos3, OBS_META_CUMPRIDA, OBS_META_NAO_CUMPRIDA, planejar, type NovaOcorrencia } from "./motor";
import type { Contrato, Divida, Ocorrencia, Recorrencia } from "./tipos";

const CASA = "casa-1";
const HOJE = "2026-10-30";

function regra(p: Partial<Recorrencia> = {}): Recorrencia {
  return {
    id: "r1",
    casa_id: CASA,
    descricao: "Aluguel",
    tipo: "saida",
    modo: "fixa",
    valor: 150000,
    valor_manual: false,
    dia: 10,
    inicio: "2026-10-01",
    fim: null,
    dono_membro_id: null,
    categoria_id: "cat-moradia",
    cartao_id: null,
    ativa: true,
    criado_em: "2026-10-01T12:00:00Z",
    ...p,
  };
}

let seq = 0;
/** Converte uma ocorrência planejada em "existente no banco". */
function existente(n: NovaOcorrencia, p: Partial<Ocorrencia> = {}): Ocorrencia {
  return {
    id: `o${++seq}`,
    previsto_manual: false,
    fonte: null,
    transacao_importada_id: null,
    ...n,
    ...p,
  };
}

describe("motor: recorrências", () => {
  it("gera do mês de início até 12 meses à frente", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [regra()], contratos: [], dividas: [], ocorrencias: [] });
    expect(p.inserir).toHaveLength(13); // out/26 .. out/27
  });

  it("é idempotente: rodar de novo não gera nada", () => {
    const r = regra();
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    const existentes = p1.inserir.map((n) => existente(n));
    const p2 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: existentes });
    expect(p2).toEqual({ inserir: [], atualizar: [], remover: [] });
  });

  it("respeita o fim e limita o dia ao fim do mês", () => {
    const r = regra({ dia: 31, fim: "2027-03-15" });
    const p = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    expect(p.inserir.map((o) => o.vencimento)).toEqual(["2026-10-31", "2026-11-30", "2026-12-31", "2027-01-31", "2027-02-28"]);
  });

  it("não gera meses anteriores ao cadastro da regra", () => {
    const r = regra({ inicio: "2024-01-01", criado_em: "2026-09-15T10:00:00Z" });
    const p = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    expect(p.inserir[0].vencimento).toBe("2026-09-10");
  });

  it("cartão gera ocorrências do tipo fatura", () => {
    const r = regra({ cartao_id: "c1", modo: "variavel" });
    const p = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    expect(p.inserir.every((o) => o.origem_tipo === "fatura")).toBe(true);
  });

  it("editar a regra muda só as futuras pendentes; pagas e atrasadas ficam", () => {
    const r = regra({ inicio: "2026-09-01", criado_em: "2026-09-01T00:00:00Z" });
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    const exist = p1.inserir.map((n) =>
      n.vencimento === "2026-09-10"
        ? existente(n, { status: "pago", valor_real: 150000, pago_em: "2026-09-10" })
        : existente(n),
    );
    const editada = { ...r, valor: 170000, descricao: "Aluguel novo" };
    const p2 = planejar({ hoje: HOJE, recorrencias: [editada], contratos: [], dividas: [], ocorrencias: exist });
    const ids = new Set(p2.atualizar.map((a) => a.id));
    const paga = exist.find((o) => o.vencimento === "2026-09-10")!;
    const atrasada = exist.find((o) => o.vencimento === "2026-10-10")!; // antes de hoje (30/10)
    expect(ids.has(paga.id)).toBe(false);
    expect(ids.has(atrasada.id)).toBe(false);
    expect(p2.atualizar).toHaveLength(exist.length - 2);
    expect(p2.atualizar[0].campos).toEqual({ descricao: "Aluguel novo", valor_previsto: 170000 });
  });

  it("não sobrescreve previsto ajustado manualmente", () => {
    const r = regra();
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    const exist = p1.inserir.map((n) => existente(n, { previsto_manual: true, valor_previsto: 99 }));
    const p2 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: exist });
    expect(p2.atualizar).toHaveLength(0);
  });

  it("encurtar o fim remove só as futuras pendentes que sobraram", () => {
    const r = regra();
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    const exist = p1.inserir.map((n) => existente(n));
    const p2 = planejar({ hoje: HOJE, recorrencias: [{ ...r, fim: "2026-12-31" }], contratos: [], dividas: [], ocorrencias: exist });
    expect(p2.remover).toHaveLength(exist.length - 3);
  });

  it("regra desativada remove futuras pendentes", () => {
    const r = regra();
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    const exist = p1.inserir.map((n) => existente(n));
    const p2 = planejar({ hoje: HOJE, recorrencias: [{ ...r, ativa: false }], contratos: [], dividas: [], ocorrencias: exist });
    // a de 10/10 já venceu (atrasada) e fica
    expect(p2.remover).toHaveLength(exist.length - 1);
  });
});

describe("motor: variáveis", () => {
  it("média dos últimos 3 pagos", () => {
    const mk = (venc: string, valor: number, status: "pago" | "pendente" = "pago") =>
      ({ vencimento: venc, valor_real: status === "pago" ? valor : null, status }) as Ocorrencia;
    expect(mediaUltimos3([])).toBeNull();
    expect(
      mediaUltimos3([mk("2026-01-05", 100), mk("2026-02-05", 200), mk("2026-03-05", 300), mk("2026-04-05", 400), mk("2026-05-05", 0, "pendente")]),
    ).toBe(300);
  });

  it("usa a média nos meses futuros, ou o valor informado se ainda não houver pagos", () => {
    const r = regra({ modo: "variavel", valor: 20000, descricao: "Luz", inicio: "2026-07-01", criado_em: "2026-07-01T00:00:00Z" });
    const p1 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    expect(p1.inserir.every((o) => o.valor_previsto === 20000)).toBe(true);
    const pagos: Record<string, number> = { "2026-07-10": 18000, "2026-08-10": 21000, "2026-09-10": 24000 };
    const exist = p1.inserir.map((n) =>
      pagos[n.vencimento] ? existente(n, { status: "pago", valor_real: pagos[n.vencimento], pago_em: n.vencimento }) : existente(n),
    );
    const p2 = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: exist });
    // futuras (>= 30/10) passam para a média 21000; a de 10/10 (atrasada) não muda
    expect(p2.atualizar.length).toBe(12);
    expect(p2.atualizar.every((a) => a.campos.valor_previsto === 21000)).toBe(true);
  });

  it("valor manual da regra vence a média", () => {
    const r = regra({ modo: "variavel", valor: 30000, valor_manual: true });
    const p = planejar({ hoje: HOJE, recorrencias: [r], contratos: [], dividas: [], ocorrencias: [] });
    expect(p.inserir[0].valor_previsto).toBe(30000);
  });
});

describe("motor: parcelados", () => {
  const contrato: Contrato = {
    id: "k1",
    casa_id: CASA,
    nome: "Apartamento",
    credor: "Construtora",
    valor_total: 6000000,
    num_parcelas: 60,
    valor_parcela: 100000,
    dia: 15,
    primeira_parcela: "2025-01-15",
    parcelas_pagas_antes: 22,
    valor_pago_antes: 2200000,
    dono_membro_id: null,
    categoria_id: null,
  };

  it("gera as parcelas restantes dentro do horizonte, numeradas", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [contrato], dividas: [], ocorrencias: [] });
    expect(p.inserir[0]).toMatchObject({ parcela_num: 23, vencimento: "2026-11-15", descricao: "Apartamento 23/60" });
    expect(p.inserir.at(-1)!.vencimento).toBe("2027-10-15");
  });

  it("para na última parcela", () => {
    const p = planejar({
      hoje: HOJE,
      recorrencias: [],
      contratos: [{ ...contrato, num_parcelas: 24 }],
      dividas: [],
      ocorrencias: [],
    });
    expect(p.inserir.map((o) => o.parcela_num)).toEqual([23, 24]);
  });
});

describe("motor: meta de dívida", () => {
  const divida: Divida = {
    id: "d1",
    casa_id: CASA,
    credor: "Pai",
    descricao: "Carro",
    valor_total: 1000000,
    inicio: "2026-08-05",
    meta_mensal: 100000,
    dono_membro_id: null,
    categoria_id: null,
  };

  function pagamento(valor: number, data: string): Ocorrencia {
    return {
      id: `p${++seq}`,
      casa_id: CASA,
      origem_tipo: "pagamento_divida",
      origem_id: "d1",
      chave: null,
      descricao: "Pagamento",
      tipo: "saida",
      dono_membro_id: null,
      categoria_id: null,
      valor_previsto: valor,
      valor_real: valor,
      previsto_manual: false,
      vencimento: data,
      pago_em: data,
      status: "pago",
      observacao: null,
      fonte: null,
      parcela_num: null,
      transacao_importada_id: null,
    };
  }

  it("gera uma meta por mês a partir do mês atual", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [] });
    expect(p.inserir).toHaveLength(10); // 10.000 / 1.000 = 10 meses
    expect(p.inserir[0]).toMatchObject({ vencimento: "2026-10-05", valor_previsto: 100000, status: "pendente" });
  });

  it("pagamento avulso abate a meta do mês", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [pagamento(30000, "2026-10-12")] });
    expect(p.inserir[0]).toMatchObject({ valor_previsto: 70000, status: "pendente" });
  });

  it("pagamento maior ou igual à meta cumpre a meta (não conta de novo)", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [pagamento(150000, "2026-10-12")] });
    expect(p.inserir[0]).toMatchObject({ status: "pago", valor_real: 0, observacao: OBS_META_CUMPRIDA });
    // restante 850.000 -> 9 meses (8 x 1.000 + 1 x 500)
    expect(p.inserir.slice(1).map((o) => o.valor_previsto)).toEqual([100000, 100000, 100000, 100000, 100000, 100000, 100000, 100000, 50000]);
  });

  it("desfazer o pagamento volta a meta para pendente", () => {
    const pag = pagamento(150000, "2026-10-12");
    const p1 = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [pag] });
    const exist = p1.inserir.map((n) => existente(n));
    const p2 = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: exist });
    expect(p2.atualizar[0].campos).toMatchObject({ status: "pendente", valor_previsto: 100000 });
  });

  it("meta de mês passado não cumprida é cancelada", () => {
    const antiga = existente({
      casa_id: CASA,
      origem_tipo: "meta_divida",
      origem_id: "d1",
      chave: "meta:d1:2026-09",
      descricao: "Meta: Carro",
      tipo: "saida",
      dono_membro_id: null,
      categoria_id: null,
      valor_previsto: 100000,
      vencimento: "2026-09-05",
      parcela_num: null,
      status: "pendente",
      valor_real: null,
      pago_em: null,
      observacao: null,
    });
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [antiga] });
    expect(p.atualizar).toContainEqual({ id: antiga.id, campos: { status: "cancelado", observacao: OBS_META_NAO_CUMPRIDA } });
  });

  it("dívida quitada não gera metas", () => {
    const p = planejar({ hoje: HOJE, recorrencias: [], contratos: [], dividas: [divida], ocorrencias: [pagamento(1000000, "2026-10-01")] });
    expect(p.inserir.every((o) => o.status === "pago")).toBe(true);
    expect(p.inserir).toHaveLength(1);
  });
});
