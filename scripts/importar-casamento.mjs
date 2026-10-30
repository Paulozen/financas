// Cadastra os itens do casamento na casa real (idempotente). Não cria parcelas nem ocorrências.
// Uso: node scripts/importar-casamento.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
dotenv.config({ path: path.join(raiz, ".env.local"), quiet: true });
const conexao = new URL(process.env.SUPABASE_DB_URL);
conexao.searchParams.delete("sslmode");
const client = new pg.Client({
  connectionString: conexao.toString(),
  ssl: { ca: fs.readFileSync(path.join(raiz, "certs", "supabase-ca.crt"), "utf8") },
});

const reais = (v) => Math.round(v * 100);
const fmt = (c) => (c / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// [nome, contratado (= orçado), já pago antes do app, status, observação, orçado (só para itens orçando)]
const ITENS = [
  ["Buffet", 19190, 4112.16, "contratado"],
  ["Fotógrafo", 1200, 400, "contratado"],
  ["Celebrante", 1300, 1300, "quitado"],
  ["Cerimonialista", 1152, 1152, "quitado"],
  ["Alianças", 2400, 0, "contratado"],
  ["Banda cerimônia", 1350, 450, "contratado"],
  ["Storymaker", 1400, 420, "contratado"],
  ["Gerador", 800, 0, "contratado"],
  ["Make pré-wedding", 0, 0, "orçando", "Valor a confirmar", 200],
  ["Cartório", 0, 0, "orçando", "Paulo vai pagar"],
  ["Convite", 0, 0, "orçando"],
  ["Roupa da noiva", 0, 0, "orçando"],
  ["Roupa do noivo", 0, 0, "orçando"],
  ["Lembrancinha", 0, 0, "orçando"],
  ["Bolo e docinhos", 0, 0, "orçando"],
  ["Bem-casado", 0, 0, "orçando"],
  ["Convite padrinhos/madrinhas", 0, 0, "orçando"],
  ["Roupa pré-wedding", 0, 0, "orçando"],
  ["Despedida de solteira", 0, 0, "orçando"],
  ["Máquina de urso", 0, 0, "orçando"],
  ["Barraquinhas", 0, 0, "orçando"],
].map(([nome, contratado, pagoAntes, status, observacoes = null, orcado = contratado]) => ({
  nome,
  valor_contratado: reais(contratado),
  valor_orcado: reais(orcado),
  valor_pago_antes: reais(pagoAntes),
  status,
  observacoes,
}));

const normal = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

await client.connect();
try {
  await client.query("begin");

  // Casa real: tem os membros Paulo e Laura e não é de teste.
  const { rows: casas } = await client.query(
    `select c.id, c.nome from casas c
     where c.nome not ilike '%[TESTE]%'
       and exists (select 1 from membros m where m.casa_id = c.id and m.nome = 'Paulo')
       and exists (select 1 from membros m where m.casa_id = c.id and m.nome = 'Laura')`,
  );
  if (casas.length !== 1) {
    throw new Error(
      casas.length ? `Mais de uma casa com Paulo e Laura (${casas.map((c) => c.nome).join(", ")}).` : "Casa com os membros Paulo e Laura não encontrada.",
    );
  }
  const casa = casas[0];

  let { rows: [projeto] } = await client.query("select id from projetos where casa_id = $1 and nome = 'Casamento' order by criado_em limit 1", [casa.id]);
  if (!projeto) {
    ({ rows: [projeto] } = await client.query(
      "insert into projetos (casa_id, nome, data_evento, orcamento, dono_membro_id) values ($1, 'Casamento', null, 0, null) returning id",
      [casa.id],
    ));
    console.log("Projeto “Casamento” criado (dono Casal, sem data e sem orçamento).");
  }

  const { rows: existentes } = await client.query("select * from projeto_itens where projeto_id = $1", [projeto.id]);
  const relatorio = { criados: [], atualizados: [], semMudanca: [] };

  for (const novo of ITENS) {
    const atual = existentes.find((i) => normal(i.descricao) === normal(novo.nome));
    if (!atual) {
      await client.query(
        `insert into projeto_itens (casa_id, projeto_id, descricao, valor_orcado, valor_contratado, valor_pago_antes, status, observacoes)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [casa.id, projeto.id, novo.nome, novo.valor_orcado, novo.valor_contratado, novo.valor_pago_antes, novo.status, novo.observacoes],
      );
      relatorio.criados.push(novo.nome);
      continue;
    }

    // Já existe: só preenche o que está vazio.
    const { rows: [{ pagas }] } = await client.query(
      "select coalesce(sum(valor_real), 0)::bigint pagas from ocorrencias where origem_tipo = 'parcela_projeto' and origem_id = $1 and status = 'pago'",
      [atual.id],
    );
    const campos = {};
    const notas = [];
    if (!Number(atual.valor_orcado) && novo.valor_orcado) campos.valor_orcado = novo.valor_orcado;
    if (!Number(atual.valor_contratado) && novo.valor_contratado) campos.valor_contratado = novo.valor_contratado;
    if (!Number(atual.valor_pago_antes) && novo.valor_pago_antes) {
      // O que já foi pago por parcelas no app não pode contar de novo como "pago antes".
      const antes = Math.max(0, novo.valor_pago_antes - Number(pagas));
      if (Number(pagas)) notas.push(`${fmt(Number(pagas))} já estão em parcelas pagas no app; pago antes do app = ${fmt(antes)}`);
      if (antes) campos.valor_pago_antes = antes;
    }
    if (!atual.observacoes && novo.observacoes) campos.observacoes = novo.observacoes;
    const chaves = Object.keys(campos);
    if (chaves.length) {
      await client.query(`update projeto_itens set ${chaves.map((k, i) => `${k} = $${i + 2}`).join(", ")} where id = $1`, [
        atual.id,
        ...chaves.map((k) => campos[k]),
      ]);
      relatorio.atualizados.push(`${novo.nome}: ${chaves.join(", ")}${notas.length ? ` (${notas.join("; ")})` : ""}`);
    } else relatorio.semMudanca.push(`${novo.nome}${notas.length ? ` (${notas.join("; ")})` : ""}`);
  }

  await client.query("commit");

  // Conferência com a mesma regra do app (pago = pago antes + parcelas pagas).
  const { rows: [t] } = await client.query(
    `select sum(i.valor_contratado)::bigint contratado, sum(i.valor_orcado)::bigint orcado, sum(i.valor_pago_antes)::bigint pago_antes,
       coalesce((select sum(o.valor_real) from ocorrencias o join projeto_itens j on j.id = o.origem_id
                 where j.projeto_id = $1 and o.origem_tipo = 'parcela_projeto' and o.status = 'pago'), 0)::bigint pago_parcelas
     from projeto_itens i where i.projeto_id = $1`,
    [projeto.id],
  );
  const pago = Number(t.pago_antes) + Number(t.pago_parcelas);
  console.log("Criados:", relatorio.criados.length ? relatorio.criados.join(", ") : "nenhum");
  console.log("Atualizados:", relatorio.atualizados.length ? "\n  " + relatorio.atualizados.join("\n  ") : "nenhum");
  if (relatorio.semMudanca.length) console.log("Já existiam sem nada a preencher:", relatorio.semMudanca.join(", "));
  console.log(
    `Conferência: contratado ${fmt(Number(t.contratado))} · orçado ${fmt(Number(t.orcado))} · pago antes do app ${fmt(Number(t.pago_antes))}` +
      ` + parcelas pagas ${fmt(Number(t.pago_parcelas))} = pago ${fmt(pago)} · falta pagar ${fmt(Number(t.contratado) - pago)}`,
  );
} catch (erro) {
  await client.query("rollback").catch(() => {});
  console.error("ERRO:", erro.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
