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
- **PROMPT_CLAUDE_CODE.md** fica fora do Git (arquivo local de instruções).

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
