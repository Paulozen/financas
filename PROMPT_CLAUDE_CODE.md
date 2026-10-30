# Projeto: Finanças da Casa

Você vai construir, do início ao fim e de forma autônoma, um app web de controle financeiro pessoal para um casal (dois usuários). Não haverá ninguém para responder perguntas enquanto você trabalha: quando houver uma decisão em aberto, escolha a opção mais simples e sensata, registre em `DECISOES.md` e siga em frente. Não pare para pedir confirmação.

---

## 1. Regras de trabalho (leia antes de tudo)

1. **Retomada:** se `PROGRESSO.md` já existir, leia-o e continue de onde parou. Se não existir, crie-o com o checklist das fases da seção 8 e marque cada item ao concluir.
2. **Segurança primeiro (antes de qualquer commit):** crie ou complete o `.gitignore` com `.env*`, `amostras/`, `node_modules/`, `.next/`, `.vercel/`. Rode `git status` e confirme que `.env.local` e `amostras/` NÃO aparecem como arquivos a adicionar. Nunca copie dados reais dos extratos (nomes, valores, descrições) para código, testes, commits ou documentação.
3. **Fases:** trabalhe fase por fase (seção 8). Ao fim de cada fase: `npm run lint`, checagem de tipos, testes e `npm run build` precisam passar. Só então faça commit com mensagem em português (`fase N: ...`) e `git push` para a branch principal.
4. **Travou?** Se algo não funcionar depois de algumas tentativas razoáveis, documente o problema em `PROGRESSO.md` (o que tentou, o erro), deixe o código compilando e siga para a próxima parte. Nunca deixe o repositório num estado que não compila.
5. **Simplicidade:** é um app de uso pessoal para duas pessoas. Prefira soluções diretas, sem abstrações desnecessárias.
6. O repositório já tem um `README.md`. Preserve-o (você vai reescrevê-lo no fim). Se o scaffold do Next.js recusar a pasta não vazia, gere numa pasta temporária e mova os arquivos.

---

## 2. Ambiente já configurado

- `.env.local` na raiz contém:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (pode ser uma chave `sb_publishable_...`, que funciona igual à anon no supabase-js)
  - `SUPABASE_DB_URL` (string de conexão Postgres via Session pooler, com senha)
- O projeto Supabase está vazio. Os **dois usuários já existem** no Supabase Auth (e-mail e senha). O cadastro público está desativado: não crie tela de cadastro.
- O projeto já está conectado à Vercel (que recebe as variáveis `NEXT_PUBLIC_*` pela integração) e ao GitHub.
- Pasta `amostras/` (fora do Git) com dois extratos bancários reais: um `.csv` e um `.xlsx`. Use-os para entender os formatos e testar a importação localmente.

**Migrações:** escreva SQL em `supabase/migrations/NNN_nome.sql` e crie um script `npm run db:migrate` (Node + pacote `pg`, `ssl: { rejectUnauthorized: false }`, lendo `SUPABASE_DB_URL` do `.env.local`) que aplica, em ordem, as migrações ainda não aplicadas, registrando-as numa tabela `_migracoes`. Não dependa de login na Supabase CLI. `SUPABASE_DB_URL` nunca pode ser usada no código do app nem exposta ao navegador; o build da Vercel não roda migrações.

---

## 3. Stack

- Next.js (App Router) + TypeScript + Tailwind. Pode usar shadcn/ui.
- `@supabase/ssr` e `@supabase/supabase-js` para auth e dados.
- PWA instalável: `manifest`, ícones gerados (tema de finanças, simples), service worker básico. Nome do app: **Finanças da Casa**.
- Gráficos: Recharts. Datas: date-fns com locale pt-BR. Validação: zod. Testes: Vitest.
- Planilhas: `exceljs`, ou SheetJS instalado pelo tarball oficial de `cdn.sheetjs.com` (não use o pacote `xlsx` antigo do npm).
- **Dinheiro sempre em centavos (inteiro)** no banco e nos cálculos. Exibição em `R$ 1.234,56`. Inputs de valor com máscara brasileira.
- Fuso horário `America/Fortaleza`. Datas exibidas em `dd/mm/aaaa`. Toda a interface em português do Brasil.
- Mobile-first (será usado principalmente no celular), com barra de navegação inferior; no desktop, layout centralizado. Modo claro e escuro seguindo o sistema.

---

## 4. Usuários, casa e "dono"

- Login por e-mail e senha. Botão de sair.
- No primeiro login, se o usuário não pertence a nenhuma casa: tela com "Criar casa" (gera um código de convite curto) ou "Entrar com código". Também pede o **nome de exibição** (ex.: "Lucas", "Ana").
- Ao criar a casa, cadastre as categorias padrão (seção 5.8).
- Quase todo registro tem um **dono**: um dos dois membros ou **Casal** (`dono_membro_id` nulo = Casal).
- Seletor global de visão no topo: **[Nome 1] / [Nome 2] / Casal**. A visão de um membro mostra só o que tem ele como dono; a visão Casal mostra tudo somado (itens individuais dos dois + itens do casal).
- **RLS em todas as tabelas:** só membros da casa leem e escrevem dados com aquele `casa_id`. Use uma função `sql security definer` como `eh_membro(casa_id)`.

---

## 5. Módulos

### 5.1 Conceito central: ocorrências
Tudo que movimenta dinheiro gera **ocorrências** numa tabela única. Painel, projeção, vencimentos e lista mensal leem só dela.

Campos: `casa_id`, `origem_tipo` (`recorrencia`, `pontual`, `parcela_contrato`, `pagamento_divida`, `meta_divida`, `parcela_projeto`, `fatura`), `origem_id`, `descricao`, `tipo` (`entrada` | `saida`), `dono_membro_id`, `categoria_id`, `valor_previsto`, `valor_real`, `vencimento`, `pago_em`, `status` (`pendente` | `pago` | `cancelado`), `observacao`, `transacao_importada_id`.

- **Marcar como pago:** modal que confirma valor real (pré-preenchido com o previsto), data do pagamento e observação. Para parcelas de contrato e despesas variáveis, inclui a opção "usar este valor como estimativa das próximas".
- Dá para desfazer um pagamento.
- **Geração:** função idempotente "garantir ocorrências até daqui a 12 meses", chamada ao abrir o app e ao criar/editar regras. Não precisa de cron.
- Editar uma regra atualiza só as ocorrências futuras **pendentes**; as pagas nunca mudam.

### 5.2 Receitas e despesas
- **Fixas:** descrição, tipo, valor, dia do mês, início, fim opcional, dono, categoria. Repetem todo mês.
- **Variáveis:** como as fixas, mas o valor previsto de cada mês futuro é a **média dos últimos 3 valores reais pagos** daquela regra (se ainda não houver, usa o valor informado). O usuário pode sobrescrever o previsto de uma ocorrência específica ou o padrão da regra.
- **Pontuais:** acontecem uma vez. Receitas pontuais têm o campo **origem** (ex.: "ajuda da mãe").
- Tela **Lançamentos:** lista do mês com navegação entre meses, filtros (tipo, status, categoria, dono) e totais. Botão flutuante "+" para lançamento rápido.

### 5.3 Parcelados (construtora, financiamento)
- Campos: nome, credor, valor total, número de parcelas, valor estimado da parcela, dia de vencimento, data da primeira parcela, parcelas já pagas antes de usar o app e valor já pago antes, dono (padrão Casal), categoria.
- Gera ocorrências para as parcelas restantes com o valor estimado. Ao pagar, informa o valor real (pode ser diferente por causa de reajuste, como INCC ou amortização SAC).
- Tela de detalhe: parcelas pagas/restantes, total pago, saldo devedor estimado (total − pago), lista de parcelas com status.

### 5.4 Dívidas flexíveis (ex.: dívida do carro)
- Campos: credor, descrição, valor total, data de início, **meta mensal opcional**, dono, categoria.
- Pagamentos avulsos a qualquer momento (data, valor, observação). Cada pagamento vira uma ocorrência já paga, então entra na sobra do mês.
- Se houver meta mensal: gera uma ocorrência `meta_divida` pendente por mês, usada na projeção. Pagamentos avulsos do mês abatem a meta daquele mês; se o pago for maior ou igual à meta, ela é marcada como cumprida e não conta de novo.
- Mostra: valor restante, percentual quitado, histórico de pagamentos. Ao quitar, a dívida aparece como concluída.

### 5.5 Cartões de crédito
- Cadastro: nome, dono, dia de vencimento (fechamento opcional).
- Cada cartão cria automaticamente uma regra de despesa **variável** "Fatura [nome]" com uma ocorrência por mês. O usuário ajusta o valor quando a fatura fecha. Não há registro de compras individuais.

### 5.6 Projetos (o primeiro é o casamento)
- Projeto: nome, data do evento, orçamento total, dono (padrão Casal), status.
- Itens: fornecedor, descrição, tipo do item (texto livre com sugestões: buffet, local, fotografia, vídeo, decoração, música, vestido, traje, convites, cerimonial, outros), valor orçado, valor contratado, contato, observações, status (`orçando` | `contratado` | `quitado`).
- Cada item tem **parcelas** (data e valor), que viram ocorrências normais (`parcela_projeto`), categoria "Casamento" por padrão. Ajuda para gerar N parcelas iguais a partir de uma data.
- Tela do projeto: orçado × contratado × pago × falta pagar, barra de progresso, lista de itens, próximas parcelas.

### 5.7 Reservas (CDBs)
- Cadastro: nome, banco, dono, observação livre (ex.: "110% do CDI, vence em 2028").
- Atualização manual do saldo (data e valor), guardando o histórico. Gráfico de linha da evolução por reserva e total.
- Reservas **não** entram na sobra do mês nem na projeção; aparecem só como "Total guardado".

### 5.8 Categorias
- Padrão de saída: Moradia, Mercado, Transporte, Saúde, Lazer, Contas da casa, Casamento, Dívidas, Cartão, Outros.
- Padrão de entrada: Salário, Ajuda/Presente, Outras receitas.
- Tela para criar, renomear, mudar cor e desativar.

### 5.9 Caixa do racha (dinheiro de terceiros)
Um dos usuários organiza um futebol (racha) e recebe dinheiro dos jogadores para pagar o juiz. **Esse dinheiro não é do casal:** fica totalmente fora da sobra do mês, da projeção e dos gráficos de categoria.
- Movimentos: data, tipo (`mensalidade`, `diaria`, `amistoso`, `juiz`, `outro`), entrada ou saída, valor, descrição opcional, vínculo opcional com transação importada.
- Configuração com valores padrão editáveis: mensalidade R$ 25, diária R$ 5, juiz R$ 100.
- Botões rápidos: "+ Mensalidade", "+ Diária", "+ Amistoso" (valor livre), "− Juiz". Permitir informar quantidade (ex.: 8 diárias de uma vez = 8 × R$ 5).
- Não há cadastro de jogadores: o controle é só do total.
- Tela: saldo atual do caixa em destaque (vermelho se negativo, com o aviso "você está cobrindo do seu bolso"), resumo do mês (entrou, saiu), lista de movimentos por mês.
- O caixa pertence ao membro que organiza (escolhido ao ativar o módulo nas configurações), mas é visível para os dois.

### 5.10 Importação de extratos
- Aceita **OFX, CSV e XLSX**.
- CSV/XLSX: detectar linha de cabeçalho, separador (`;` ou `,`), codificação (UTF-8 ou Latin-1), números no formato brasileiro (`1.234,56`, sinal negativo ou coluna crédito/débito), datas `dd/mm/aaaa`. Tela de mapeamento de colunas (data, descrição, valor ou crédito/débito), salva como **perfil de importação por banco** e reconhecida automaticamente nas próximas vezes pela assinatura do cabeçalho.
- **Analise os dois arquivos em `amostras/`** e já crie perfis prontos para esses dois bancos. Para os testes automatizados, crie fixtures **anonimizadas** (descrições e valores inventados) imitando a estrutura de cada arquivo.
- Tela de prévia: cada linha recebe uma ação:
  - **Novo lançamento:** vira ocorrência pontual paga (categoria e dono editáveis);
  - **Vincular:** liga a uma ocorrência pendente existente e a marca como paga com o valor e a data do extrato. O app sugere candidatas por valor próximo e data até ±5 dias (ex.: pagamento de fatura, parcela, salário);
  - **Racha:** vira movimento do caixa do racha (com tipo);
  - **Ignorar:** transferências entre contas próprias, aplicações e resgates de CDB etc.
- **Regras aprendidas:** ao confirmar, o app guarda o padrão da descrição normalizada e sugere a mesma ação e categoria nas próximas importações (ex.: PIX de determinada pessoa → Racha/mensalidade).
- **Sem duplicados:** usar o FITID do OFX, ou um hash de (conta/perfil, data, valor, descrição normalizada). Linhas já importadas aparecem marcadas e desabilitadas.
- Guardar histórico das importações (arquivo, data, quantas linhas de cada ação).

---

## 6. Painel (tela inicial)

Topo: seletor de mês e de visão (membro 1 / membro 2 / Casal). De cima para baixo:

1. **Sobra do mês:** entradas, saídas e saldo em duas linhas:
   - Previsto: soma de todas as ocorrências não canceladas do mês (usa o valor real se pago, senão o previsto);
   - Realizado: só as pagas.
2. **Projeção (próximos 12 meses):** barras com a sobra prevista de cada mês; meses negativos em vermelho. Nas configurações há um campo opcional "Saldo em conta hoje" (com data); se preenchido, mostra também uma linha de saldo acumulado. Pendências atrasadas contam no mês atual.
3. **Vencimentos:** atrasados no topo em destaque e depois os próximos 15 dias, cada um com botão "Pagar".
4. **Progresso:** barras dos parcelados, dívidas flexíveis e projetos ativos (pago × total), com link para cada um.
5. **Gastos por categoria** do mês (barras horizontais ou rosca).
6. Rodapé com dois números pequenos: **Total guardado** (reservas) e **Caixa do racha**, como informação separada.

---

## 7. Interface

- Barra inferior: **Painel, Lançamentos, Compromissos** (parcelados, dívidas e cartões em abas), **Projetos, Mais** (Reservas, Racha, Importar, Categorias, Configurações, Sair).
- Formulários curtos e rápidos de preencher no celular. Estados vazios com orientação ("Cadastre seu salário para começar"). Feedback de carregamento e mensagens de erro claras em português.
- Confirmação antes de excluir. Excluir uma regra pergunta se as ocorrências futuras pendentes também devem ser removidas.

---

## 8. Fases

- **Fase 0 — Base:** `.gitignore` (regra 2), análise dos arquivos em `amostras/` (anote formato e colunas em `DECISOES.md`, sem dados reais), scaffold Next.js, dependências, clientes Supabase, script `db:migrate`, `PROGRESSO.md`, `DECISOES.md`.
- **Fase 1 — Banco e acesso:** todas as tabelas, índices, RLS e funções; aplicar com `npm run db:migrate` e verificar. Login, onboarding da casa, layout, navegação, tema, PWA.
- **Fase 2 — Núcleo:** categorias, receitas/despesas (fixas, variáveis, pontuais), motor de ocorrências, tela Lançamentos, pagar/desfazer. Testes unitários do motor (geração, média das variáveis, edição de regra sem mexer em pagos).
- **Fase 3 — Compromissos:** parcelados, dívidas flexíveis (com meta e abatimento), cartões. Testes da lógica de meta.
- **Fase 4 — Projetos:** casamento com itens, parcelas e resumo.
- **Fase 5 — Reservas e Racha.**
- **Fase 6 — Painel:** todos os blocos da seção 6. Testes dos cálculos de sobra e projeção.
- **Fase 7 — Importação:** parsers OFX/CSV/XLSX com testes, perfis, prévia, vínculo, regras aprendidas, deduplicação. Teste manual local com os arquivos de `amostras/` (sem persistir dados reais em testes).
- **Fase 8 — Acabamento:** revisar telas no tamanho de celular, estados vazios, acessibilidade básica, ícones do PWA. Reescrever o `README.md` em português: como rodar localmente, como aplicar migrações, como publicar na Vercel (conferir as variáveis `NEXT_PUBLIC_SUPABASE_URL` e `NEXT_PUBLIC_SUPABASE_ANON_KEY` no projeto da Vercel; configurar o domínio da Vercel como Site URL em Authentication → URL Configuration no Supabase) e como instalar no celular.

**Testes com o banco real:** o banco é o de produção do casal. Se precisar criar dados para testar, use uma casa de teste separada com nome `[TESTE]` e apague tudo dela ao terminar. Nunca deixe dados fictícios na casa real.

---

## 9. Entrega final

Ao terminar, atualize `PROGRESSO.md` com:
- o que foi construído;
- um roteiro curto de testes manuais para o casal fazer (cadastrar salários, pagar uma conta, parcela com valor diferente do estimado, pagamento avulso da dívida, item do casamento com parcelas, movimento no racha, importação de um extrato);
- limitações conhecidas e pendências.

Faça o commit e o push finais.

## 10. Complementos (prevalecem sobre o resto do arquivo)
1. Conexão com o banco: o pooler do Supabase usa certificado próprio. No script db:migrate, use ssl com o certificado em certs/supabase-ca.crt (ssl: { ca: conteúdo do arquivo }), verificando normalmente. Isso substitui o rejectUnauthorized: false da seção 2. A senha já foi validada.
2. Os membros da casa são Paulo e Laura.
3. Formato dos extratos (os dois de amostras/ são do mesmo banco, provavelmente PicPay): colunas data, hora, tipo, origem / destino, valor, forma de pagamento. Valor como texto, ex.: "+R$ 1,83" e "−R$ 100,00", e o sinal de menos é o caractere Unicode "−" (U+2212), não o hífen; trate os dois. O .xlsx tem uma aba com uma única coluna, onde cada célula contém uma linha inteira de CSV: o parser de XLSX precisa detectar esse caso e reprocessar o texto como CSV. Crie um perfil de importação pronto para esse formato.
4. Movimentos internos: "Troco guardado", "Dinheiro guardado", "Dinheiro resgatado" e "Rendimento de conta" (e variações) são movimentações entre a conta e o cofrinho. Na prévia, sugira "Ignorar" para eles por padrão (o usuário pode mudar).
5. Os extratos têm centenas de linhas. Na prévia, inclua seleção múltipla com ação em lote, filtros por tipo e por texto, e um filtro "importar a partir de [data]".
6. Esses extratos não têm ID de transação: deduplique por hash de (perfil, data, hora, tipo, origem/destino, valor) e, para linhas idênticas no mesmo arquivo, acrescente um índice de repetição ao hash.
7. Esta sessão está com Remote Control ativo: envie uma notificação push para o meu celular quando terminar tudo, ou se ficar bloqueado sem conseguir seguir.