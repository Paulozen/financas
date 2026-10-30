// Leitura de CSV com aspas, separador ";" ou "," (ou tab) e quebras CRLF.

export function detectarSeparador(texto: string): string {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim()).slice(0, 20);
  let melhor = ",";
  let melhorPontos = -1;
  for (const sep of [";", ",", "\t"]) {
    const contagens = linhas.map((l) => contarForaDeAspas(l, sep));
    const comSep = contagens.filter((c) => c > 0);
    if (!comSep.length) continue;
    // Prefere o separador que aparece de forma consistente (mesma contagem) e com mais colunas.
    const moda = modaDe(comSep);
    const consistentes = comSep.filter((c) => c === moda).length;
    const pontos = consistentes * 100 + moda;
    if (pontos > melhorPontos) {
      melhor = sep;
      melhorPontos = pontos;
    }
  }
  return melhor;
}

function contarForaDeAspas(linha: string, sep: string): number {
  let n = 0;
  let aspas = false;
  for (const c of linha) {
    if (c === '"') aspas = !aspas;
    else if (c === sep && !aspas) n++;
  }
  return n;
}

function modaDe(nums: number[]): number {
  const m = new Map<number, number>();
  for (const n of nums) m.set(n, (m.get(n) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0])[0][0];
}

export function lerCSV(texto: string, separador = detectarSeparador(texto)): string[][] {
  const t = texto.replace(/^﻿/, "");
  const linhas: string[][] = [];
  let linha: string[] = [];
  let campo = "";
  let aspas = false;
  for (let i = 0; i < t.length; i++) {
    const c = t[i];
    if (aspas) {
      if (c === '"') {
        if (t[i + 1] === '"') {
          campo += '"';
          i++;
        } else aspas = false;
      } else campo += c;
      continue;
    }
    if (c === '"') aspas = true;
    else if (c === separador) {
      linha.push(campo);
      campo = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && t[i + 1] === "\n") i++;
      linha.push(campo);
      linhas.push(linha);
      linha = [];
      campo = "";
    } else campo += c;
  }
  if (campo !== "" || linha.length) {
    linha.push(campo);
    linhas.push(linha);
  }
  return linhas.map((l) => l.map((c) => c.trim())).filter((l) => l.some((c) => c !== ""));
}
