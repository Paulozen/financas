# Decisões

Decisões tomadas durante a construção, na ordem em que surgiram.

## Fase 0

- **Formato dos extratos (amostras/).** Os dois arquivos são do mesmo banco (provavelmente PicPay), sem ID de transação.
  - CSV: UTF-8 com BOM, separador `,`, campos com aspas. Cabeçalho: `data,hora,tipo,"origem / destino",valor,"forma de pagamento"`.
  - `data` em ISO (`aaaa-mm-dd`), `hora` em `hh:mm`.
  - `valor` é texto com sinal e símbolo: `+R$ 1,83` / `−R$ 100,00` (o menos é U+2212; o hífen comum também é aceito).
  - `tipo` observados: Pix recebido, Pix enviado, Rendimento recebido, Dinheiro guardado, Dinheiro resgatado, Troco guardado, Pagamento realizado.
  - `origem / destino` para movimentos do cofrinho: "Rendimento de conta", "No cofrinho X", "Do cofrinho X".
  - `forma de pagamento`: vazio ou "Com saldo".
  - XLSX: uma aba, **uma única coluna**; cada célula contém uma linha inteira de CSV (inclusive o cabeçalho). O parser detecta isso e reprocessa o texto como CSV.
  - Linhas em ordem decrescente de data.
- **Next.js 16** (versão atual do create-next-app). Desativei `cacheComponents`/`partialPrefetching` do scaffold: o app é de uso pessoal e lê os dados no navegador.
- **Arquitetura de dados:** as telas são componentes cliente que falam direto com o Supabase (supabase-js no navegador). A segurança fica no RLS do Postgres (`eh_membro(casa_id)`), então não há API própria. Operações com várias escritas usam funções SQL (`rpc`) para serem atômicas.
- **Migrações:** `scripts/migrate.mjs` com `pg`, SSL validado contra `certs/supabase-ca.crt` (CA pública do Supabase, versionada no repositório). O parâmetro `sslmode` da URL é removido para não sobrepor a configuração de SSL.
- **Planilhas:** `exceljs` (não usei o pacote `xlsx` do npm).
- **Testes:** Vitest, só para a lógica pura (motor de ocorrências, cálculos, parsers).
- **PROMPT_CLAUDE_CODE.md** fica fora do Git (arquivo local de instruções). Foi versionado por engano na fase 1 e removido do controle na fase 8 (continua no histórico; não contém segredos nem dados dos extratos).

## Fase 1

- **RLS verificado** com `scripts/verificar-rls.mjs`: simula os dois usuários numa transação desfeita no fim (não grava nada). Um usuário fora da casa não lê nem escreve; `anon` não acessa nada.
- **Casa com no máximo dois membros**; código de convite de 6 caracteres sem letras/números ambíguos.
- **Onboarding** por funções `criar_casa` / `entrar_casa` (security definer), que também criam as categorias padrão.
- **Ícones do PWA** gerados por `scripts/gerar-icones.mjs` (PNG puro, sem dependências). Service worker simples: rede primeiro para páginas, cache para estáticos; dados sempre online.
- **Visão** (membro/Casal) e **mês** selecionados ficam no contexto do app; a visão é lembrada no `localStorage`.

## Fase 2

- **Motor de ocorrências** (`src/lib/motor.ts`) é uma função pura que devolve o plano (inserir/atualizar/remover); `src/lib/sincronizar.ts` busca as regras, aplica o plano no banco e roda ao abrir o app e depois de cada alteração. Idempotência pela coluna `chave` (`rec:<id>:<aaaa-mm>`, `ctr:<id>:<n>`, `meta:<id>:<aaaa-mm>`) com `unique (casa_id, chave)`.
- **Primeiro mês gerado** de uma recorrente: o maior entre o mês de início e o mês do cadastro (evita uma fila de "atrasados" ao cadastrar um salário que começou há anos).
- **"Futuras pendentes"** = pendentes com vencimento de hoje em diante. Pendentes atrasadas não são alteradas pelo motor.
- **Variáveis:** `valor_manual = false` → previsto = média dos últimos 3 pagos (ou o valor informado se ainda não houver). "Usar este valor como estimativa das próximas" grava o valor na regra e liga `valor_manual`; dá para voltar à média no formulário da regra.
- **Previsto de uma ocorrência específica** pode ser ajustado no detalhe; ela fica marcada (`previsto_manual`) e o motor não a sobrescreve.
- **Excluir regra** pergunta se remove as futuras pendentes; se mantiver, as ocorrências ficam órfãs e o motor não mexe mais nelas.
- **Pontuais** são ocorrências com `origem_tipo = 'pontual'`, sem regra. O campo "origem" das receitas pontuais fica em `ocorrencias.fonte`.
- **Filtro de dono** na lista do mês complementa a visão global (útil na visão Casal).

## Fase 3

- **Parcelados:** o motor gera as parcelas restantes dentro da janela de 12 meses (as demais aparecem conforme o tempo passa). Parcela = ocorrência `parcela_contrato` com `parcela_num`. Saldo devedor estimado = total − (pago antes do app + valores reais pagos).
- **Dívidas flexíveis:** pagamento avulso = ocorrência `pagamento_divida` já paga (desfazer apaga). A meta mensal vira uma ocorrência `meta_divida` por mês, do mês atual em diante, até o saldo projetado zerar. No mês, a meta pendente vale `meta − avulsos do mês`; se os avulsos cobrirem a meta, ela fica paga com valor 0 ("cumprida") e não conta de novo. Metas de meses passados não cumpridas são canceladas automaticamente (não viram "atrasadas").
- **Cartões:** cada cartão cria uma recorrente variável "Fatura <nome>" (categoria Cartão, ligada por `cartao_id`, ocorrências `fatura`). Editar o cartão atualiza a regra; excluir o cartão apaga a regra (cascade) e pergunta sobre as futuras pendentes.

## Fase 4

- **Parcelas de projeto** são ocorrências `parcela_projeto` com `origem_id` = item (sem tabela própria), categoria "Casamento" e dono do projeto. Criadas pelo ajudante "N parcelas iguais" (a última absorve o arredondamento) ou uma a uma; editáveis no detalhe enquanto pendentes.
- **Resumo do projeto:** orçamento (informado), orçado (soma dos itens), contratado, pago (valores reais das parcelas pagas), falta pagar = contratado − pago.

## Fase 5

- **Reservas:** cada atualização de saldo é um registro (data, valor) em `reserva_saldos`; o saldo atual é o mais recente. Gráfico de linha do total e de cada reserva (até 7 linhas; acima disso só o total). Reservas desativadas saem do total guardado.
- **Gráficos:** paleta categórica fixa e validada para daltonismo, com passos próprios no modo escuro (`src/lib/graficos.ts`); positivo azul / negativo vermelho na projeção.
- **Racha:** movimentos em tabela própria, totalmente fora de `ocorrencias` (não entra em sobra, projeção nem gráficos). Quantidade × valor padrão vira um único movimento com a descrição "8 × R$ 5,00". Configuração (ativar, organizador, valores padrão) em Configurações.
- **Configurações** também guarda o "Saldo em conta hoje" (valor + data) e mostra o código de convite.

## Fase 6

- **Painel** lê só `ocorrencias` (cálculos em `src/lib/painel.ts`, com testes). A visão (membro/Casal) filtra tudo, inclusive o total guardado; o caixa do racha aparece sempre à parte.
- **Realizado** = ocorrências pagas com vencimento no mês (mesma base do previsto, para as duas linhas serem comparáveis).
- **Projeção:** mês atual + 11. Pendentes atrasadas de meses anteriores entram no mês atual. Saldo acumulado = saldo informado + o que ainda não está refletido nele (pendentes e pagamentos com data posterior à do saldo).
- **Gastos por categoria** em barras horizontais simples (HTML), com a cor da categoria e percentual; a projeção tem também uma visão em tabela.

## Fase 7

- **Leitura no navegador:** o arquivo nunca sai do aparelho; só as linhas confirmadas vão para o banco. `exceljs` é carregado sob demanda (chunk separado).
- **Codificação:** BOM UTF-8/UTF-16; sem BOM tenta UTF-8 estrito e cai para Windows-1252 (Latin-1).
- **Cabeçalho:** primeira linha (entre as 30 primeiras) com uma coluna "data" e outra conhecida (valor, histórico, descrição, crédito, débito, tipo, origem...). A assinatura (nomes das colunas normalizados) identifica o perfil.
- **Perfil pronto "PicPay":** data, hora, tipo, origem/destino, valor. Descrição = "tipo · origem/destino". Perfis criados na tela de mapeamento ficam em `perfis_importacao` (por casa).
- **XLSX de coluna única:** se todas as linhas têm só uma célula e elas parecem CSV, o texto é reprocessado como CSV.
- **Deduplicação:** OFX usa o FITID. Demais: SHA-256 de (perfil + dono do extrato, data, hora, tipo, descrição, valor); linhas idênticas no mesmo arquivo ganham índice de repetição (#2, #3...). O dono do extrato entra na "conta" para que extratos de pessoas diferentes no mesmo banco não colidam — por isso, ao reimportar, escolha o mesmo dono.
- **Sugestões, em ordem:** regra aprendida → movimento interno (Troco/Dinheiro guardado, Dinheiro resgatado, Rendimento, cofrinho) = Ignorar → pendente com valor próximo (até 10% ou R$ 5) e vencimento ±5 dias = Vincular → se o extrato é de quem organiza o racha e o valor é exatamente a mensalidade ou a diária = Racha → Novo lançamento.
- **Regras aprendidas** são gravadas para Racha, Ignorar e Novo com categoria (não para Vincular), pelo padrão da descrição normalizada (sem acentos, números e pontuação).
- **Confirmação atômica** pela função `confirmar_importacao` (security invoker, RLS vale): registra a importação, as transações (com `on conflict do nothing` para duplicadas), cria/vincula ocorrências ou movimentos do racha, aprende regras e guarda as contagens.
- **"Importar a partir de [data]"** exclui as linhas anteriores (não são gravadas; podem ser importadas depois).
- **Teste manual com as amostras reais** feito por um teste temporário que imprimiu só contagens (não versionado): os dois arquivos foram reconhecidos pelo perfil PicPay, sem linhas descartadas e com hashes todos distintos.

## Fase 8

- **README** reescrito em português (rodar localmente, migrações, Vercel, instalar no celular).
- **Login** redireciona para o app quando já existe sessão.
- Verificado: a API REST nega acesso anônimo (401) e a URL do banco (`SUPABASE_DB_URL`) não aparece no código enviado ao navegador.

## Depois da entrega

- **Layout de computador (≥ 1024 px):** menu lateral fixo no lugar da barra inferior, conteúdo até 1152 px e telas em duas colunas (Painel em grade; Lançamentos com mês/totais/filtros à esquerda e lista à direita; detalhes de parcelado, dívida e projeto lado a lado). No celular nada muda.
- **Conferência visual** feita com navegador headless e um Supabase simulado (dados inventados, nada do banco real), no tamanho de computador, celular e no modo escuro.

## Projetos: "Já pago antes do app" (migração 003)

- `projeto_itens.valor_pago_antes` (centavos, padrão 0). Não gera ocorrência, então não entra na sobra nem na projeção.
- Entra em todos os totais do projeto pela mesma função (`resumoProjeto`), usada no detalhe, na lista de projetos e no Progresso do Painel: pago = pago antes + parcelas pagas; falta pagar = contratado − pago (nunca negativo).
- O resumo também passa a expor `parcelado` (soma das parcelas não canceladas: real se paga, senão previsto) e `faltaParcelar` = contratado − pago antes − parcelado (pode ser negativo).

## Projetos: parcelas flexíveis

- O detalhe do item oferece três formas de lançar parcelas: **avulsa** (data e valor próprios, uma de cada vez), **N iguais** (mensais a partir de uma data) e **até o evento**.
- **"Até o evento":** primeira parcela no dia escolhido do mês atual (ou do próximo, se esse dia já passou) e uma por mês enquanto a data não passar da data do evento do projeto. Valor sugerido = falta parcelar; a última parcela absorve o arredondamento. Sem data do evento, a opção pede para defini-la.
- **Painel do item:** contratado − já pago antes do app − parcelado = falta parcelar. Aviso âmbar se ainda falta parcelar e vermelho se as parcelas passam do contratado.
- Editar e excluir parcelas pendentes continuam pelo detalhe da parcela (sem mudança).

## Itens do casamento (scripts/importar-casamento.mjs)

- Script idempotente: acha a casa real (membros Paulo e Laura, sem "[TESTE]"), usa o projeto "Casamento" (cria se faltar) e cria os itens que não existem; para itens já existentes só preenche campos vazios. Não cria parcelas nem ocorrências.
- **Buffet:** o item já existia com 3 parcelas pagas no app (R$ 4.112,16, vindas do extrato). Para não contar o mesmo pagamento duas vezes, o script desconta do "já pago antes do app" o que já está em parcelas pagas do item; no Buffet isso deu R$ 0. Os totais conferem: contratado R$ 28.792,00, pago R$ 7.834,16 (R$ 3.722,00 antes do app + R$ 4.112,16 em parcelas), falta pagar R$ 20.957,84.
- Tela do projeto: itens sem tipo/fornecedor não mostram mais o "·" solto; item sem valor mostra "sem valor ainda"; sem orçamento definido, "Livre no orçamento" vira um atalho "Defina o orçamento" em vez de um valor negativo.

## Open Finance (Meu Pluggy) — Etapa 1: reconhecimento

Só estrutura; nenhum nome, descrição, valor ou número de conta real.

- **5 itens** (1 da Laura, 4 do Paulo), todos `status UPDATED` / `executionStatus SUCCESS`, `connector.type PERSONAL_BANK`, `consentExpiresAt` presente (~365 dias). Campos do item usados: `status`, `executionStatus`, `error`, `consentExpiresAt`, `lastUpdatedAt`, `nextAutoSyncAt`.
- **Contas** (`GET /accounts?itemId=`): 5 `BANK/CHECKING_ACCOUNT`, 1 `BANK/SAVINGS_ACCOUNT`, 4 `CREDIT/CREDIT_CARD`. Campos: `id, type, subtype, name, marketingName, number, balance, currencyCode, bankData, creditData, owner, taxNumber`. `creditData` traz `creditLimit, availableCreditLimit, balanceDueDate (às vezes null), minimumPayment, brand, level, status`.
- **Transações:** `GET /transactions` (v1) responde **410 ENDPOINT_DEPRECATED**. Só `GET /v2/transactions` funciona e aceita apenas `accountId` (obrigatório), `dateFrom` e `createdAtFrom` (`pageSize`, `from`, `cursor`, `itemId` são rejeitados). Resposta `{ results, next }`; até 500 por página, mais recentes primeiro; `next` é uma query string pronta (`?accountId=…&after=…`) ou `null`.
  - Campos: `id, date (ISO UTC), description, descriptionRaw, amount, currencyCode, type (DEBIT/CREDIT), status, category, categoryId, operationType, paymentData, merchant, creditCardMetadata, balance (null), createdAt, updatedAt`.
  - **BANK:** `DEBIT` negativo e `CREDIT` positivo; `status POSTED`; `category` e `paymentData` em 100%; `merchant` em parte. Volume: de dezenas a mais de 500 transações por conta em 12 meses.
  - **CREDIT:** sinal invertido (compra = `DEBIT` **positivo**, pagamento/estorno = `CREDIT` negativo); `status PENDING` e `POSTED`; `creditCardMetadata` em 100% (`installmentNumber, totalInstallments, paymentType SINGLE/INSTALLMENT, billId, billForecastDate, billPostDate, purchaseDate, transactionDateTime, payeeMCC, cardNumber`). Um cartão já traz as parcelas futuras como transações datadas no futuro; o outro só a parcela corrente.
- **Faturas** (`GET /bills?accountId=`): 2 dos 4 cartões respondem (12–13 faturas, ~1 ano, uma com vencimento futuro). Campos: `id, dueDate, billClosingDate, totalAmount, minimumPaymentAmount, allowsInstallments, financeCharges, payments[]`. Os `billId` das transações batem 100% com as faturas. **Os outros 2 cartões não retornam faturas nem transações.**
- **Investimentos** (`GET /investments?itemId=`): 3 dos 5 itens respondem (de 8 a ~170 registros): `FIXED_INCOME/CDB` e `EQUITY/STOCK`, `status ACTIVE` ou `TOTAL_WITHDRAWAL`, com `balance`, `amount`, `type`, `subtype`, `issuer`, `dueDate`.
- **Consequências para as próximas etapas:** paginação pelo `next` da v2; filtro incremental por `dateFrom`; data convertida para o fuso de Fortaleza; sinais tratados por tipo de conta; faturas e parcelas só onde a API devolve; investimentos só ativos.
