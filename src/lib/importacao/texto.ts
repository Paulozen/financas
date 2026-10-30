// Decodificação de arquivos de texto (UTF-8 com/sem BOM, UTF-16, Latin-1).

export function decodificar(bytes: Uint8Array): string {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return new TextDecoder("utf-8").decode(bytes.subarray(3));
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder("utf-16le").decode(bytes.subarray(2));
  if (bytes[0] === 0xfe && bytes[1] === 0xff) return new TextDecoder("utf-16be").decode(bytes.subarray(2));
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    // Não é UTF-8 válido: bancos brasileiros costumam usar Windows-1252 (Latin-1).
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Minúsculas, sem acentos e espaços repetidos. */
export function semAcentos(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Descrição normalizada para regras aprendidas: sem acentos, sem números
 * (datas, códigos) e sem pontuação.
 */
export function normalizarDescricao(s: string): string {
  return semAcentos(s)
    .replace(/[0-9]+/g, " ")
    .replace(/[^a-z ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
