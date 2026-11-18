-- Fominha · move as funções internas das regras de acesso para um schema
-- que não é exposto pela API (resolve os avisos de segurança do Supabase).
-- As regras (policies) continuam funcionando: elas apontam para a função, não para o nome.

create schema if not exists private;
grant usage on schema private to authenticated;

alter function public.is_group_member(uuid) set schema private;
alter function public.is_group_admin(uuid) set schema private;
alter function public.event_group(uuid) set schema private;
alter function public.event_is_live(uuid) set schema private;
alter function public.shares_group_with(uuid) set schema private;
alter function public.handle_new_group() set schema private;

revoke execute on all functions in schema private from public, anon, authenticated;
grant execute on function
  private.is_group_member(uuid),
  private.is_group_admin(uuid),
  private.event_group(uuid),
  private.event_is_live(uuid),
  private.shares_group_with(uuid)
  to authenticated;

-- Entrar no grupo exige estar logado; a prévia do convite continua pública
revoke execute on function public.join_group(text) from public, anon;
