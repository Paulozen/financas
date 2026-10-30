-- Open Finance (Meu Pluggy): itens, contas, transações, faturas e investimentos externos.
-- A sincronização roda numa rota do servidor com a sessão do usuário (RLS vale).

-- Estado de sincronização por item (um item = um banco conectado).
create table public.pluggy_itens (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  pluggy_item_id text not null,
  dono_membro_id uuid references public.membros (id) on delete set null,
  banco text,
  status text,
  execution_status text,
  erro_codigo text,
  erro_mensagem text,
  consent_expires_at timestamptz,
  ultima_sincronizacao timestamptz,
  ultimo_erro text,
  atualizado_em timestamptz not null default now(),
  unique (casa_id, pluggy_item_id)
);

create table public.contas_externas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  dono_membro_id uuid references public.membros (id) on delete set null,
  -- true quando o dono foi trocado na tela (não volta ao padrão do .env)
  dono_manual boolean not null default false,
  pluggy_item_id text not null,
  pluggy_account_id text not null,
  tipo text not null, -- BANK | CREDIT
  subtipo text,
  nome text not null,
  saldo bigint,
  saldo_em timestamptz,
  dados jsonb not null default '{}'::jsonb, -- limite, vencimento etc. (creditData resumido)
  cartao_id uuid references public.cartoes (id) on delete set null,
  ativa boolean not null default true,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  unique (casa_id, pluggy_account_id)
);
create index on public.contas_externas (casa_id);

create table public.transacoes_externas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  conta_externa_id uuid not null references public.contas_externas (id) on delete cascade,
  pluggy_id text not null,
  data date not null,
  descricao text not null,
  -- centavos. Conta corrente: positivo = entrada. Cartão: positivo = compra.
  valor bigint not null,
  tipo_pluggy text,
  status_pluggy text,
  categoria_pluggy text,
  parcela_num int,
  parcelas_total int,
  data_compra date,
  bill_id text,
  fatura_mes text, -- aaaa-mm do vencimento da fatura (cartões)
  -- pendente = na caixa de entrada; confirmada; duplicada = já veio por arquivo; cartao = compra de cartão (detalhe da fatura)
  situacao text not null check (situacao in ('pendente', 'confirmada', 'duplicada', 'cartao')),
  acao text check (acao in ('novo', 'vincular', 'racha', 'ignorar')),
  automatica boolean not null default false,
  categoria_id uuid references public.categorias (id) on delete set null,
  transacao_importada_id uuid references public.transacoes_importadas (id) on delete set null,
  confirmada_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (casa_id, pluggy_id)
);
create index on public.transacoes_externas (casa_id, situacao);
create index on public.transacoes_externas (conta_externa_id, fatura_mes);

create table public.faturas_externas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  conta_externa_id uuid not null references public.contas_externas (id) on delete cascade,
  pluggy_bill_id text not null,
  vencimento date not null,
  fechamento date,
  valor bigint not null,
  minimo bigint,
  pago bigint not null default 0,
  atualizado_em timestamptz not null default now(),
  unique (casa_id, pluggy_bill_id)
);

create table public.investimentos_externos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  pluggy_item_id text not null,
  pluggy_investment_id text not null,
  nome text not null,
  tipo text,
  subtipo text,
  emissor text,
  vencimento date,
  saldo bigint not null default 0,
  status text,
  reserva_id uuid references public.reservas (id) on delete set null,
  atualizado_em timestamptz not null default now(),
  unique (casa_id, pluggy_investment_id)
);

alter table public.casas add column aplicar_regras_auto boolean not null default false;

do $$
declare
  t text;
begin
  foreach t in array array['pluggy_itens', 'contas_externas', 'transacoes_externas', 'faturas_externas', 'investimentos_externos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (public.eh_membro(casa_id)) with check (public.eh_membro(casa_id))',
      t || '_membros', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

-- Confirma linhas da caixa de entrada reaproveitando a confirmação da importação por arquivo.
-- Cada linha traz hash = 'pluggy:<id>' e o mesmo formato de confirmar_importacao.
create or replace function public.confirmar_caixa_entrada(
  p_casa uuid,
  p_membro uuid,
  p_linhas jsonb,
  p_automatica boolean default false
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_cont jsonb;
begin
  v_cont := public.confirmar_importacao(
    p_casa, p_membro,
    case when p_automatica then 'Open Finance (regras automáticas)' else 'Open Finance (caixa de entrada)' end,
    'Pluggy', p_linhas);

  update transacoes_externas t
  set situacao = 'confirmada',
      acao = l->>'acao',
      automatica = p_automatica,
      categoria_id = coalesce(nullif(l->>'categoria_id', '')::uuid, t.categoria_id),
      transacao_importada_id = ti.id,
      confirmada_em = now(),
      atualizado_em = now()
  from jsonb_array_elements(p_linhas) l
  join transacoes_importadas ti on ti.casa_id = p_casa and ti.hash = l->>'hash'
  where t.casa_id = p_casa
    and t.pluggy_id = substr(l->>'hash', 8)
    and t.situacao = 'pendente';

  return v_cont;
end;
$$;

-- Desfaz uma confirmação: apaga o que foi criado (ou desvincula) e devolve à caixa de entrada.
create or replace function public.desfazer_confirmacao(p_externa uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_t transacoes_externas%rowtype;
begin
  select * into v_t from transacoes_externas where id = p_externa;
  if v_t.id is null or v_t.situacao <> 'confirmada' then
    raise exception 'Transação não está confirmada';
  end if;
  if v_t.transacao_importada_id is not null then
    -- vínculo: a ocorrência volta a pendente; lançamento novo: é apagado
    if v_t.acao = 'vincular' then
      update ocorrencias
      set status = 'pendente', valor_real = null, pago_em = null, transacao_importada_id = null
      where transacao_importada_id = v_t.transacao_importada_id;
    else
      delete from ocorrencias where transacao_importada_id = v_t.transacao_importada_id;
    end if;
    delete from racha_movimentos where transacao_importada_id = v_t.transacao_importada_id;
    delete from transacoes_importadas where id = v_t.transacao_importada_id;
  end if;
  update transacoes_externas
  set situacao = 'pendente', acao = null, automatica = false, transacao_importada_id = null, confirmada_em = null, atualizado_em = now()
  where id = p_externa;
end;
$$;

revoke all on function public.confirmar_caixa_entrada(uuid, uuid, jsonb, boolean) from public, anon;
grant execute on function public.confirmar_caixa_entrada(uuid, uuid, jsonb, boolean) to authenticated;
revoke all on function public.desfazer_confirmacao(uuid) from public, anon;
grant execute on function public.desfazer_confirmacao(uuid) to authenticated;
