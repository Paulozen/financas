// Exportação CSV (ideia do Securo): separador ";" e vírgula decimal, que o Excel em
// português abre direto; BOM para os acentos.
import { formatarNumero } from "./dinheiro";
import type { Ocorrencia } from "./tipos";

const celula = (v: string) => (/[";\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function ocorrenciasCsv(lista: Ocorrencia[], nomeCategoria: (id: string | null) => string, nomeDono: (id: string | null) => string): string {
  const linhas = [["Vencimento", "Descrição", "Tipo", "Categoria", "Dono", "Status", "Previsto", "Pago", "Pago em", "Dinheiro guardado"]];
  for (const o of lista)
    linhas.push([
      o.vencimento,
      o.descricao,
      o.tipo === "entrada" ? "Entrada" : "Saída",
      o.categoria_id ? nomeCategoria(o.categoria_id) : "Sem categoria",
      nomeDono(o.dono_membro_id),
      o.status,
      formatarNumero(o.valor_previsto),
      o.valor_real !== null ? formatarNumero(o.valor_real) : "",
      o.pago_em ?? "",
      o.paga_com_reserva ? "sim" : "",
    ]);
  return "﻿" + linhas.map((l) => l.map(celula).join(";")).join("\r\n");
}

export function baixarArquivo(nome: string, conteudo: string, tipo = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([conteudo], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nome;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
