-- Rodizium · lista de espera: e-mail obrigatório, telefone opcional, cidade e estado obrigatórios
alter table public.waitlist rename column contact to email;
alter index public.waitlist_contact_unique rename to waitlist_email_unique;
alter table public.waitlist add constraint waitlist_email_format check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$');
alter table public.waitlist add column phone text check (phone is null or phone ~ '^[0-9]{10,13}$');
alter table public.waitlist alter column city set not null;
alter table public.waitlist add constraint waitlist_city_len check (char_length(trim(city)) between 2 and 60);
alter table public.waitlist add column state text not null check (state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'));
grant insert on public.waitlist to anon, authenticated;
