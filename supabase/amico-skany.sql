-- ============================================================================
-- AMICO - magazyn OBRAZOW SKANOW (bucket "skany").
-- Obrazy stron skanow trzymamy w Storage, a w bazie JSON tylko SCIEZKI. Dzieki temu
-- baza firmy nie rosnie od skanow i zapis do chmury dziala BEZ limitu 20 MB
-- (to naprawia blad "Nie udalo sie zapisac w chmurze" przy wielu skanach).
--
-- Uruchom RAZ w Supabase -> SQL Editor. Bezpieczne do wielokrotnego uruchomienia.
-- Wymaga wczesniej uruchomionego glownego skryptu (funkcja public.amico_is_member).
-- ============================================================================

insert into storage.buckets (id, name, public) values ('skany', 'skany', false)
on conflict (id) do nothing;

drop policy if exists amico_skan_select on storage.objects;
drop policy if exists amico_skan_insert on storage.objects;
drop policy if exists amico_skan_update on storage.objects;
drop policy if exists amico_skan_delete on storage.objects;

-- Dostep tylko dla czlonkow firmy (workspace) - sciezka zaczyna sie od workspace_id.
create policy amico_skan_select on storage.objects for select to authenticated
  using (bucket_id = 'skany' and public.amico_is_member(((storage.foldername(name))[1])::uuid));
create policy amico_skan_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'skany' and public.amico_is_member(((storage.foldername(name))[1])::uuid));
create policy amico_skan_update on storage.objects for update to authenticated
  using (bucket_id = 'skany' and public.amico_is_member(((storage.foldername(name))[1])::uuid));
create policy amico_skan_delete on storage.objects for delete to authenticated
  using (bucket_id = 'skany' and public.amico_is_member(((storage.foldername(name))[1])::uuid));

select 'Bucket skany gotowy - obrazy skanow nie obciazaja juz bazy' as status;
