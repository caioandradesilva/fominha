-- v0.3 (backlog B7, B8): erros do app e eventos de produto.
-- Só gravação pela API; leitura apenas pelo painel/Claude (sem política de SELECT).

create table public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  source text not null check (char_length(source) <= 60),
  message text not null check (char_length(message) <= 500),
  detail text check (char_length(detail) <= 4000),
  url text check (char_length(url) <= 300),
  user_agent text check (char_length(user_agent) <= 300),
  app_version text check (char_length(app_version) <= 40)
);
create index client_errors_time_idx on public.client_errors (created_at desc);
alter table public.client_errors enable row level security;
create policy client_errors_insert on public.client_errors for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

create table public.product_events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  user_id uuid references auth.users (id) on delete set null,
  name text not null check (char_length(name) <= 60),
  group_id uuid references public.groups (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  props jsonb not null default '{}'::jsonb check (pg_column_size(props) <= 2000)
);
create index product_events_name_time_idx on public.product_events (name, created_at desc);
create index product_events_user_idx on public.product_events (user_id);
alter table public.product_events enable row level security;
create policy product_events_insert on public.product_events for insert to anon, authenticated
  with check (user_id is null or user_id = (select auth.uid()));

-- Visões de acompanhamento (schema private: não saem pela API). Consultar pelo SQL do Supabase ou pelo Claude.

-- Resumo por evento: jogadores, registros, peças, % por toque, barcas, cobertura, abandono.
create or replace view private.v_event_summary as
with e as (
  select ev.id, ev.name, ev.group_id, ev.status, ev.starts_at,
         min(x.created_at) first_at, max(x.created_at) last_at
  from public.events ev left join public.entries x on x.event_id = ev.id
  group by ev.id
), p as (
  select x.event_id, x.user_id, max(x.created_at) last_user_at
  from public.entries x group by x.event_id, x.user_id
)
select e.id event_id, e.name, e.group_id, e.status, e.starts_at,
  (select count(distinct user_id) from public.entries where event_id = e.id) players,
  (select count(*) from public.entries where event_id = e.id) entries,
  (select coalesce(sum(count_final), 0) from public.entries where event_id = e.id) pieces,
  round(100.0 * (select count(*) from public.entries where event_id = e.id and ai_result->>'fonte' = 'rapido')
        / nullif((select count(*) from public.entries where event_id = e.id), 0)) pct_taps,
  (select count(*) from public.boats where event_id = e.id) boats,
  round(100.0 * (select coalesce(sum(count_final), 0) from public.entries where event_id = e.id and ai_result->>'fonte' = 'rapido')
        / nullif((select sum(total) from public.boats where event_id = e.id), 0)) pct_coverage,
  (select count(*) from p where p.event_id = e.id and e.last_at - p.last_user_at > interval '30 minutes') stopped_30min_early,
  round(extract(epoch from (e.last_at - e.first_at)) / 60) minutes
from e;

-- Recorrência (métrica-norte do PRD): grupos com 2+ eventos com registros em 60 dias.
create or replace view private.v_group_recurrence as
select g.id group_id, g.name, g.created_at,
  count(distinct ev.id) filter (where exists (select 1 from public.entries x where x.event_id = ev.id)) events_with_entries,
  count(distinct ev.id) filter (where ev.created_at > now() - interval '60 days'
                                  and exists (select 1 from public.entries x where x.event_id = ev.id)) events_60d,
  (select count(*) from public.group_members m where m.group_id = g.id) members
from public.groups g left join public.events ev on ev.group_id = g.id
group by g.id;

-- Eventos de produto por dia e nome.
create or replace view private.v_product_daily as
select date_trunc('day', created_at at time zone 'America/Sao_Paulo')::date dia, name, count(*) n, count(distinct user_id) pessoas
from public.product_events group by 1, 2;
