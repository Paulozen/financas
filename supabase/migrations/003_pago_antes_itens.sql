-- Itens de projeto: valor já pago antes de usar o app.
-- Não gera ocorrência (fica fora da sobra e da projeção), mas entra nos totais do projeto.
alter table public.projeto_itens
  add column valor_pago_antes bigint not null default 0 check (valor_pago_antes >= 0);
