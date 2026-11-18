-- Fominha · quem cria o grupo consegue lê-lo na mesma operação.
-- Sem isso, "insert ... returning" falha: a regra de leitura é checada antes
-- do gatilho que registra o criador como admin.

drop policy "groups_select" on public.groups;
create policy "groups_select" on public.groups for select to authenticated
  using (created_by = auth.uid() or private.is_group_member(id));
