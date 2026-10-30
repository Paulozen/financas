// Fixtures ANONIMIZADAS: nomes e valores inventados, só a estrutura imita os extratos reais.
import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import type { Ocorrencia } from "../tipos";
import { detectarSeparador, lerCSV } from "./csv";
import {
  aplicarMapeamento,
  assinaturaCabecalho,
  calcularHashes,
  encontrarCabecalho,
  lerArquivo,
  PERFIL_PICPAY,
  sugerirMapeamento,
} from "./extrato";
import { lerOFX } from "./ofx";
import { candidatas, ehMovimentoInterno, sugerir } from "./sugestao";
import { decodificar, normalizarDescricao } from "./texto";

const MENOS = "−";

const CSV_PICPAY = [
  "﻿data,hora,tipo,\"origem / destino\",valor,\"forma de pagamento\"",
  `2026-10-29,22:56,"Pix recebido","Fulano de Tal","+R$ 25,00",`,
  `2026-10-29,09:54,"Pix enviado","Mercadinho Exemplo","${MENOS}R$ 1.234,56","Com saldo"`,
  `2026-10-28,08:00,"Rendimento recebido","Rendimento de conta","+R$ 0,07",`,
  `2026-10-27,10:00,"Dinheiro guardado","No cofrinho Viagem","-R$ 100,00",`,
  `2026-10-27,10:00,"Dinheiro guardado","No cofrinho Viagem","-R$ 100,00",`,
].join("\r\n");

function buffer(texto: string | Uint8Array): ArrayBuffer {
  const b = typeof texto === "string" ? new TextEncoder().encode(texto) : texto;
  return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer;
}

describe("texto", () => {
  it("decodifica UTF-8 com BOM e Latin-1", () => {
    expect(decodificar(new Uint8Array([0xef, 0xbb, 0xbf, 0x61]))).toBe("a");
    expect(decodificar(new Uint8Array([0x48, 0x69, 0x73, 0x74, 0xf3, 0x72, 0x69, 0x63, 0x6f]))).toBe("Histórico");
  });
  it("normaliza descrição para regras", () => {
    expect(normalizarDescricao("Pix recebido · JOSÉ da Silva 12/10")).toBe("pix recebido jose da silva");
  });
});

describe("CSV", () => {
  it("detecta separador e respeita aspas", () => {
    expect(detectarSeparador(CSV_PICPAY)).toBe(",");
    expect(detectarSeparador("Data;Histórico;Valor\n01/10/2026;Compra, loja;-10,00\n")).toBe(";");
    const l = lerCSV('a;"b;c";"d ""e"""\n1;2;3', ";");
    expect(l).toEqual([
      ["a", "b;c", 'd "e"'],
      ["1", "2", "3"],
    ]);
  });

  it("perfil PicPay: assinatura, valores com menos Unicode e descrição", async () => {
    const arq = await lerArquivo("extrato.csv", buffer(CSV_PICPAY));
    expect(arq.formato).toBe("tabela");
    if (arq.formato !== "tabela") return;
    expect(assinaturaCabecalho(arq.linhas[0])).toBe(PERFIL_PICPAY.assinatura);
    const { transacoes, descartadas } = aplicarMapeamento(arq.linhas, PERFIL_PICPAY.mapeamento);
    expect(descartadas).toBe(0);
    expect(transacoes[0]).toMatchObject({ data: "2026-10-29", hora: "22:56", tipo: "Pix recebido", descricao: "Pix recebido · Fulano de Tal", valor: 2500 });
    expect(transacoes[1].valor).toBe(-123456);
    expect(transacoes[3].valor).toBe(-10000);
  });

  it("banco genérico com ; Latin-1, linhas antes do cabeçalho e crédito/débito", async () => {
    const texto = "Extrato de conta\r\nAgência 0001\r\nData;Histórico;Crédito;Débito\r\n01/10/2026;Salário;5.000,00;\r\n02/10/2026;Conta de luz;;250,10\r\nSaldo;;;\r\n";
    const latin1 = Uint8Array.from([...texto].map((c) => c.charCodeAt(0)));
    const arq = await lerArquivo("banco.csv", buffer(latin1));
    if (arq.formato !== "tabela") throw new Error("formato");
    const cab = encontrarCabecalho(arq.linhas);
    expect(cab).toBe(2);
    const m = sugerirMapeamento(arq.linhas, cab);
    expect(m).toMatchObject({ data: 0, descricao: [1], valor: null, credito: 2, debito: 3 });
    const { transacoes, descartadas } = aplicarMapeamento(arq.linhas, m);
    expect(transacoes.map((t) => t.valor)).toEqual([500000, -25010]);
    expect(descartadas).toBe(1);
  });
});

describe("XLSX", () => {
  it("detecta a aba com uma única coluna de linhas CSV e reprocessa", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("in");
    for (const linha of CSV_PICPAY.replace(/^﻿/, "").split("\r\n")) ws.addRow([linha]);
    const dados = await wb.xlsx.writeBuffer();
    const arq = await lerArquivo("extrato.xlsx", dados as ArrayBuffer);
    if (arq.formato !== "tabela") throw new Error("formato");
    expect(arq.linhas[0]).toEqual(["data", "hora", "tipo", "origem / destino", "valor", "forma de pagamento"]);
    const { transacoes } = aplicarMapeamento(arq.linhas, PERFIL_PICPAY.mapeamento);
    expect(transacoes).toHaveLength(5);
    expect(transacoes[1].valor).toBe(-123456);
  });

  it("lê planilha normal com datas e números", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Extrato");
    ws.addRow(["Data", "Descrição", "Valor"]);
    ws.addRow([new Date(Date.UTC(2026, 9, 5)), "Padaria", -12.5]);
    const arq = await lerArquivo("x.xlsx", (await wb.xlsx.writeBuffer()) as ArrayBuffer);
    if (arq.formato !== "tabela") throw new Error("formato");
    const { transacoes } = aplicarMapeamento(arq.linhas, sugerirMapeamento(arq.linhas, 0));
    expect(transacoes[0]).toMatchObject({ data: "2026-10-05", descricao: "Padaria", valor: -1250 });
  });
});

describe("OFX", () => {
  const OFX = `OFXHEADER:100
<OFX><BANKMSGSRSV1><STMTTRNRS><STMTRS><BANKTRANLIST>
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20261005120000[-3:BRT]<TRNAMT>-45.90<FITID>ABC123<MEMO>Farmácia Exemplo</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20261006<TRNAMT>1500.00<FITID>ABC124<NAME>Cliente X</STMTTRN>
</BANKTRANLIST></STMTRS></STMTTRNRS></BANKMSGSRSV1></OFX>`;
  it("lê transações com FITID", async () => {
    expect(lerOFX(OFX)).toEqual([
      { fitid: "ABC123", data: "2026-10-05", valor: -4590, descricao: "Farmácia Exemplo", tipo: "DEBIT" },
      { fitid: "ABC124", data: "2026-10-06", valor: 150000, descricao: "Cliente X", tipo: "CREDIT" },
    ]);
    const arq = await lerArquivo("a.ofx", buffer(OFX));
    expect(arq.formato).toBe("ofx");
  });
});

describe("deduplicação", () => {
  it("hash estável, depende da conta e numera linhas idênticas", async () => {
    const t = { indice: 0, data: "2026-10-27", hora: "10:00", tipo: "Dinheiro guardado", descricao: "x", valor: -10000 };
    const [a, b] = await calcularHashes("picpay:m1", [t, { ...t, indice: 1 }]);
    expect(a).not.toBe(b);
    const [a2] = await calcularHashes("picpay:m1", [t]);
    expect(a2).toBe(a);
    const [outro] = await calcularHashes("picpay:m2", [t]);
    expect(outro).not.toBe(a);
  });
});

describe("sugestões", () => {
  const t = (p: Partial<{ tipo: string; descricao: string; valor: number; data: string }>) => ({
    indice: 0,
    hora: "",
    tipo: "Pix enviado",
    descricao: "Pix enviado · Fulano",
    valor: -10000,
    data: "2026-10-10",
    ...p,
  });

  it("movimentos do cofrinho viram Ignorar", () => {
    for (const tipo of ["Troco guardado", "Dinheiro guardado", "Dinheiro resgatado", "Rendimento recebido"]) {
      expect(ehMovimentoInterno({ tipo, descricao: tipo })).toBe(true);
      expect(sugerir(t({ tipo, descricao: tipo }), { regras: [], pendentes: [] }).acao).toBe("ignorar");
    }
    expect(ehMovimentoInterno({ tipo: "Pix enviado", descricao: "Pix enviado · Fulano" })).toBe(false);
  });

  it("vincula a pendente com valor próximo e data até ±5 dias", () => {
    const pend = (id: string, valor: number, venc: string, tipo: "entrada" | "saida" = "saida") =>
      ({ id, status: "pendente", tipo, valor_previsto: valor, vencimento: venc, categoria_id: "c" }) as Ocorrencia;
    const lista = [pend("longe", 10000, "2026-10-20"), pend("perto", 10300, "2026-10-12"), pend("exato", 10000, "2026-10-14"), pend("entrada", 10000, "2026-10-10", "entrada")];
    expect(candidatas(t({}), lista).map((o) => o.id)).toEqual(["exato", "perto"]);
    expect(sugerir(t({}), { regras: [], pendentes: lista })).toMatchObject({ acao: "vincular", vinculo_id: "exato" });
  });

  it("regra aprendida vence as demais; racha por valor padrão", () => {
    const regras = [{ padrao: "pix recebido fulano", acao: "racha" as const, categoria_id: null, dono_membro_id: null, racha_tipo: "mensalidade" }];
    expect(sugerir(t({ descricao: "Pix recebido · Fulano", valor: 999 }), { regras, pendentes: [] })).toMatchObject({ acao: "racha", racha_tipo: "mensalidade" });
    expect(sugerir(t({ descricao: "Pix recebido · Beltrano", valor: 500 }), { regras: [], pendentes: [], racha: { mensalidade: 2500, diaria: 500 } })).toMatchObject({
      acao: "racha",
      racha_tipo: "diaria",
    });
    expect(sugerir(t({}), { regras: [], pendentes: [] }).acao).toBe("novo");
  });
});
