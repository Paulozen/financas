# Finanças da Casa

App web (PWA) de controle financeiro pessoal para um casal: receitas e despesas fixas, variáveis e pontuais, parcelados, dívidas flexíveis, cartões, projetos (casamento), reservas, caixa do racha e importação de extratos.

Feito com Next.js (App Router) + TypeScript + Tailwind, Supabase (Auth + Postgres com RLS), Recharts, date-fns, exceljs e Vitest. Todo valor em dinheiro é guardado em centavos (inteiro).

## Rodar localmente

Pré-requisitos: Node.js 20 ou mais novo.

1. Crie o arquivo `.env.local` na raiz (ele não vai para o Git):

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://<projeto>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<chave anon ou sb_publishable_...>
   SUPABASE_DB_URL=postgresql://postgres.<projeto>:<senha>@<host do session pooler>:5432/postgres
   ```

   `SUPABASE_DB_URL` só é usada pelo script de migrações; nunca vai para o navegador nem para a Vercel.

   Para o Open Finance (opcional), acrescente também:

   ```
   PLUGGY_CLIENT_ID=<Client ID da aplicação no dashboard.pluggy.ai>
   PLUGGY_CLIENT_SECRET=<Client Secret>
   PLUGGY_ITEMS_PAULO=<itemId>,<itemId>
   PLUGGY_ITEMS_LAURA=<itemId>
   ```

   Cada `PLUGGY_ITEMS_<NOME>` lista os itens (um por banco) de um membro, pelo nome de exibição dele no app; o dono das contas e transações vem daí (pode ser trocado na tela). As listas podem crescer ou ficar vazias. Essas variáveis só existem no servidor (não começam com `NEXT_PUBLIC_`).

2. Instale e rode:

   ```
   npm install
   npm run db:migrate   # aplica as migrações pendentes
   npm run dev          # http://localhost:3000
   ```

Outros comandos:

| Comando | O que faz |
|---|---|
| `npm run lint` | ESLint |
| `npm run typecheck` | Checagem de tipos |
| `npm test` | Testes (Vitest) |
| `npm run build` | Build de produção |
| `node scripts/verificar-rls.mjs` | Confere o isolamento por RLS simulando os dois usuários numa transação desfeita (não grava nada) |
| `node scripts/gerar-icones.mjs` | Regera os ícones do PWA |

## Migrações

- Os arquivos ficam em `supabase/migrations/NNN_nome.sql` e são aplicados em ordem por `npm run db:migrate`.
- O script registra o que já foi aplicado na tabela `_migracoes`; rodar de novo não repete nada.
- A integração do Supabase com o GitHub também aplica `supabase/migrations` a cada push (registro em `supabase_migrations.schema_migrations`). O script mantém os dois registros iguais, então tanto faz quem aplicar primeiro: o outro pula.
- A conexão usa SSL validado contra o certificado do Supabase em `certs/supabase-ca.crt`.
- Para mudar o banco, crie um novo arquivo com o próximo número (ex.: `003_algo.sql`) e rode `npm run db:migrate`. Não edite migrações já aplicadas.
- O build da Vercel não roda migrações: rode o comando localmente antes de publicar uma versão que dependa delas.

## Open Finance (Meu Pluggy)

O app lê as contas pelo Meu Pluggy (uso pessoal, gratuito), a partir de uma rota do servidor (`/api/pluggy/sincronizar`) que usa a sessão do usuário logado.

- **Sincronização:** botão "Sincronizar agora" em Configurações → Bancos conectados e, ao abrir o app, automática se a última tiver mais de 6 horas. A Pluggy atualiza os bancos a cada 24 horas; o app não força atualização.
- **Contas correntes** → Caixa de entrada (Mais → Caixa de entrada), com sugestões e confirmação em lote. O saldo delas vira o "saldo em conta" da projeção.
- **Cartões** → vincule cada cartão do banco a um cartão do app em Configurações. As faturas fechadas atualizam a ocorrência da fatura; as futuras são previstas com as parcelas conhecidas + média das compras à vista.
- **Investimentos** → vincule a uma reserva (formulário da reserva) para o saldo atualizar sozinho.
- **Autorização:** vale um ano. Para renovar: dashboard.pluggy.ai → Applications → sua aplicação → Demo → Connect Account → MeuPluggy. Se o itemId mudar, atualize `PLUGGY_ITEMS_<NOME>` no `.env.local` e na Vercel.
- A importação de extratos por arquivo continua disponível como alternativa.

## Publicar na Vercel

O projeto já está ligado à Vercel e ao GitHub: cada `git push` na branch principal gera um deploy.

1. Em **Vercel → Project → Settings → Environment Variables**, confira se existem `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` (a integração com o Supabase costuma criar). **Não** cadastre `SUPABASE_DB_URL` lá.
   Para o Open Finance funcionar no site publicado, cadastre também `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e cada `PLUGGY_ITEMS_<NOME>` (ambiente Production) e faça um novo deploy.
2. No Supabase, em **Authentication → URL Configuration**, coloque o domínio da Vercel (ex.: `https://financas-xxx.vercel.app`) em **Site URL**.
3. O cadastro público fica desativado; os dois usuários são criados no Supabase Auth (e-mail e senha).

## Primeiro uso

1. A primeira pessoa entra, escolhe **Criar casa** e informa o nome de exibição. As categorias padrão são criadas.
2. Em **Mais → Configurações** aparece o **código de convite**. A segunda pessoa entra com a conta dela, escolhe **Entrar com código** e digita o código.
3. Comece por **Lançamentos → Recorrentes**: salários e contas fixas.

## Instalar no celular

- **Android (Chrome):** abra o endereço do app, toque no menu ⋮ → **Instalar app** (ou "Adicionar à tela inicial").
- **iPhone (Safari):** abra o endereço, toque em **Compartilhar** → **Adicionar à Tela de Início**.

O app abre em tela cheia, com ícone próprio. Os dados sempre vêm da internet (o modo offline só mostra a casca do app).

## Estrutura

- `src/app/(app)/` — telas (Painel, Lançamentos, Compromissos, Projetos, Mais...).
- `src/components/` — componentes de interface e formulários.
- `src/lib/motor.ts` — motor de ocorrências (gera 12 meses à frente, idempotente).
- `src/lib/painel.ts` — sobra do mês, projeção, vencimentos e gastos por categoria.
- `src/lib/importacao/` — leitura de OFX/CSV/XLSX, perfis de banco, sugestões e deduplicação.
- `supabase/migrations/` — esquema, RLS e funções.
- `DECISOES.md` — decisões tomadas durante a construção. `PROGRESSO.md` — o que foi feito, roteiro de testes e pendências.
