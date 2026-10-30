// Leitura de OFX (SGML ou XML): só o que importa das transações.
import { lerData } from "../datas";
import { lerValor } from "../dinheiro";

export interface TransacaoOFX {
  fitid: string;
  data: string;
  valor: number;
  descricao: string;
  tipo: string;
}

function tag(bloco: string, nome: string): string {
  const m = bloco.match(new RegExp(`<${nome}>([^<\\r\\n]*)`, "i"));
  return m ? m[1].trim() : "";
}

export function ehOFX(texto: string): boolean {
  return /<OFX>/i.test(texto) || /OFXHEADER/i.test(texto);
}

export function lerOFX(texto: string): TransacaoOFX[] {
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const lista: TransacaoOFX[] = [];
  for (const b of blocos) {
    const bloco = b.split(/<\/STMTTRN>/i)[0];
    const data = lerData(tag(bloco, "DTPOSTED"));
    const valor = lerValor(tag(bloco, "TRNAMT"));
    if (!data || valor === null) continue;
    const memo = tag(bloco, "MEMO");
    const nome = tag(bloco, "NAME");
    lista.push({
      fitid: tag(bloco, "FITID"),
      data,
      valor,
      descricao: [nome, memo].filter(Boolean).join(" - ") || tag(bloco, "TRNTYPE"),
      tipo: tag(bloco, "TRNTYPE"),
    });
  }
  return lista;
}
