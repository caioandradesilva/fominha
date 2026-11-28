-- v0.3 (backlog C3, C4, C5): restaurantes, temporada do grupo e ranking da casa.

create extension if not exists unaccent with schema extensions;

-- Normaliza texto para busca e para evitar duplicata ("Sushi + Art" = "sushi + art" = "Súshi + Art").
create or replace function private.norm(t text)
returns text language sql immutable parallel safe set search_path = '' as $$
  select lower(trim(regexp_replace(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, '')), '\s+', ' ', 'g')));
$$;

-- ─────────────────────────────────────────────────────────────
-- C3 · Restaurantes (criados pelos usuários como "não verificado"; o dono reivindica na fase 3)
-- ─────────────────────────────────────────────────────────────
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 2 and 80),
  city text check (city is null or char_length(trim(city)) <= 60),
  kind text not null default 'sushi' check (kind in ('sushi', 'pizza', 'churrasco', 'hamburguer', 'outro')),
  status text not null default 'nao_verificado' check (status in ('nao_verificado', 'verificado')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  search text generated always as (private.norm(name || ' ' || coalesce(city, ''))) stored
);
create unique index restaurants_unique_name_city on public.restaurants (private.norm(name), private.norm(coalesce(city, '')));
create index restaurants_search_idx on public.restaurants (search);
create index restaurants_created_by_idx on public.restaurants (created_by);
alter table public.restaurants enable row level security;
create policy restaurants_select on public.restaurants for select to authenticated using (true);
create policy restaurants_insert on public.restaurants for insert to authenticated
  with check (created_by = (select auth.uid()) and status = 'nao_verificado');

alter table public.events add column restaurant_id uuid references public.restaurants (id) on delete set null;
create index events_restaurant_idx on public.events (restaurant_id);

-- Os dois rodízios já feitos foram no Sushi + Art (Florianópolis)
with r as (
  insert into public.restaurants (name, city, kind, created_by)
  values ('Sushi + Art', 'Florianópolis', 'sushi', null)
  returning id
)
update public.events set restaurant_id = (select id from r) where private.norm(restaurant_name) = private.norm('Sushi + Art');

-- ─────────────────────────────────────────────────────────────
-- C4 · Temporada do grupo (padrão: 6 meses a partir da criação do grupo)
-- ─────────────────────────────────────────────────────────────
alter table public.groups
  add column season_months smallint not null default 6 check (season_months in (1, 3, 6, 12)),
  add column season_start date not null default current_date;
update public.groups set season_start = (created_at at time zone 'America/Sao_Paulo')::date;

-- ─────────────────────────────────────────────────────────────
-- C5 · Ranking público por restaurante — opt-in (o PRD manda: só quem ativa, só o apelido)
-- ─────────────────────────────────────────────────────────────
alter table public.profiles alter column public_ranking set default false;
update public.profiles set public_ranking = false;

-- Marcas por pessoa por evento naquele restaurante (só quem ativou o ranking público).
-- Peças, não pontos: cada grupo tem a sua pontuação, então a casa compara peças.
create or replace function public.restaurant_rankings(p_restaurant uuid, p_month date default null)
returns json language sql stable security definer set search_path = '' as $$
  with marks as (
    select p.id user_id, p.nickname, ev.id event_id, coalesce(ev.started_at, ev.starts_at, ev.created_at) at_,
           sum(x.count_final)::int pieces
    from public.events ev
    join public.entries x on x.event_id = ev.id
    join public.profiles p on p.id = x.user_id and p.public_ranking
    where ev.restaurant_id = p_restaurant
    group by p.id, p.nickname, ev.id
  ), month_best as (
    select distinct on (user_id) nickname, pieces, at_
    from marks
    where date_trunc('month', at_ at time zone 'America/Sao_Paulo')
          = date_trunc('month', coalesce(p_month, (now() at time zone 'America/Sao_Paulo')::date))
    order by user_id, pieces desc, at_
  )
  select json_build_object(
    'restaurant', (select json_build_object('id', id, 'name', name, 'city', city, 'status', status) from public.restaurants where id = p_restaurant),
    'record', (select json_build_object('nickname', nickname, 'pieces', pieces, 'at', at_) from marks order by pieces desc, at_ limit 1),
    'month', coalesce((select json_agg(json_build_object('nickname', nickname, 'pieces', pieces, 'at', at_) order by pieces desc, at_)
                       from (select * from month_best order by pieces desc, at_ limit 10) t), '[]'::json),
    'events', (select count(*) from public.events where restaurant_id = p_restaurant),
    'groups', (select count(distinct group_id) from public.events where restaurant_id = p_restaurant)
  );
$$;
revoke execute on function public.restaurant_rankings(uuid, date) from public, anon;
grant execute on function public.restaurant_rankings(uuid, date) to authenticated;
