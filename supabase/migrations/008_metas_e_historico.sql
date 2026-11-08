-- Metas nas reservas (valor e data alvo) e histórico diário do saldo das contas conectadas
-- (para a evolução do patrimônio). Ideias trazidas do Securo.
alter table public.reservas
  add column meta_valor bigint check (meta_valor is null or meta_valor > 0),
  add column meta_data date;

create table public.conta_saldos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  conta_externa_id uuid not null references public.contas_externas (id) on delete cascade,
  data date not null,
  valor bigint not null,
  unique (conta_externa_id, data)
);
create index on public.conta_saldos (casa_id, data);

alter table public.conta_saldos enable row level security;
create policy conta_saldos_membros on public.conta_saldos for all using (public.eh_membro(casa_id)) with check (public.eh_membro(casa_id));
grant select, insert, update, delete on public.conta_saldos to authenticated;
revoke all on public.conta_saldos from anon;

-- Primeiro ponto do histórico: o saldo atual de cada conta corrente.
insert into public.conta_saldos (casa_id, conta_externa_id, data, valor)
select casa_id, id, (coalesce(saldo_em, now()) at time zone 'America/Fortaleza')::date, saldo
from public.contas_externas
where tipo = 'BANK' and saldo is not null
on conflict do nothing;
