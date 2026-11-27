-- v0.2 item 3: vários admins e correção de registros com rastro.

-- ─────────────────────────────────────────────────────────────
-- 1. Papel de membro: só admin muda, e o grupo nunca fica sem admin
-- ─────────────────────────────────────────────────────────────
create or replace function public.set_member_role(p_group uuid, p_user uuid, p_role text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_role not in ('admin', 'member') then
    raise exception 'invalid role';
  end if;
  if not private.is_group_admin(p_group) then
    raise exception 'only admins can change roles';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group and user_id = p_user) then
    raise exception 'not a member';
  end if;
  if p_role = 'member' and not exists (
    select 1 from public.group_members
    where group_id = p_group and role = 'admin' and user_id <> p_user
  ) then
    raise exception 'last admin';
  end if;
  update public.group_members set role = p_role where group_id = p_group and user_id = p_user;
end;
$$;
revoke execute on function public.set_member_role(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, uuid, text) to authenticated;

-- Se o último admin sai (ou é removido), o membro mais antigo vira admin.
create or replace function private.ensure_group_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if old.role = 'admin' and not exists (
    select 1 from public.group_members where group_id = old.group_id and role = 'admin'
  ) then
    update public.group_members set role = 'admin'
    where group_id = old.group_id
      and user_id = (
        select user_id from public.group_members
        where group_id = old.group_id
        order by joined_at
        limit 1
      );
  end if;
  return null;
end;
$$;
create trigger group_members_keep_admin
  after delete on public.group_members
  for each row execute function private.ensure_group_admin();

-- ─────────────────────────────────────────────────────────────
-- 2. Rastro de correção em registros e barcas
-- ─────────────────────────────────────────────────────────────
alter table public.entries
  add column edited_by uuid references auth.users (id) on delete set null,
  add column edited_at timestamptz,
  add column count_original integer;
alter table public.boats
  add column edited_by uuid references auth.users (id) on delete set null,
  add column edited_at timestamptz,
  add column total_original integer;

create or replace function private.track_entry_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.user_id is distinct from old.user_id or new.event_id is distinct from old.event_id then
    raise exception 'entry owner and event cannot change';
  end if;
  -- campos de rastro só o banco escreve
  new.edited_by := old.edited_by;
  new.edited_at := old.edited_at;
  new.count_original := old.count_original;
  if new.count_final is distinct from old.count_final or new.ai_result is distinct from old.ai_result then
    new.edited_by := auth.uid();
    new.edited_at := now();
    new.count_original := coalesce(old.count_original, old.count_final);
  end if;
  return new;
end;
$$;
create trigger entries_track_edit
  before update on public.entries
  for each row execute function private.track_entry_edit();

create or replace function private.track_boat_edit()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.event_id is distinct from old.event_id or new.created_by is distinct from old.created_by then
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
create trigger boats_track_edit
  before update on public.boats
  for each row execute function private.track_boat_edit();

-- Rastro também na inserção: ninguém cria registro já "corrigido".
create or replace function private.clear_edit_fields()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.edited_by := null;
  new.edited_at := null;
  if tg_table_name = 'entries' then
    new.count_original := null;
  else
    new.total_original := null;
  end if;
  return new;
end;
$$;
create trigger entries_clear_edit before insert on public.entries
  for each row execute function private.clear_edit_fields();
create trigger boats_clear_edit before insert on public.boats
  for each row execute function private.clear_edit_fields();
