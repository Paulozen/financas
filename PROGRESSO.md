# Progresso

Checklist das fases (seção 8 do `PROMPT_CLAUDE_CODE.md`).

- [x] Fase 0 — Base: .gitignore, análise das amostras, scaffold, dependências, clientes Supabase, db:migrate, PROGRESSO/DECISOES
- [x] Fase 1 — Banco e acesso: tabelas, índices, RLS, funções; login, onboarding, layout, navegação, tema, PWA
- [x] Fase 2 — Núcleo: categorias, receitas/despesas, motor de ocorrências, Lançamentos, pagar/desfazer, testes do motor
- [x] Fase 3 — Compromissos: parcelados, dívidas flexíveis, cartões, testes da meta
- [x] Fase 4 — Projetos
- [x] Fase 5 — Reservas e Racha
- [x] Fase 6 — Painel e testes de sobra/projeção
- [x] Fase 7 — Importação
- [x] Fase 8 — Acabamento e README

## O que foi construído

- **Acesso:** login por e-mail/senha, sair, onboarding (criar casa com código de convite ou entrar com código, nome de exibição), no máximo dois membros por casa. RLS em todas as tabelas com `eh_membro(casa_id)`; verificado com `scripts/verificar-rls.mjs`.
- **Visão global** Membro 1 / Membro 2 / Casal no topo das telas; dono em quase todo registro (vazio = Casal).
- **Ocorrências** como tabela central: motor idempotente que gera 12 meses à frente ao abrir o app e após cada alteração; editar regra mexe só nas futuras pendentes; pagar (valor real, data, observação, "usar como estimativa das próximas"), desfazer, cancelar um mês, ajustar o previsto de um mês.
- **Lançamentos:** lista do mês com navegação, filtros (tipo, status, categoria, dono), totais previsto/realizado, botão "+" para lançamento rápido (pontual, com "origem" nas receitas); aba Recorrentes (fixas e variáveis com média dos últimos 3 pagos).
- **Compromissos:** parcelados (detalhe com pagas/restantes, total pago, saldo devedor estimado), dívidas flexíveis (pagamentos avulsos, meta mensal com abatimento, % quitado, histórico, concluída), cartões (fatura variável automática).
- **Projetos:** orçamento, itens com fornecedor/tipo/valores/status, parcelas (N iguais), resumo orçado × contratado × pago × falta pagar, próximas parcelas.
- **Reservas:** saldos com histórico e gráfico de evolução; "Total guardado" separado.
- **Caixa do racha:** saldo (vermelho com aviso quando negativo), botões rápidos com quantidade, resumo e lista por mês; fora de todas as contas do casal.
- **Painel:** sobra do mês (previsto/realizado), projeção de 12 meses (negativos em vermelho, saldo acumulado opcional), vencimentos (atrasados + 15 dias, com botão Pagar), progresso, gastos por categoria, total guardado e caixa do racha.
- **Importação:** OFX/CSV/XLSX (inclusive XLSX de uma coluna com linhas CSV), perfil pronto para o formato PicPay, mapeamento salvo como perfil para bancos novos, prévia com ações (novo, vincular, racha, ignorar), seleção múltipla e ações em lote, filtros por tipo/texto e "importar a partir de", sugestões (cofrinho → Ignorar), regras aprendidas, deduplicação por hash, histórico de importações.
- **PWA:** manifest, ícones gerados, service worker básico; tema claro/escuro seguindo o sistema; layout mobile-first com barra inferior.
- **Testes:** 50 testes (motor, meta da dívida, resumos, painel, reservas/racha, parsers e sugestões de importação com fixtures anonimizadas).

## Roteiro de testes manuais (para o casal)

1. **Acesso:** a primeira pessoa entra e cria a casa; copie o código em Mais → Configurações; a segunda pessoa entra com o código. Confira o seletor de visão com os dois nomes + Casal.
2. **Salários:** Lançamentos → Recorrentes → nova receita fixa "Salário" para cada um (dono = a pessoa, dia do pagamento). Volte ao Painel: a projeção deve mostrar 12 meses.
3. **Conta fixa e variável:** cadastre o aluguel (fixa, Casal) e a conta de luz (variável). Pague a luz deste mês com um valor diferente do previsto e confira no mês seguinte que o previsto virou a média.
4. **Pagar e desfazer:** no Painel, em Vencimentos, toque em Pagar numa conta; confira em Lançamentos que ficou "Pago". Abra a ocorrência e use "Desfazer pagamento".
5. **Parcela com valor diferente:** Compromissos → Parcelados → cadastre a construtora (nº de parcelas, já pagas, valor estimado). Pague a próxima parcela com um valor maior (reajuste) marcando "usar este valor como estimativa das próximas" e confira o saldo devedor e as parcelas seguintes.
6. **Dívida do carro:** Compromissos → Dívidas → cadastre com meta mensal. Registre um pagamento avulso menor que a meta (a meta do mês diminui) e depois outro que complete a meta (ela aparece como cumprida).
7. **Cartão:** cadastre um cartão; ajuste o valor da fatura do mês tocando nela.
8. **Casamento:** Projetos → novo projeto "Casamento" com orçamento; adicione um item (ex.: buffet) com valor contratado e gere 6 parcelas iguais; pague a primeira e confira o resumo e as próximas parcelas.
9. **Racha:** Mais → Configurações → ative o caixa do racha e escolha quem organiza. Em Mais → Caixa do racha, lance "+ Diária" com quantidade 8 e "− Juiz"; confira o saldo e o aviso se ficar negativo. Confira que nada disso aparece no Painel além do número do rodapé.
10. **Reservas:** cadastre um CDB com saldo, atualize o saldo com outra data e veja o gráfico.
11. **Importação:** Mais → Importar extrato → escolha de quem é o extrato e o arquivo do PicPay. Confira que o perfil foi reconhecido, que "Troco guardado/Dinheiro guardado/resgatado/Rendimento" vieram como Ignorar, use o filtro "importar a partir de" e uma ação em lote, e confirme. Importe o mesmo arquivo de novo: as linhas devem aparecer como "já importada".
12. **Celular:** instale o app na tela inicial (ver README) e confira o modo escuro.

## Limitações conhecidas e pendências

- **Telas não foram vistas num navegador durante a construção** (o ambiente não tinha navegador). Build, lint, tipos e testes passam e as rotas respondem 200 no servidor de produção local, mas a revisão visual no tamanho de celular e o fluxo completo logado ficam para o roteiro acima.
- **O motor de ocorrências roda no navegador** ao abrir o app (não há cron). Se ninguém abrir o app por mais de 12 meses, os meses seguintes só aparecem na próxima abertura.
- **Ao reimportar um extrato, escolha o mesmo dono** da primeira vez: o dono faz parte da chave de deduplicação (para extratos de pessoas diferentes no mesmo banco não colidirem).
- **Regras aprendidas** só reconhecem descrições iguais depois de normalizadas (sem acentos, números e pontuação); não há tela para editar/apagar regras (dá para mudar a sugestão na prévia, e a nova escolha sobrescreve a regra).
- **Parcelados longos** (ex.: 360 parcelas) só têm ocorrências geradas dentro da janela de 12 meses; o restante aparece com o tempo.
- **Offline:** o service worker guarda só a casca do app; sem internet não há dados.
- **Excluir categoria** não existe (só desativar), para não deixar lançamentos órfãos.
- Não foram criados dados de teste no banco real: as verificações de RLS e da importação rodam numa transação desfeita.

## Notas / problemas

- Nenhum bloqueio durante a construção.
- **Corrigido depois da entrega:** a página provisória da fase 0 (`src/app/page.tsx`) não tinha sido apagada e cobria o Painel em "/". Removida; "/" agora redireciona para o login e foi conferido num navegador headless (Chromium, tamanho de celular, claro e escuro).

## Open Finance (Meu Pluggy)

Integração feita em 6 etapas (detalhes em `DECISOES.md`): reconhecimento da API, sincronização no servidor com a sessão do usuário, caixa de entrada para contas correntes, cartões (faturas, parcelas e previsão), investimentos ligados a reservas e estado das conexões.

### Roteiro de teste da integração

1. **Vercel:** cadastrar `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET`, `PLUGGY_ITEMS_PAULO` e `PLUGGY_ITEMS_LAURA` em Settings → Environment Variables (Production) e fazer um novo deploy. Sem isso o site mostra "Nenhum banco configurado".
2. **Configurações → Bancos conectados:** tocar em "Sincronizar agora". Conferir os bancos de cada um, com "Em dia", a data da última sincronização e a validade da autorização (~1 ano). Conferir os nomes das contas e os donos (dá para trocar).
3. **Painel:** deve aparecer o atalho "N transações dos bancos para revisar". A projeção passa a usar o saldo das contas conectadas.
4. **Caixa de entrada:** conferir as sugestões (salário, entrada do apartamento e financiamento de outubro como Vincular, pagamentos de fatura vinculados à fatura, rendimentos e transferências entre contas como Ignorar), selecionar algumas e "Confirmar sugestões selecionadas". Ver em Lançamentos que viraram pagos/novos. Na aba Histórico, desfazer uma.
5. **Regras automáticas:** ligar "Aplicar regras aprendidas automaticamente", sincronizar de novo e ver no Histórico as marcadas como "automática".
6. **Cartões:** Compromissos → Cartões → "Detalhes" de um cartão vinculado ao banco: parcelas em aberto, comprometido por mês, faturas do banco e compras por fatura. Mudar a categoria de uma compra. No Painel, abrir "Cartão" em Gastos por categoria.
7. **Reservas:** editar uma reserva e vincular a um investimento do banco; o saldo passa a ser automático.
8. **Importação por arquivo:** continua disponível como alternativa (por exemplo, para um banco sem conexão). Para períodos que já vieram pelo Open Finance, use a caixa de entrada (ver limitações).

### Limitações encontradas

- A API de transações v1 foi desativada (410); só a v2 funciona, e aceita apenas `accountId`, `dateFrom` e `createdAtFrom`.
- **Dois dos quatro cartões não retornam faturas nem transações** (inclusive o cartão da Laura e um cartão sem uso do Paulo). Para eles o previsto da fatura continua manual.
- A Pluggy atualiza os bancos a cada 24 horas e não aceita atualização manual no Meu Pluggy: o "Sincronizar agora" traz o que a Pluggy já tem.
- Autorização de leitura dura um ano; ao renovar, o itemId pode mudar e é preciso atualizar o `.env.local` e a Vercel (o app avisa no Painel com 30 dias de antecedência).
- Investimentos: o banco da Laura devolve ~170 registros (cada aplicação do cofrinho vira um CDB); só os ativos com saldo aparecem para vincular.
- O reconhecimento de duplicadas com arquivos é por conta (valor + data quando a conta é a mesma do arquivo). Se um arquivo for importado **depois** de a caixa confirmar o mesmo período, a importação por arquivo não conhece o hash da Pluggy e pode duplicar: prefira a caixa de entrada para períodos já sincronizados.
- Previsão de fatura futura: no cartão vinculado, o previsto é recalculado a cada sincronização; um ajuste manual vale até a próxima.

## Visual novo e análises (inspirado no Kova)

- [x] Base visual azul (cores, fonte Inter, cartões, abas, barra inferior flutuante, botão "+")
- [x] Painel com faixa de destaque (total guardado, mês em três números, atalhos) e botão para esconder valores
- [x] Rosca de gastos por categoria com faturas abertas nas compras
- [x] Ritmo de gastos (acumulado vs mês anterior, por dia, média)
- [x] Tela de Análises (mês/trimestre/ano) com "Vale sua atenção" e "Ver como foi calculado"
- [x] Categorias com ícone, limite mensal e essencial (migração 007), tela em grade
- [x] Testes das análises (8)
