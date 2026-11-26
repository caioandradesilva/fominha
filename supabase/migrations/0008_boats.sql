-- Rodizium · barcas (rodízio festival): alguém fotografa a barca para o grupo, a IA conta
-- as peças por tipo e o registro rápido de cada um desconta desse saldo.
create table public.boats (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  created_by uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  photo_path text,
  ai_result jsonb,
  counts jsonb not null default '{}'::jsonb,
  total integer not null default 0 check (total between 0 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index boats_event_idx on public.boats (event_id);

alter table public.boats enable row level security;

create policy "boats_select" on public.boats for select to authenticated
  using (private.is_group_member(private.event_group(event_id)));
create policy "boats_insert" on public.boats for insert to authenticated
  with check (created_by = auth.uid() and private.is_group_member(private.event_group(event_id)) and private.event_is_live(event_id));
-- Qualquer pessoa do grupo pode corrigir a contagem enquanto o evento está ao vivo
create policy "boats_update" on public.boats for update to authenticated
  using (private.is_group_member(private.event_group(event_id)) and private.event_is_live(event_id))
  with check (private.is_group_member(private.event_group(event_id)) and private.event_is_live(event_id));
create policy "boats_delete" on public.boats for delete to authenticated
  using ((created_by = auth.uid() and private.event_is_live(event_id)) or private.is_group_admin(private.event_group(event_id)));

grant select, insert, update, delete on public.boats to authenticated;
alter publication supabase_realtime add table public.boats;
