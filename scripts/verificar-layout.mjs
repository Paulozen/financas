// Verificação de layout no celular: entra com E2E_EMAIL/E2E_SENHA (.env.local), percorre
// todas as telas em 360×800 e 390×844, claro e escuro, e confere que nenhuma página
// tem rolagem horizontal (scrollWidth <= clientWidth). Tira capturas em e2e-capturas/
// (fora do Git: têm dados reais).
//
// Uso: com o app rodando (npm run build && npm start, ou npm run dev):
//   node scripts/verificar-layout.mjs [url-base]      (padrão http://localhost:3000)
//   SEM_CAPTURAS=1 node scripts/verificar-layout.mjs  (só confere, sem capturas)
//   ROTAS=/,/caixa TOPO=1 node scripts/verificar-layout.mjs  (só essas telas; captura só a primeira tela)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { chromium } from "playwright";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(raiz, ".env.local"), quiet: true });
const BASE = (process.argv[2] ?? process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
const EMAIL = process.env.E2E_EMAIL;
const SENHA = process.env.E2E_SENHA;
if (!EMAIL || !SENHA) {
  console.error("Defina E2E_EMAIL e E2E_SENHA no .env.local.");
  process.exit(1);
}
const CAPTURAS = !process.env.SEM_CAPTURAS;
const PASTA = path.join(raiz, "e2e-capturas");
if (CAPTURAS) fs.mkdirSync(PASTA, { recursive: true });

const SO_ROTAS = process.env.ROTAS?.split(",").filter(Boolean);
const TELAS = SO_ROTAS ?? ["/", "/lancamentos", "/compromissos", "/projetos", "/mais", "/caixa", "/reservas", "/racha", "/importar", "/categorias", "/configuracoes"];
const TAMANHOS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
];
const ESQUEMAS = ["light", "dark"];

/** Elementos que passam da largura da tela (para achar o culpado). */
async function culpados(page) {
  return page.evaluate(() => {
    const largura = document.documentElement.clientWidth;
    const lista = [];
    for (const el of document.querySelectorAll("body *")) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.right <= largura + 1) continue;
      // Ignora quem está dentro de um contêiner com rolagem horizontal própria.
      let p = el.parentElement;
      let rolavel = false;
      while (p && p !== document.body) {
        const ox = getComputedStyle(p).overflowX;
        if ((ox === "auto" || ox === "scroll" || ox === "hidden") && p.getBoundingClientRect().right <= largura + 1) {
          rolavel = true;
          break;
        }
        p = p.parentElement;
      }
      if (rolavel) continue;
      const nome = `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}.${String(el.className?.baseVal ?? el.className ?? "")
        .split(" ")
        .slice(0, 3)
        .join(".")}`;
      lista.push(`${nome} (direita ${Math.round(r.right)}px)`);
      if (lista.length >= 5) break;
    }
    return lista;
  });
}

const browser = await chromium.launch();
let estado;
{
  // Login uma vez; a sessão é reaproveitada nos outros tamanhos e esquemas.
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', SENHA);
  await page.click('button[type="submit"]');
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }).catch(() => {});
  if (new URL(page.url()).pathname.startsWith("/login")) {
    console.error("Não foi possível entrar com E2E_EMAIL/E2E_SENHA.");
    await browser.close();
    process.exit(1);
  }
  // Páginas de detalhe: o primeiro link de cada lista.
  for (const [lista, prefixo] of SO_ROTAS ? [] : [
    ["/projetos", "/projetos/"],
    ["/compromissos", "/compromissos/cartao/"],
  ]) {
    await page.goto(BASE + lista, { waitUntil: "networkidle" });
    if (lista === "/compromissos") await page.getByRole("tab", { name: "Cartões" }).click().catch(() => {});
    await page.waitForTimeout(800);
    const href = await page
      .locator(`a[href^="${prefixo}"]`)
      .first()
      .getAttribute("href")
      .catch(() => null);
    if (href) TELAS.push(href);
  }
  estado = await ctx.storageState();
  await ctx.close();
}

let problemas = 0;
const erros = [];
for (const tamanho of TAMANHOS) {
  for (const esquema of ESQUEMAS) {
    const ctx = await browser.newContext({ viewport: tamanho, deviceScaleFactor: 2, colorScheme: esquema, storageState: estado, isMobile: true, hasTouch: true });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => erros.push(`${tamanho.width}px ${esquema}: ${e.message}`));
    for (const tela of TELAS) {
      await page.goto(BASE + tela, { waitUntil: "networkidle" });
      await page.waitForTimeout(1200);
      const { sw, cw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
      const ok = sw <= cw;
      const nome = tela === "/" ? "painel" : tela.slice(1).replace(/\//g, "_").replace(/[0-9a-f-]{36}/, "detalhe");
      if (!ok) {
        problemas++;
        console.log(`✗ ${tamanho.width}px ${esquema} ${tela.replace(/[0-9a-f-]{36}/, ":id")}: scrollWidth ${sw} > ${cw}`);
        for (const c of await culpados(page)) console.log(`    ${c}`);
      }
      if (CAPTURAS) await page.screenshot({ path: path.join(PASTA, `${tamanho.width}-${esquema}-${nome}.png`), fullPage: !process.env.TOPO });
    }
    await ctx.close();
  }
}
await browser.close();
const total = TAMANHOS.length * ESQUEMAS.length * TELAS.length;
console.log(problemas ? `\n${problemas} de ${total} verificações com rolagem horizontal.` : `\nOK: ${total} verificações sem rolagem horizontal.`);
if (erros.length) console.log("Erros de JavaScript nas páginas:\n  " + [...new Set(erros)].join("\n  "));
process.exit(problemas || erros.length ? 1 : 0);
