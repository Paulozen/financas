-- Regras do casal (motor de regras portado do Securo): condições sobre a descrição e o
-- valor, juntadas por E/OU, com ações de categoria, ignorar e renomear a descrição.
create table public.regras (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  operador text not null default 'and' check (operador in ('and', 'or')),
  condicoes jsonb not null default '[]'::jsonb,
  categoria_id uuid references public.categorias (id) on delete set null,
  ignorar boolean not null default false,
  nova_descricao text,
  prioridade int not null default 100,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.regras (casa_id, prioridade);
alter table public.regras enable row level security;
create policy regras_membros on public.regras for all using (public.eh_membro(casa_id)) with check (public.eh_membro(casa_id));
grant select, insert, update, delete on public.regras to authenticated;
revoke all on public.regras from anon;

-- Metas: ponto de partida (quando a meta foi definida e quanto já havia), para medir o
-- progresso a partir dali, como no Securo.
alter table public.reservas
  add column meta_desde date,
  add column meta_inicial bigint;
