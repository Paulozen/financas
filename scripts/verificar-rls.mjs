// Verifica o isolamento por RLS simulando os dois usuários numa transação
// que é desfeita no fim (não deixa dados no banco). Uso: node scripts/verificar-rls.mjs
import fs from "node:fs"; import pg from "pg"; import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const u = new URL(process.env.SUPABASE_DB_URL); u.searchParams.delete("sslmode");
const c = new pg.Client({ connectionString: u.toString(), ssl: { ca: fs.readFileSync("certs/supabase-ca.crt", "utf8") } });
await c.connect();
const { rows: users } = await c.query("select id from auth.users order by created_at");
console.log("usuarios:", users.length);
const como = async (uid) => { await c.query("reset role"); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]); await c.query("set local role authenticated"); };
try {
  await c.query("begin");
  await como(users[0].id);
  const { rows: [{ criar_casa: casa }] } = await c.query("select criar_casa('[TESTE]', 'Teste A')");
  console.log("A categorias:", (await c.query("select count(*) from categorias")).rows[0].count);
  await c.query("insert into ocorrencias (casa_id, origem_tipo, descricao, tipo, valor_previsto, vencimento) values ($1,'pontual','x','saida',100,'2026-10-30')", [casa]);
  await como(users[1].id);
  console.log("B vê categorias:", (await c.query("select count(*) from categorias")).rows[0].count, "ocorrencias:", (await c.query("select count(*) from ocorrencias")).rows[0].count, "casas:", (await c.query("select count(*) from casas")).rows[0].count);
  try { await c.query("savepoint s"); await c.query("insert into ocorrencias (casa_id, origem_tipo, descricao, tipo, valor_previsto, vencimento) values ($1,'pontual','x','saida',100,'2026-10-30')", [casa]); console.log("FALHA: B inseriu"); } catch (e) { await c.query("rollback to savepoint s"); console.log("B bloqueado ok:", e.message); }
  await c.query("reset role");
  const { rows: [{ codigo_convite }] } = await c.query("select codigo_convite from casas where id=$1", [casa]);
  await como(users[1].id);
  await c.query("select entrar_casa($1, 'Teste B')", [codigo_convite]);
  console.log("B após entrar vê ocorrencias:", (await c.query("select count(*) from ocorrencias")).rows[0].count);
  // Importação (dados inventados): primeira vez grava, segunda vez tudo duplicado.
  await como(users[0].id);
  const { rows: [{ id: membroA }] } = await c.query("select id from membros where user_id = $1", [users[0].id]);
  const linhas = [
    { hash: "h1", data: "2026-10-01", descricao: "Teste novo", valor: -1000, acao: "novo", aprender: true, padrao: "teste novo" },
    { hash: "h2", data: "2026-10-02", descricao: "Teste racha", valor: 2500, acao: "racha", racha_tipo: "mensalidade" },
    { hash: "h3", data: "2026-10-03", descricao: "Teste ignorar", valor: 5, acao: "ignorar" },
  ];
  const imp1 = await c.query("select confirmar_importacao($1, $2, 'teste.csv', 'teste', $3) as r", [casa, membroA, JSON.stringify(linhas)]);
  const imp2 = await c.query("select confirmar_importacao($1, $2, 'teste.csv', 'teste', $3) as r", [casa, membroA, JSON.stringify(linhas)]);
  console.log("importação 1:", JSON.stringify(imp1.rows[0].r), "| 2:", JSON.stringify(imp2.rows[0].r));
  console.log("regras aprendidas:", (await c.query("select count(*) from regras_importacao")).rows[0].count);
  await como(null);
  await c.query("reset role"); await c.query("set local role anon");
  console.log("anon casas:", await c.query("select count(*) from casas").then(r => r.rows[0].count).catch(e => "erro: " + e.message));
} finally { await c.query("rollback"); await c.end(); }
