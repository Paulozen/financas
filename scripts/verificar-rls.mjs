// Verifica o isolamento por RLS simulando os dois usuários numa transação
// que é desfeita no fim (não deixa dados no banco). Uso: node scripts/verificar-rls.mjs
import fs from "node:fs"; import pg from "pg"; import dotenv from "dotenv";
dotenv.config({ path: ".env.local", quiet: true });
const u = new URL(process.env.SUPABASE_DB_URL); u.searchParams.delete("sslmode");
const c = new pg.Client({ connectionString: u.toString(), ssl: { ca: fs.readFileSync("certs/supabase-ca.crt", "utf8") } });
await c.connect();
// Dois usuários fictícios criados dentro da transação (somem no rollback do fim).
const users = [{ id: "00000000-0000-4000-8000-00000000000a" }, { id: "00000000-0000-4000-8000-00000000000b" }];
const como = async (uid) => { await c.query("reset role"); await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: uid, role: "authenticated" })]); await c.query("set local role authenticated"); };
try {
  await c.query("begin");
  for (const [i, u] of users.entries())
    await c.query("insert into auth.users (id, email, aud, role) values ($1, $2, 'authenticated', 'authenticated')", [u.id, `teste${i}@exemplo.invalid`]);
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
  // Caixa de entrada (Open Finance): confirmar e desfazer, com dados inventados.
  const { rows: [conta] } = await c.query(
    "insert into contas_externas (casa_id, pluggy_item_id, pluggy_account_id, tipo, nome) values ($1,'item-x','conta-x','BANK','Conta teste') returning id", [casa]);
  await c.query(
    `insert into transacoes_externas (casa_id, conta_externa_id, pluggy_id, data, descricao, valor, situacao)
     values ($1,$2,'px-1','2026-10-10','Teste caixa novo',-1234,'pendente'), ($1,$2,'px-2','2026-10-10','Teste caixa vínculo',-100,'pendente')`, [casa, conta.id]);
  const { rows: [pend] } = await c.query(
    "insert into ocorrencias (casa_id, origem_tipo, descricao, tipo, valor_previsto, vencimento) values ($1,'pontual','Previsto teste','saida',100,'2026-10-10') returning id", [casa]);
  const linhasCaixa = [
    { hash: "pluggy:px-1", data: "2026-10-10", descricao: "Teste caixa novo", valor: -1234, acao: "novo" },
    { hash: "pluggy:px-2", data: "2026-10-10", descricao: "Teste caixa vínculo", valor: -100, acao: "vincular", vinculo_id: pend.id },
  ];
  const cx = await c.query("select confirmar_caixa_entrada($1,$2,$3,false) as r", [casa, membroA, JSON.stringify(linhasCaixa)]);
  const est = async () => (await c.query(
    `select (select string_agg(situacao, ',' order by pluggy_id) from transacoes_externas where casa_id=$1) sit,
            (select count(*) from ocorrencias where casa_id=$1 and descricao='Teste caixa novo') novos,
            (select status from ocorrencias where id=$2) vinculada`, [casa, pend.id])).rows[0];
  console.log("caixa confirmar:", JSON.stringify(cx.rows[0].r), JSON.stringify(await est()));
  for (const pid of ["px-1", "px-2"]) {
    const { rows: [t] } = await c.query("select id from transacoes_externas where pluggy_id=$1", [pid]);
    await c.query("select desfazer_confirmacao($1)", [t.id]);
  }
  console.log("caixa desfazer:", JSON.stringify(await est()));
  await como(null);
  await c.query("reset role"); await c.query("set local role anon");
  console.log("anon casas:", await c.query("select count(*) from casas").then(r => r.rows[0].count).catch(e => "erro: " + e.message));
} finally { await c.query("rollback"); await c.end(); }
