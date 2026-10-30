"use client";

import { useSyncExternalStore } from "react";

// Paleta dos gráficos: ordem categórica fixa validada para daltonismo,
// com passos próprios para o modo escuro (não é inversão automática).
const CATEGORICA = {
  claro: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  escuro: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

export interface CoresGrafico {
  serie: string[];
  /** polaridade: positivo / negativo */
  positivo: string;
  negativo: string;
  texto: string;
  textoSecundario: string;
  grade: string;
  superficie: string;
}

const consulta = "(prefers-color-scheme: dark)";

function assinar(cb: () => void) {
  const m = window.matchMedia(consulta);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
}

/** Cores dos gráficos conforme o tema do sistema. */
export function useCoresGrafico(): CoresGrafico {
  const escuro = useSyncExternalStore(
    assinar,
    () => window.matchMedia(consulta).matches,
    () => false,
  );
  return escuro
    ? {
        serie: CATEGORICA.escuro,
        positivo: "#3987e5",
        negativo: "#e66767",
        texto: "#f0efec",
        textoSecundario: "#c3c2b7",
        grade: "#383835",
        superficie: "#0f172a",
      }
    : {
        serie: CATEGORICA.claro,
        positivo: "#2a78d6",
        negativo: "#d03b3b",
        texto: "#0b0b0b",
        textoSecundario: "#52514e",
        grade: "#e5e4df",
        superficie: "#ffffff",
      };
}

/** "R$ 12,3 mil" para eixos. */
export function reaisCurto(centavos: number): string {
  const v = centavos / 100;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `${(v / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `${(v / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mil`;
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 0 });
}
