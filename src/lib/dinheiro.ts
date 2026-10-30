// Dinheiro sempre em centavos (inteiro).

const formatador = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** 123456 -> "R$ 1.234,56" */
export function formatarReais(centavos: number): string {
  // Intl usa espaço inseparável; trocamos por espaço comum para facilitar testes e cópia.
  return formatador.format(centavos / 100).replace(/ /g, " ");
}

/** 123456 -> "1.234,56" (sem símbolo, para inputs) */
export function formatarNumero(centavos: number): string {
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const inteiro = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const dec = (abs % 100).toString().padStart(2, "0");
  return `${negativo ? "-" : ""}${inteiro},${dec}`;
}

/**
 * Converte texto em formato brasileiro para centavos.
 * Aceita "1.234,56", "-1.234,56", "R$ 1,83", "+R$ 1,83", "−R$ 100,00" (U+2212),
 * "(100,00)" e também "1234.56" quando não há vírgula.
 * Retorna null se não for um número.
 */
export function lerValor(texto: string | number | null | undefined): number | null {
  if (texto === null || texto === undefined) return null;
  if (typeof texto === "number") {
    return Number.isFinite(texto) ? Math.round(texto * 100) : null;
  }
  let s = texto.trim();
  if (!s) return null;
  let negativo = false;
  if (/^\(.*\)$/.test(s)) {
    negativo = true;
    s = s.slice(1, -1);
  }
  // Menos Unicode (U+2212), traço (U+2013) e hífen.
  s = s.replace(/[−–]/g, "-");
  if (s.includes("-")) negativo = true;
  s = s.replace(/R\$|\s|\+|-/g, "");
  if (/[dD]$/.test(s)) {
    negativo = true;
    s = s.slice(0, -1);
  } else if (/[cC]$/.test(s)) {
    s = s.slice(0, -1);
  }
  if (!s) return null;
  let normal: string;
  if (s.includes(",")) {
    normal = s.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(s)) {
    normal = s.replace(/\./g, "");
  } else {
    normal = s;
  }
  if (!/^\d+(\.\d+)?$/.test(normal)) return null;
  const centavos = Math.round(parseFloat(normal) * 100);
  return negativo ? -centavos : centavos;
}

/** Máscara de input: mantém só dígitos e interpreta como centavos. */
export function mascararDigitos(texto: string): number {
  const digitos = texto.replace(/\D/g, "").slice(0, 13);
  return digitos ? parseInt(digitos, 10) : 0;
}
