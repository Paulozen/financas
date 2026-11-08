"use client";

// "Esconder valores" (botão do olho): fica salvo neste aparelho e borra todos os
// valores em reais (classe .valor-oculto) via atributo data-ocultar no <html>.
import { useSyncExternalStore } from "react";

const CHAVE = "financas:ocultar";
const ouvintes = new Set<() => void>();

function ler(): boolean {
  try {
    return localStorage.getItem(CHAVE) === "1";
  } catch {
    return false;
  }
}

function aplicar(v: boolean) {
  document.documentElement.dataset.ocultar = v ? "1" : "0";
}

export function iniciarOcultar() {
  aplicar(ler());
}

export function alternarOcultar() {
  const novo = !ler();
  try {
    localStorage.setItem(CHAVE, novo ? "1" : "0");
  } catch {
    /* sem armazenamento: vale só nesta página */
  }
  aplicar(novo);
  ouvintes.forEach((f) => f());
}

export function useOcultar(): boolean {
  return useSyncExternalStore(
    (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
    () => document.documentElement.dataset.ocultar === "1",
    () => false,
  );
}
