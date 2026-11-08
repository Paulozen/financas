-- Categorias: ícone, limite mensal (orçamento) e marcação de gasto essencial.
-- icone null = escolhido pelo nome; essencial null = decidido pelo nome (ex.: Lazer não é essencial).
alter table public.categorias
  add column icone text,
  add column limite_mensal bigint check (limite_mensal is null or limite_mensal > 0),
  add column essencial boolean;
