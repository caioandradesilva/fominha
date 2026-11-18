-- Fominha · liga membros e pratos ao perfil, para a API trazer o apelido junto
-- (ex.: group_members?select=role,profiles(nickname)).

alter table public.group_members
  add constraint group_members_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

alter table public.entries
  add constraint entries_profile_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;
