-- =====================================================================
--  AMICO - magazyn plikow "Dokumenty do pobrania" (Supabase Storage)
--  Uruchom RAZ w: Supabase -> SQL Editor -> Run. Idempotentne, bezpieczne.
--  Wymaga wczesniej uruchomionego schematu AMICO (funkcja amico_is_member).
--
--  Co robi: tworzy PRYWATNY bucket "dokumenty" i ustawia dostep tak, ze pliki
--  firmy widzi/pobiera/wgrywa TYLKO zalogowany czlonek tej firmy. Pliki leza w
--  folderze nazwanym id firmy: "<workspace_id>/<plik>".
--
--  Uwaga: "kto konkretnie widzi dany plik" (wybor kont w aplikacji) jest
--  pilnowany po stronie aplikacji. Na poziomie bazy chronimy dostep do plikow
--  CALEJ firmy - obce osoby spoza firmy nie maja do nich dostepu w ogole.
-- =====================================================================

-- Prywatny bucket na dokumenty.
insert into storage.buckets (id, name, public)
values ('dokumenty', 'dokumenty', false)
on conflict (id) do nothing;

-- Dostep: tylko zalogowany czlonek firmy, ktorej id jest pierwszym folderem sciezki.
drop policy if exists amico_dok_select on storage.objects;
drop policy if exists amico_dok_insert on storage.objects;
drop policy if exists amico_dok_update on storage.objects;
drop policy if exists amico_dok_delete on storage.objects;

create policy amico_dok_select on storage.objects for select to authenticated
  using (bucket_id = 'dokumenty' and public.amico_is_member(((storage.foldername(name))[1])::uuid));

create policy amico_dok_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'dokumenty' and public.amico_is_member(((storage.foldername(name))[1])::uuid));

create policy amico_dok_update on storage.objects for update to authenticated
  using (bucket_id = 'dokumenty' and public.amico_is_member(((storage.foldername(name))[1])::uuid));

create policy amico_dok_delete on storage.objects for delete to authenticated
  using (bucket_id = 'dokumenty' and public.amico_is_member(((storage.foldername(name))[1])::uuid));

-- Gotowe. W aplikacji: Pulpit -> Dokumenty do pobrania -> "Wgraj".
