-- v0.3 (backlog B5, B6, B2, B3): segurança, exclusão de conta, cotas e custo da IA.

-- ─────────────────────────────────────────────────────────────
-- B5 · Segurança e desempenho (avisos do Supabase)
-- ─────────────────────────────────────────────────────────────
-- Função de manutenção que não deve ser chamada pela API.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Índices das chaves estrangeiras
create index if not exists boats_created_by_idx on public.boats (created_by);
create index if not exists boats_edited_by_idx on public.boats (edited_by);
create index if not exists entries_user_id_idx on public.entries (user_id);
create index if not exists entries_edited_by_idx on public.entries (edited_by);
create index if not exists events_created_by_idx on public.events (created_by);
create index if not exists groups_created_by_idx on public.groups (created_by);

-- Regras de acesso: auth.uid() calculado uma vez por consulta, não por linha
alter policy boats_delete on public.boats using (((created_by = (select auth.uid())) and private.event_is_live(event_id)) or private.is_group_admin(private.event_group(event_id)));
alter policy boats_insert on public.boats with check ((created_by = (select auth.uid())) and private.is_group_member(private.event_group(event_id)) and private.event_is_live(event_id));
alter policy entries_delete on public.entries using (((user_id = (select auth.uid())) and private.event_is_live(event_id)) or private.is_group_admin(private.event_group(event_id)));
alter policy entries_insert_own_live on public.entries with check ((user_id = (select auth.uid())) and private.is_group_member(private.event_group(event_id)) and private.event_is_live(event_id));
alter policy entries_update on public.entries using (((user_id = (select auth.uid())) and private.event_is_live(event_id)) or private.is_group_admin(private.event_group(event_id)));
alter policy events_insert on public.events with check (private.is_group_member(group_id) and (created_by = (select auth.uid())));
alter policy members_delete on public.group_members using ((user_id = (select auth.uid())) or private.is_group_admin(group_id));
alter policy groups_insert on public.groups with check (created_by = (select auth.uid()));
alter policy groups_select on public.groups using ((created_by = (select auth.uid())) or private.is_group_member(id));
alter policy profiles_insert_own on public.profiles with check (id = (select auth.uid()));
alter policy profiles_select on public.profiles using ((id = (select auth.uid())) or private.shares_group_with(id));
alter policy profiles_update_own on public.profiles using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ─────────────────────────────────────────────────────────────
-- B6 · Excluir conta
-- Apagar a pessoa leva: perfil, participação nos grupos, registros (e as fotos dos pratos dela).
-- Fica (sem autor): grupos, eventos e barcas que ela criou, porque são do grupo.
-- ─────────────────────────────────────────────────────────────
alter table public.events alter column created_by drop not null;
alter table public.events drop constraint events_created_by_fkey,
  add constraint events_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.groups alter column created_by drop not null;
alter table public.groups drop constraint groups_created_by_fkey,
  add constraint groups_created_by_fkey foreign key (created_by) references auth.users (id) on delete set null;
alter table public.boats alter column created_by drop not null;
alter table public.boats drop constraint boats_created_by_fkey,
  add constraint boats_created_by_fkey foreign key (created_by) references public.profiles (id) on delete set null;

-- A trava "autor da barca não muda" deixa o banco apagar o autor (conta excluída)
create or replace function private.track_boat_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_id is distinct from old.event_id
     or (new.created_by is distinct from old.created_by and new.created_by is not null) then
    raise exception 'boat owner and event cannot change';
  end if;
  new.edited_by := old.edited_by;
  new.edited_at := old.edited_at;
  new.total_original := old.total_original;
  if new.counts is distinct from old.counts or new.total is distinct from old.total then
    new.edited_by := auth.uid();
    new.edited_at := now();
    new.total_original := coalesce(old.total_original, old.total);
  end if;
  return new;
end;
$$;

-- Último membro saiu: o grupo vazio é apagado. Último admin saiu: o membro mais antigo assume.
create or replace function private.ensure_group_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.group_members where group_id = old.group_id) then
    delete from public.groups where id = old.group_id;
    return null;
  end if;
  if old.role = 'admin' and not exists (
    select 1 from public.group_members where group_id = old.group_id and role = 'admin'
  ) then
    update public.group_members set role = 'admin'
    where group_id = old.group_id
      and user_id = (select user_id from public.group_members where group_id = old.group_id order by joined_at limit 1);
  end if;
  return null;
end;
$$;

-- Passo 1: apaga os registros da pessoa e devolve as fotos de prato dela (o app apaga do Storage).
create or replace function public.forget_my_entries()
returns setof text language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  return query
    with gone as (delete from public.entries where user_id = auth.uid() returning photo_path)
    select photo_path from gone where photo_path is not null;
end;
$$;

-- Passo 2: apaga a conta (o resto vai em cascata).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.forget_my_entries() from public, anon;
revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.forget_my_entries() to authenticated;
grant execute on function public.delete_my_account() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- B2 + B3 · Cotas da IA e custo por foto
-- ─────────────────────────────────────────────────────────────
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users (id) on delete set null,
  event_id uuid references public.events (id) on delete set null,
  created_at timestamptz not null default now(),
  mode text not null,
  model text,
  ok boolean not null,
  error_code text,
  input_tokens integer,
  output_tokens integer,
  ms_ai integer,
  ms_total integer
);
create index ai_usage_user_time_idx on public.ai_usage (user_id, created_at desc);
create index ai_usage_event_idx on public.ai_usage (event_id);
create index ai_usage_time_idx on public.ai_usage (created_at desc);
alter table public.ai_usage enable row level security;
-- Cada um grava e lê só o próprio uso (a rota da IA grava com a sessão da pessoa)
create policy ai_usage_insert_own on public.ai_usage for insert to authenticated with check (user_id = (select auth.uid()));
create policy ai_usage_select_own on public.ai_usage for select to authenticated using (user_id = (select auth.uid()));

-- Contagens para as cotas, sem expor o uso dos outros: minhas fotos nas últimas 24 h,
-- minhas fotos neste evento, fotos do evento inteiro e fotos do app inteiro nas últimas 24 h.
create or replace function public.ai_quota(p_event uuid)
returns json language sql stable security definer set search_path = '' as $$
  select json_build_object(
    'user_day', (select count(*) from public.ai_usage where user_id = auth.uid() and created_at > now() - interval '24 hours'),
    'user_event', (select count(*) from public.ai_usage where user_id = auth.uid() and event_id = p_event),
    'event_total', (select count(*) from public.ai_usage where event_id = p_event),
    'global_day', (select count(*) from public.ai_usage where created_at > now() - interval '24 hours')
  );
$$;
revoke execute on function public.ai_quota(uuid) from public, anon;
grant execute on function public.ai_quota(uuid) to authenticated;
