-- Esquema inicial do Finanças da Casa.
-- Dinheiro sempre em centavos (bigint). Datas de negócio como date.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------
-- Casa e membros
-- ---------------------------------------------------------------
create table public.casas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo_convite text not null unique,
  saldo_conta bigint,
  saldo_conta_data date,
  racha_ativo boolean not null default false,
  racha_membro_id uuid,
  racha_mensalidade bigint not null default 2500,
  racha_diaria bigint not null default 500,
  racha_juiz bigint not null default 10000,
  criado_em timestamptz not null default now()
);

create table public.membros (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome text not null,
  criado_em timestamptz not null default now()
);
create index on public.membros (casa_id);

alter table public.casas
  add constraint casas_racha_membro_fk foreign key (racha_membro_id)
  references public.membros (id) on delete set null;

-- Função usada por todas as políticas de RLS.
create or replace function public.eh_membro(p_casa_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.membros
    where casa_id = p_casa_id and user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------
-- Categorias
-- ---------------------------------------------------------------
create table public.categorias (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  cor text not null default '#64748b',
  ativa boolean not null default true,
  ordem int not null default 0,
  criado_em timestamptz not null default now()
);
create index on public.categorias (casa_id);

-- ---------------------------------------------------------------
-- Regras que geram ocorrências
-- ---------------------------------------------------------------
create table public.cartoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  dono_membro_id uuid references public.membros (id) on delete set null,
  dia_vencimento int not null check (dia_vencimento between 1 and 31),
  dia_fechamento int check (dia_fechamento between 1 and 31),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.cartoes (casa_id);

create table public.recorrencias (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  descricao text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  modo text not null check (modo in ('fixa', 'variavel')),
  valor bigint not null check (valor >= 0),
  -- variável: true = usa sempre "valor"; false = média dos últimos 3 pagos
  valor_manual boolean not null default false,
  dia int not null check (dia between 1 and 31),
  inicio date not null,
  fim date,
  dono_membro_id uuid references public.membros (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  cartao_id uuid references public.cartoes (id) on delete cascade,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.recorrencias (casa_id);

create table public.contratos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  credor text,
  valor_total bigint not null check (valor_total >= 0),
  num_parcelas int not null check (num_parcelas > 0),
  valor_parcela bigint not null check (valor_parcela >= 0),
  dia int not null check (dia between 1 and 31),
  primeira_parcela date not null,
  parcelas_pagas_antes int not null default 0 check (parcelas_pagas_antes >= 0),
  valor_pago_antes bigint not null default 0 check (valor_pago_antes >= 0),
  dono_membro_id uuid references public.membros (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.contratos (casa_id);

create table public.dividas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  credor text,
  descricao text not null,
  valor_total bigint not null check (valor_total >= 0),
  inicio date not null,
  meta_mensal bigint check (meta_mensal > 0),
  dono_membro_id uuid references public.membros (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.dividas (casa_id);

-- ---------------------------------------------------------------
-- Projetos
-- ---------------------------------------------------------------
create table public.projetos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  data_evento date,
  orcamento bigint not null default 0 check (orcamento >= 0),
  dono_membro_id uuid references public.membros (id) on delete set null,
  status text not null default 'ativo' check (status in ('ativo', 'concluido', 'cancelado')),
  criado_em timestamptz not null default now()
);
create index on public.projetos (casa_id);

create table public.projeto_itens (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  projeto_id uuid not null references public.projetos (id) on delete cascade,
  fornecedor text,
  descricao text not null,
  tipo_item text,
  valor_orcado bigint not null default 0 check (valor_orcado >= 0),
  valor_contratado bigint not null default 0 check (valor_contratado >= 0),
  contato text,
  observacoes text,
  status text not null default 'orçando' check (status in ('orçando', 'contratado', 'quitado')),
  criado_em timestamptz not null default now()
);
create index on public.projeto_itens (projeto_id);
create index on public.projeto_itens (casa_id);

-- ---------------------------------------------------------------
-- Importação (antes de ocorrências por causa da FK)
-- ---------------------------------------------------------------
create table public.importacoes (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  membro_id uuid references public.membros (id) on delete set null,
  arquivo text not null,
  perfil text not null,
  contagens jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now()
);
create index on public.importacoes (casa_id);

create table public.transacoes_importadas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  importacao_id uuid references public.importacoes (id) on delete set null,
  hash text not null,
  data date not null,
  descricao text not null,
  valor bigint not null, -- com sinal: positivo = entrada
  acao text not null check (acao in ('novo', 'vincular', 'racha', 'ignorar')),
  criado_em timestamptz not null default now(),
  unique (casa_id, hash)
);

create table public.perfis_importacao (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  assinatura text not null,
  mapeamento jsonb not null,
  criado_em timestamptz not null default now(),
  unique (casa_id, assinatura)
);

create table public.regras_importacao (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  padrao text not null,
  acao text not null check (acao in ('novo', 'vincular', 'racha', 'ignorar')),
  categoria_id uuid references public.categorias (id) on delete set null,
  dono_membro_id uuid references public.membros (id) on delete set null,
  racha_tipo text,
  atualizado_em timestamptz not null default now(),
  unique (casa_id, padrao)
);

-- ---------------------------------------------------------------
-- Ocorrências: tudo que movimenta dinheiro
-- ---------------------------------------------------------------
create table public.ocorrencias (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  origem_tipo text not null check (origem_tipo in (
    'recorrencia', 'pontual', 'parcela_contrato', 'pagamento_divida',
    'meta_divida', 'parcela_projeto', 'fatura')),
  origem_id uuid,
  -- chave de idempotência das ocorrências geradas (ex.: rec:<id>:2026-11)
  chave text,
  descricao text not null,
  tipo text not null check (tipo in ('entrada', 'saida')),
  dono_membro_id uuid references public.membros (id) on delete set null,
  categoria_id uuid references public.categorias (id) on delete set null,
  valor_previsto bigint not null check (valor_previsto >= 0),
  valor_real bigint check (valor_real >= 0),
  previsto_manual boolean not null default false,
  vencimento date not null,
  pago_em date,
  status text not null default 'pendente' check (status in ('pendente', 'pago', 'cancelado')),
  observacao text,
  fonte text, -- "origem" das receitas pontuais (ex.: ajuda da mãe)
  parcela_num int,
  transacao_importada_id uuid references public.transacoes_importadas (id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (casa_id, chave)
);
create index on public.ocorrencias (casa_id, vencimento);
create index on public.ocorrencias (origem_tipo, origem_id);

-- ---------------------------------------------------------------
-- Reservas
-- ---------------------------------------------------------------
create table public.reservas (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  nome text not null,
  banco text,
  dono_membro_id uuid references public.membros (id) on delete set null,
  observacao text,
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on public.reservas (casa_id);

create table public.reserva_saldos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  reserva_id uuid not null references public.reservas (id) on delete cascade,
  data date not null,
  valor bigint not null check (valor >= 0),
  criado_em timestamptz not null default now()
);
create index on public.reserva_saldos (reserva_id, data);

-- ---------------------------------------------------------------
-- Caixa do racha
-- ---------------------------------------------------------------
create table public.racha_movimentos (
  id uuid primary key default gen_random_uuid(),
  casa_id uuid not null references public.casas (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('mensalidade', 'diaria', 'amistoso', 'juiz', 'outro')),
  sentido text not null check (sentido in ('entrada', 'saida')),
  valor bigint not null check (valor >= 0),
  descricao text,
  transacao_importada_id uuid references public.transacoes_importadas (id) on delete set null,
  criado_em timestamptz not null default now()
);
create index on public.racha_movimentos (casa_id, data);

-- ---------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------
alter table public.casas enable row level security;
alter table public.membros enable row level security;

create policy casas_select on public.casas for select using (public.eh_membro(id));
create policy casas_update on public.casas for update using (public.eh_membro(id)) with check (public.eh_membro(id));

create policy membros_select on public.membros for select using (public.eh_membro(casa_id));
create policy membros_update on public.membros for update
  using (user_id = auth.uid()) with check (user_id = auth.uid() and public.eh_membro(casa_id));

do $$
declare
  t text;
begin
  foreach t in array array[
    'categorias', 'cartoes', 'recorrencias', 'contratos', 'dividas', 'projetos',
    'projeto_itens', 'importacoes', 'transacoes_importadas', 'perfis_importacao',
    'regras_importacao', 'ocorrencias', 'reservas', 'reserva_saldos', 'racha_movimentos'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy %I on public.%I for all using (public.eh_membro(casa_id)) with check (public.eh_membro(casa_id))',
      t || '_membros', t);
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('revoke all on public.%I from anon', t);
  end loop;
end $$;

grant select, update on public.casas to authenticated;
grant select, update on public.membros to authenticated;
revoke all on public.casas from anon;
revoke all on public.membros from anon;
revoke all on public._migracoes from anon, authenticated;

-- ---------------------------------------------------------------
-- Onboarding
-- ---------------------------------------------------------------
create or replace function public.gerar_codigo_convite()
returns text
language plpgsql
as $$
declare
  alfabeto constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  codigo text;
begin
  loop
    codigo := '';
    for i in 1..6 loop
      codigo := codigo || substr(alfabeto, 1 + floor(random() * length(alfabeto))::int, 1);
    end loop;
    exit when not exists (select 1 from public.casas where codigo_convite = codigo);
  end loop;
  return codigo;
end;
$$;

create or replace function public.criar_casa(p_nome_casa text, p_nome_membro text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Você já faz parte de uma casa';
  end if;
  if coalesce(trim(p_nome_membro), '') = '' then
    raise exception 'Informe seu nome';
  end if;

  insert into casas (nome, codigo_convite)
  values (coalesce(nullif(trim(p_nome_casa), ''), 'Nossa casa'), gerar_codigo_convite())
  returning id into v_casa;

  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), trim(p_nome_membro));

  insert into categorias (casa_id, nome, tipo, cor, ordem) values
    (v_casa, 'Moradia', 'saida', '#6366f1', 1),
    (v_casa, 'Mercado', 'saida', '#22c55e', 2),
    (v_casa, 'Transporte', 'saida', '#f59e0b', 3),
    (v_casa, 'Saúde', 'saida', '#ef4444', 4),
    (v_casa, 'Lazer', 'saida', '#ec4899', 5),
    (v_casa, 'Contas da casa', 'saida', '#0ea5e9', 6),
    (v_casa, 'Casamento', 'saida', '#a855f7', 7),
    (v_casa, 'Dívidas', 'saida', '#b45309', 8),
    (v_casa, 'Cartão', 'saida', '#14b8a6', 9),
    (v_casa, 'Outros', 'saida', '#64748b', 10),
    (v_casa, 'Salário', 'entrada', '#16a34a', 11),
    (v_casa, 'Ajuda/Presente', 'entrada', '#84cc16', 12),
    (v_casa, 'Outras receitas', 'entrada', '#10b981', 13);

  return v_casa;
end;
$$;

create or replace function public.entrar_casa(p_codigo text, p_nome_membro text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_casa uuid;
begin
  if auth.uid() is null then
    raise exception 'Não autenticado';
  end if;
  if exists (select 1 from membros where user_id = auth.uid()) then
    raise exception 'Você já faz parte de uma casa';
  end if;
  if coalesce(trim(p_nome_membro), '') = '' then
    raise exception 'Informe seu nome';
  end if;

  select id into v_casa from casas where codigo_convite = upper(trim(p_codigo));
  if v_casa is null then
    raise exception 'Código de convite não encontrado';
  end if;
  if (select count(*) from membros where casa_id = v_casa) >= 2 then
    raise exception 'Esta casa já tem dois membros';
  end if;

  insert into membros (casa_id, user_id, nome) values (v_casa, auth.uid(), trim(p_nome_membro));
  return v_casa;
end;
$$;

revoke all on function public.criar_casa(text, text) from public, anon;
revoke all on function public.entrar_casa(text, text) from public, anon;
grant execute on function public.criar_casa(text, text) to authenticated;
grant execute on function public.entrar_casa(text, text) to authenticated;
grant execute on function public.eh_membro(uuid) to authenticated;
revoke all on function public.gerar_codigo_convite() from public, anon, authenticated;
