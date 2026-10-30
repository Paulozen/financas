// Gera os ícones PNG do PWA (casa com moeda) sem dependências externas.
// Uso: node scripts/gerar-icones.mjs
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const VERDE = [5, 150, 105];
const BRANCO = [255, 255, 255];
const OURO = [251, 191, 36];
const OURO_ESCURO = [217, 119, 6];

function dentroRetArredondado(x, y, r) {
  const cx = Math.min(Math.max(x, r), 1 - r);
  const cy = Math.min(Math.max(y, r), 1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function dentroTriangulo(px, py, [ax, ay], [bx, by], [cx, cy]) {
  const s = (x1, y1, x2, y2, x3, y3) => (x1 - x3) * (y2 - y3) - (x2 - x3) * (y1 - y3);
  const d1 = s(px, py, ax, ay, bx, by);
  const d2 = s(px, py, bx, by, cx, cy);
  const d3 = s(px, py, cx, cy, ax, ay);
  const neg = d1 < 0 || d2 < 0 || d3 < 0;
  const pos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(neg && pos);
}

/** Cor no ponto (u, v) do ícone, coordenadas 0..1. null = transparente. */
function cor(u, v, maskable) {
  if (!maskable && !dentroRetArredondado(u, v, 0.22)) return null;
  // conteúdo dentro da zona segura (maskable) ou com margem
  const escala = maskable ? 0.72 : 0.86;
  const x = (u - 0.5) / escala + 0.5;
  const y = (v - 0.5) / escala + 0.5;
  const moeda = (x - 0.5) ** 2 + (y - 0.63) ** 2;
  if (moeda <= 0.075 ** 2) return OURO;
  if (moeda <= 0.11 ** 2) return OURO_ESCURO;
  if (moeda <= 0.125 ** 2) return BRANCO;
  if (dentroTriangulo(x, y, [0.5, 0.16], [0.13, 0.48], [0.87, 0.48])) return BRANCO;
  if (x >= 0.24 && x <= 0.76 && y >= 0.44 && y <= 0.82) return BRANCO;
  return VERDE;
}

function png(tamanho, maskable) {
  const amostras = 4;
  const linhas = [];
  for (let py = 0; py < tamanho; py++) {
    const linha = Buffer.alloc(1 + tamanho * 4);
    for (let px = 0; px < tamanho; px++) {
      let r = 0, g = 0, b = 0, a = 0;
      for (let sy = 0; sy < amostras; sy++) {
        for (let sx = 0; sx < amostras; sx++) {
          const c = cor((px + (sx + 0.5) / amostras) / tamanho, (py + (sy + 0.5) / amostras) / tamanho, maskable);
          if (c) {
            r += c[0]; g += c[1]; b += c[2]; a += 255;
          }
        }
      }
      const n = amostras * amostras;
      const cobertura = a / 255;
      const o = 1 + px * 4;
      linha[o] = cobertura ? Math.round(r / cobertura) : 0;
      linha[o + 1] = cobertura ? Math.round(g / cobertura) : 0;
      linha[o + 2] = cobertura ? Math.round(b / cobertura) : 0;
      linha[o + 3] = Math.round(a / n);
    }
    linhas.push(linha);
  }
  const crcTabela = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc = (buf) => {
    let c = 0xffffffff;
    for (const byte of buf) c = crcTabela[(c ^ byte) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const bloco = (tipo, dados) => {
    const t = Buffer.from(tipo, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(dados.length);
    const c = Buffer.alloc(4);
    c.writeUInt32BE(crc(Buffer.concat([t, dados])));
    return Buffer.concat([len, t, dados, c]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(tamanho, 0);
  ihdr.writeUInt32BE(tamanho, 4);
  ihdr[8] = 8; // bits
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    bloco("IHDR", ihdr),
    bloco("IDAT", zlib.deflateSync(Buffer.concat(linhas), { level: 9 })),
    bloco("IEND", Buffer.alloc(0)),
  ]);
}

const saida = path.join(raiz, "public", "icons");
fs.mkdirSync(saida, { recursive: true });
fs.writeFileSync(path.join(saida, "icon-192.png"), png(192, false));
fs.writeFileSync(path.join(saida, "icon-512.png"), png(512, false));
fs.writeFileSync(path.join(saida, "maskable-512.png"), png(512, true));
fs.writeFileSync(path.join(raiz, "src", "app", "apple-icon.png"), png(180, true));
fs.writeFileSync(path.join(raiz, "src", "app", "icon.png"), png(64, false));
console.log("Ícones gerados.");
