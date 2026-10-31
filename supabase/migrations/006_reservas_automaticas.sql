-- Reservas automáticas: cada grupo de investimentos da Pluggy (dono + banco + tipo)
-- vira uma reserva, com o saldo gravado no histórico a cada sincronização.

alter table public.reservas
  add column automatica boolean not null default false,
  add column grupo_chave text; -- "<itemId>|<tipo>|<subtipo>"

create unique index reservas_grupo_chave_unico on public.reservas (casa_id, grupo_chave) where grupo_chave is not null;

-- Aplicação movida pelo usuário para outro grupo: a sincronização não a devolve.
alter table public.investimentos_externos add column reserva_manual boolean not null default false;

-- Reservas manuais que estavam ligadas a aplicações isoladas: as aplicações voltam
-- a ficar soltas (entram no grupo automático na próxima sincronização) e a reserva
-- manual sai do total, para o mesmo dinheiro não contar duas vezes.
update public.reservas r
set ativa = false,
    observacao = trim(coalesce(r.observacao, '') || ' (substituída pela reserva automática do Open Finance)')
where not r.automatica
  and exists (select 1 from public.investimentos_externos i where i.reserva_id = r.id);

update public.investimentos_externos i
set reserva_id = null
from public.reservas r
where r.id = i.reserva_id and not r.automatica;
