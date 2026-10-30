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
  // A integração do Supabase com o GitHub também aplica supabase/migrations a cada push
  // e guarda o que aplicou em supabase_migrations.schema_migrations (versão = prefixo
  // numérico do arquivo). Mantemos os dois registros iguais para ninguém reaplicar nada.
  await client.query("create schema if not exists supabase_migrations");
  await client.query(`create table if not exists supabase_migrations.schema_migrations (
    version text primary key, statements text[], name text
  )`);
  const registrar = (nome) =>
    client.query(
      `with a as (insert into public._migracoes (nome) values ($1) on conflict do nothing)
       insert into supabase_migrations.schema_migrations (version, name) values ($2, $3) on conflict do nothing`,
      [nome, nome.split("_")[0], nome.replace(/^\d+_/, "").replace(/\.sql$/, "")],
    );
  const { rows } = await client.query("select nome from public._migracoes");
  const { rows: doSupabase } = await client.query("select version from supabase_migrations.schema_migrations");
  const aplicadas = new Set(rows.map((r) => r.nome));
  const versoesSupabase = new Set(doSupabase.map((r) => r.version));
  let novas = 0;
  for (const nome of arquivos) {
    if (aplicadas.has(nome) || versoesSupabase.has(nome.split("_")[0])) {
      await registrar(nome); // garante os dois registros
      continue;
    }
    const sql = fs.readFileSync(path.join(pasta, nome), "utf8");
    process.stdout.write(`Aplicando ${nome}... `);
    try {
      await client.query("begin");
      await client.query(sql);
      await registrar(nome);
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
