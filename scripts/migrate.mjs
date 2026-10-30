// Aplica, em ordem, as migrações de supabase/migrations ainda não aplicadas.
// Uso: npm run db:migrate   (lê SUPABASE_DB_URL do .env.local)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(raiz, ".env.local"), quiet: true });

const url = process.env.SUPABASE_DB_URL;
if (!url) {
  console.error("SUPABASE_DB_URL não definida no .env.local");
  process.exit(1);
}

// O pooler do Supabase usa certificado próprio: validamos contra a CA dele.
const conexao = new URL(url);
conexao.searchParams.delete("sslmode");
const ca = fs.readFileSync(path.join(raiz, "certs", "supabase-ca.crt"), "utf8");

const client = new pg.Client({
  connectionString: conexao.toString(),
  ssl: { ca },
});

const pasta = path.join(raiz, "supabase", "migrations");
const arquivos = fs
  .readdirSync(pasta)
  .filter((f) => /^\d+_.+\.sql$/.test(f))
  .sort();

await client.connect();
try {
  await client.query(`create table if not exists public._migracoes (
    nome text primary key,
    aplicada_em timestamptz not null default now()
  )`);
  await client.query("alter table public._migracoes enable row level security");
  const { rows } = await client.query("select nome from public._migracoes");
  const aplicadas = new Set(rows.map((r) => r.nome));
  let novas = 0;
  for (const nome of arquivos) {
    if (aplicadas.has(nome)) continue;
    const sql = fs.readFileSync(path.join(pasta, nome), "utf8");
    process.stdout.write(`Aplicando ${nome}... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await client.query("insert into public._migracoes (nome) values ($1)", [nome]);
      await client.query("commit");
      console.log("ok");
      novas++;
    } catch (erro) {
      await client.query("rollback");
      console.log("ERRO");
      throw erro;
    }
  }
  console.log(novas ? `${novas} migração(ões) aplicada(s).` : "Nenhuma migração pendente.");
} catch (erro) {
  console.error(erro.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
