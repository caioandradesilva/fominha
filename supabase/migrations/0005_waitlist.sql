-- Rodizium · lista de espera da landing page (rodizium.com.br).
-- Qualquer visitante pode se cadastrar; ninguém pelo app consegue ler a lista.
-- A lista é lida pelo painel do Supabase (Table Editor → waitlist → Export CSV).

create table public.waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 60),
  contact text not null check (char_length(trim(contact)) between 5 and 120),
  city text check (city is null or char_length(city) <= 60),
  rodizios text[] not null default '{}' check (cardinality(rodizios) <= 6),
  source text check (source is null or char_length(source) <= 40),
  created_at timestamptz not null default now()
);

-- Um cadastro por e-mail/WhatsApp
create unique index waitlist_contact_unique on public.waitlist (lower(trim(contact)));

alter table public.waitlist enable row level security;

create policy "waitlist_insert" on public.waitlist
  for insert to anon, authenticated
  with check (true);

revoke all on public.waitlist from anon, authenticated;
grant insert on public.waitlist to anon, authenticated;
