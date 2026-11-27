-- Quem enviou uma foto pode apagá-la enquanto ela não estiver ligada a nenhum registro
-- (descartou a foto, tirou outra, ou confirmou que era a mesma barca de outra pessoa).
-- Fotos usadas por entries ou boats continuam protegidas: são a prova do placar.
create policy "plates_delete_own_unused" on storage.objects for delete to authenticated
  using (
    bucket_id = 'plates'
    and (storage.foldername(name))[2] = auth.uid()::text
    and not exists (select 1 from public.entries e where e.photo_path = storage.objects.name)
    and not exists (select 1 from public.boats b where b.photo_path = storage.objects.name)
  );
