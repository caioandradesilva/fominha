-- v0.3 (backlog B4): limite de velocidade dos registros.
-- Uso humano real: pico de 55 toques em 10 min para um grupo inteiro (Rodízio #2).
-- Teto: 15 registros em 10 s ou 60 em 1 min por pessoa. Acima disso é script ou dedo preso.
create or replace function private.entries_rate_limit()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.entries where user_id = new.user_id and created_at > now() - interval '10 seconds') >= 15
     or (select count(*) from public.entries where user_id = new.user_id and created_at > now() - interval '1 minute') >= 60 then
    raise exception 'rate_limited' using errcode = 'P0001', hint = 'Muitos registros seguidos. Espere alguns segundos.';
  end if;
  return new;
end;
$$;
create index if not exists entries_user_created_idx on public.entries (user_id, created_at desc);
create trigger entries_rate_limit before insert on public.entries
  for each row execute function private.entries_rate_limit();
