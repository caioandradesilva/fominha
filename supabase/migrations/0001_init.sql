-- Rodizium · versão zero
-- Tabelas, regras de acesso (RLS), funções de convite, bucket de fotos e realtime.
-- Rode este arquivo inteiro uma vez no SQL Editor do Supabase.

-- ─────────────────────────────────────────────────────────────
-- Tabelas
-- ─────────────────────────────────────────────────────────────

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null check (char_length(trim(nickname)) between 1 and 24),
  avatar_url text,
  public_ranking boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  invite_code text not null unique
    default substr(replace(gen_random_uuid()::text, '-', ''), 1, 10),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 60),
  restaurant_name text check (restaurant_name is null or char_length(restaurant_name) <= 80),
  starts_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'closed')),
  created_by uuid not null default auth.uid() references auth.users (id),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  closed_at timestamptz
);

create table public.entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  photo_path text,
  count_ai integer check (count_ai is null or count_ai >= 0),
  count_final integer not null check (count_final between 0 and 200),
  ai_result jsonb,
  created_at timestamptz not null default now()
);

create index on public.group_members (user_id);
create index on public.events (group_id);
create index on public.entries (event_id);

alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.events enable row level security;
alter table public.entries enable row level security;

-- ─────────────────────────────────────────────────────────────
-- Funções auxiliares (security definer evita recursão nas regras)
-- ─────────────────────────────────────────────────────────────

create or replace function public.is_group_member(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_admin(gid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.event_group(eid uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select group_id from public.events where id = eid;
$$;

create or replace function public.event_is_live(eid uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.events where id = eid and status = 'live');
$$;

create or replace function public.shares_group_with(other uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = other
  );
$$;

-- Quem cria o grupo vira admin automaticamente
create or replace function public.handle_new_group()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'admin');
  return new;
end;
$$;

create trigger on_group_created
  after insert on public.groups
  for each row execute function public.handle_new_group();

-- Prévia do convite (para quem ainda não é membro)
create or replace function public.invite_preview(code text)
returns table (group_id uuid, group_name text, member_count bigint, invited_by text)
language sql stable security definer set search_path = '' as $$
  select g.id, g.name,
         (select count(*) from public.group_members m where m.group_id = g.id),
         (select p.nickname from public.profiles p where p.id = g.created_by)
  from public.groups g
  where g.invite_code = code;
$$;

-- Entrar no grupo pelo código do convite
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  gid uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select id into gid from public.groups where invite_code = code;
  if gid is null then
    raise exception 'invalid invite code';
  end if;
  insert into public.group_members (group_id, user_id)
  values (gid, auth.uid())
  on conflict do nothing;
  return gid;
end;
$$;

grant execute on function public.invite_preview(text) to anon, authenticated;
grant execute on function public.join_group(text) to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Regras de acesso (RLS)
-- ─────────────────────────────────────────────────────────────

-- profiles: você vê o seu e o de quem está em algum grupo com você
create policy "profiles_select" on public.profiles for select to authenticated
  using (id = auth.uid() or public.shares_group_with(id));
create policy "profiles_insert_own" on public.profiles for insert to authenticated
  with check (id = auth.uid());
create policy "profiles_update_own" on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: membros veem; qualquer usuário logado cria; admin edita e apaga
create policy "groups_select" on public.groups for select to authenticated
  using (public.is_group_member(id));
create policy "groups_insert" on public.groups for insert to authenticated
  with check (created_by = auth.uid());
create policy "groups_update_admin" on public.groups for update to authenticated
  using (public.is_group_admin(id));
create policy "groups_delete_admin" on public.groups for delete to authenticated
  using (public.is_group_admin(id));

-- group_members: membros veem a lista; você pode sair; admin remove
create policy "members_select" on public.group_members for select to authenticated
  using (public.is_group_member(group_id));
create policy "members_delete" on public.group_members for delete to authenticated
  using (user_id = auth.uid() or public.is_group_admin(group_id));

-- events: membros veem e criam; admin começa, encerra, edita e apaga
create policy "events_select" on public.events for select to authenticated
  using (public.is_group_member(group_id));
create policy "events_insert" on public.events for insert to authenticated
  with check (public.is_group_member(group_id) and created_by = auth.uid());
create policy "events_update_admin" on public.events for update to authenticated
  using (public.is_group_admin(group_id));
create policy "events_delete_admin" on public.events for delete to authenticated
  using (public.is_group_admin(group_id));

-- entries: membros veem; você registra os seus pratos com o evento ao vivo;
-- você corrige ou apaga os seus enquanto está ao vivo; admin corrige qualquer um
create policy "entries_select" on public.entries for select to authenticated
  using (public.is_group_member(public.event_group(event_id)));
create policy "entries_insert_own_live" on public.entries for insert to authenticated
  with check (
    user_id = auth.uid()
    and public.is_group_member(public.event_group(event_id))
    and public.event_is_live(event_id)
  );
create policy "entries_update" on public.entries for update to authenticated
  using (
    (user_id = auth.uid() and public.event_is_live(event_id))
    or public.is_group_admin(public.event_group(event_id))
  );
create policy "entries_delete" on public.entries for delete to authenticated
  using (
    (user_id = auth.uid() and public.event_is_live(event_id))
    or public.is_group_admin(public.event_group(event_id))
  );

-- ─────────────────────────────────────────────────────────────
-- Fotos dos pratos (Storage, bucket privado)
-- Caminho: <event_id>/<user_id>/<arquivo>.jpg
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plates', 'plates', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "plates_insert_own" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'plates'
    and (storage.foldername(name))[2] = auth.uid()::text
    and public.is_group_member(public.event_group(((storage.foldername(name))[1])::uuid))
  );
create policy "plates_select_members" on storage.objects for select to authenticated
  using (
    bucket_id = 'plates'
    and public.is_group_member(public.event_group(((storage.foldername(name))[1])::uuid))
  );

-- ─────────────────────────────────────────────────────────────
-- Placar ao vivo
-- ─────────────────────────────────────────────────────────────

alter publication supabase_realtime add table public.entries, public.events;

-- Garante acesso pela API mesmo se a liberação automática estiver desligada
grant select, insert, update, delete on
  public.profiles, public.groups, public.group_members, public.events, public.entries
  to authenticated;
