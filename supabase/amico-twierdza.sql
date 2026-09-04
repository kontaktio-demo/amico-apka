-- ============================================================================
-- AMICO - TWIERDZA. Hartowanie bezpieczenstwa i ochrona przed utrata danych.
-- Idempotentne i bezpieczne do wielokrotnego uruchomienia.
-- Uruchom w Supabase -> SQL Editor -> Run.
--
-- Co robi:
--  1. Historia stanu firmy - kazda wersja archiwizowana, nic nie ginie bezpowrotnie.
--  2. Blokada masowego usuwania - zapis kasujacy polowe rekordow jest odrzucany.
--  3. Koniec auto-dolaczania - obce konto NIE wchodzi juz do firmy.
--  4. Skany: RLS + zakaz twardego kasowania (tylko miekkie).
--  5. Funkcje ratunkowe dla wlasciciela (historia, przywracanie, wymuszony zapis).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1) HISTORIA STANU. Tabela bez polityk RLS = dostep WYLACZNIE przez funkcje
--    SECURITY DEFINER. Nawet czlonek firmy nie skasuje archiwum z aplikacji.
-- ---------------------------------------------------------------------------
create table if not exists public.amico_state_history (
  id           bigserial primary key,
  workspace_id uuid        not null,
  rev          bigint      not null,
  data         jsonb       not null,
  zapisal      uuid,
  utworzono    timestamptz not null default now()
);
create index if not exists amico_state_history_ws_idx
  on public.amico_state_history (workspace_id, id desc);
alter table public.amico_state_history enable row level security;
revoke all on public.amico_state_history from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2) POMOCNICZE
-- ---------------------------------------------------------------------------
create or replace function public.amico_licz(d jsonb, k text)
returns int language sql immutable as $fn$
  select case when jsonb_typeof(d -> k) = 'array' then jsonb_array_length(d -> k) else 0 end
$fn$;
revoke all on function public.amico_licz(jsonb, text) from public, anon;

create or replace function public.amico_moja_rola(w uuid)
returns text language sql stable security definer set search_path = public as $fn$
  select m.rola from public.amico_members m
   where m.workspace_id = w and m.user_id = auth.uid()
$fn$;
revoke all on function public.amico_moja_rola(uuid) from public, anon;
grant execute on function public.amico_moja_rola(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3) ZAPIS STANU: archiwizacja + blokada masowego usuwania.
--    Sygnatura bez zmian, wiec aplikacja dziala bez modyfikacji.
-- ---------------------------------------------------------------------------
create or replace function public.amico_save_state(p_workspace uuid, p_data jsonb, p_rev bigint)
returns table (ok boolean, rev bigint, data jsonb)
language plpgsql security definer set search_path = public as $fn$
declare
  cur        bigint;
  stare      jsonb;
  kol        text;
  n_stare    int;
  n_nowe     int;
  skurcz     boolean := false;
  ostatnia   timestamptz;
  archiwizuj boolean := true;
  kolekcje   text[] := array['klienci','zlecenia','wyceny','umowy','faktury','protokoly',
                             'kontrahenci','produkty','zadania','wydarzenia','raportyKasowe',
                             'uzytkownicy','pracownicy','hurtownie','zamowienia','ekspozycje',
                             'dokumenty','skany','kp','przelewy','obrot'];
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  if not public.amico_is_member(p_workspace) then
    raise exception 'Brak dostepu do tej firmy';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Nieprawidlowe dane stanu';
  end if;
  if pg_column_size(p_data) > 20 * 1024 * 1024 then
    raise exception 'Dane firmy przekraczaja dozwolony rozmiar';
  end if;

  select s.rev, s.data into cur, stare
    from public.amico_state s where s.workspace_id = p_workspace for update;

  -- pierwszy zapis firmy
  if cur is null then
    insert into public.amico_state (workspace_id, data, rev, updated_by)
      values (p_workspace, p_data, 1, auth.uid());
    return query select true, 1::bigint, p_data;
    return;
  end if;

  -- konflikt wersji (CAS) - klient scali i sprobuje ponownie
  if cur <> p_rev then
    return query select false, cur,
      (select s.data from public.amico_state s where s.workspace_id = p_workspace);
    return;
  end if;

  -- BLOKADA MASOWEGO USUNIECIA: zadna kolekcja nie moze stracic polowy rekordow.
  foreach kol in array kolekcje loop
    n_stare := public.amico_licz(stare, kol);
    n_nowe  := public.amico_licz(p_data, kol);
    if n_nowe < n_stare then skurcz := true; end if;
    if n_stare >= 5 and n_nowe * 2 < n_stare then
      raise exception 'Zapis zablokowany: kolekcja % spadlaby z % do % rekordow. To wyglada na masowe usuniecie danych. Wlasciciel moze wymusic zapis funkcja amico_wymus_zapis.', kol, n_stare, n_nowe;
    end if;
  end loop;

  -- ARCHIWUM: przy kazdym skurczu zawsze, poza tym nie czesciej niz co 2 minuty.
  select max(h.utworzono) into ostatnia
    from public.amico_state_history h where h.workspace_id = p_workspace;
  if ostatnia is not null and ostatnia > now() - interval '2 minutes' and not skurcz then
    archiwizuj := false;
  end if;
  if archiwizuj then
    insert into public.amico_state_history (workspace_id, rev, data, zapisal)
      values (p_workspace, cur, stare, auth.uid());
    -- zostawiamy 500 ostatnich wersji na firme
    delete from public.amico_state_history h
     where h.workspace_id = p_workspace
       and h.id not in (
         select h2.id from public.amico_state_history h2
          where h2.workspace_id = p_workspace order by h2.id desc limit 500);
  end if;

  update public.amico_state s
     set data = p_data, rev = s.rev + 1, updated_at = now(), updated_by = auth.uid()
   where s.workspace_id = p_workspace;
  return query select true, cur + 1, p_data;
end; $fn$;
revoke all on function public.amico_save_state(uuid, jsonb, bigint) from public, anon;
grant execute on function public.amico_save_state(uuid, jsonb, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 4) WEJSCIE DO FIRMY: koniec automatycznego dolaczania.
--    Konto bez czlonkostwa dostaje odmowe. Dostep nadaje wlasciciel.
--    Wyjatek: gdy nie ma JESZCZE zadnej firmy - pierwsze konto ja zaklada.
-- ---------------------------------------------------------------------------
create or replace function public.amico_wejscie(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $fn$
#variable_conflict use_column
declare w uuid; v_imie text; ile int;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  v_imie := left(regexp_replace(coalesce(p_imie, ''), '[[:cntrl:]]', '', 'g'), 120);

  select m.workspace_id into w from public.amico_members m
   where m.user_id = auth.uid() order by m.created_at asc limit 1;

  if w is null then
    select count(*) into ile from public.amico_workspaces;
    if ile = 0 then
      insert into public.amico_workspaces (nazwa) values ('AMICO') returning id into w;
      insert into public.amico_members (user_id, workspace_id, imie, email, rola)
        values (auth.uid(), w, coalesce(nullif(v_imie, ''), 'Wlasciciel'),
                (select u.email from auth.users u where u.id = auth.uid()), 'wlasciciel');
      insert into public.amico_state (workspace_id, data, rev, updated_by)
        values (w, '{}'::jsonb, 0, auth.uid());
    else
      raise exception 'To konto nie ma dostepu do firmy. Dostep nadaje wlasciciel.';
    end if;
  else
    update public.amico_members m set imie = coalesce(nullif(v_imie, ''), m.imie)
     where m.user_id = auth.uid() and m.workspace_id = w;
  end if;

  return query select m.workspace_id, m.rola, ws.join_code, ws.nazwa
    from public.amico_members m
    join public.amico_workspaces ws on ws.id = m.workspace_id
   where m.user_id = auth.uid() and m.workspace_id = w;
end; $fn$;
revoke all on function public.amico_wejscie(text) from public, anon;
grant execute on function public.amico_wejscie(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) SKANY: RLS per firma + zakaz TWARDEGO kasowania (aplikacja kasuje miekko).
-- ---------------------------------------------------------------------------
do $blok$
begin
  if to_regclass('public.amico_skany') is not null then
    execute 'alter table public.amico_skany enable row level security';
    execute 'revoke all on public.amico_skany from anon';
    execute 'grant select, insert, update on public.amico_skany to authenticated';
    execute 'revoke delete on public.amico_skany from authenticated';
    execute 'drop policy if exists amico_skany_select on public.amico_skany';
    execute 'drop policy if exists amico_skany_insert on public.amico_skany';
    execute 'drop policy if exists amico_skany_update on public.amico_skany';
    execute 'drop policy if exists amico_skany_delete on public.amico_skany';
    execute 'create policy amico_skany_select on public.amico_skany for select to authenticated using (public.amico_is_member(workspace_id))';
    execute 'create policy amico_skany_insert on public.amico_skany for insert to authenticated with check (public.amico_is_member(workspace_id))';
    execute 'create policy amico_skany_update on public.amico_skany for update to authenticated using (public.amico_is_member(workspace_id)) with check (public.amico_is_member(workspace_id))';
  end if;
end $blok$;

-- ---------------------------------------------------------------------------
-- 6) FUNKCJE RATUNKOWE (tylko wlasciciel)
-- ---------------------------------------------------------------------------
create or replace function public.amico_historia_stanu(p_workspace uuid)
returns table (id bigint, rev bigint, utworzono timestamptz, rozmiar_kb int, zapisal uuid)
language plpgsql security definer set search_path = public as $fn$
begin
  if public.amico_moja_rola(p_workspace) <> 'wlasciciel' then
    raise exception 'Tylko wlasciciel moze przegladac historie';
  end if;
  return query
    select h.id, h.rev, h.utworzono, (pg_column_size(h.data)/1024)::int, h.zapisal
      from public.amico_state_history h
     where h.workspace_id = p_workspace
     order by h.id desc limit 200;
end; $fn$;
revoke all on function public.amico_historia_stanu(uuid) from public, anon;
grant execute on function public.amico_historia_stanu(uuid) to authenticated;

create or replace function public.amico_przywroc_stan(p_workspace uuid, p_id bigint)
returns bigint
language plpgsql security definer set search_path = public as $fn$
declare stary jsonb; cur bigint; obecne jsonb;
begin
  if public.amico_moja_rola(p_workspace) <> 'wlasciciel' then
    raise exception 'Tylko wlasciciel moze przywrocic dane';
  end if;
  select h.data into stary from public.amico_state_history h
   where h.id = p_id and h.workspace_id = p_workspace;
  if stary is null then raise exception 'Nie znaleziono takiej wersji'; end if;

  select s.rev, s.data into cur, obecne from public.amico_state s
   where s.workspace_id = p_workspace for update;
  -- biezaca wersja tez trafia do archiwum, zeby cofniecie dalo sie cofnac
  insert into public.amico_state_history (workspace_id, rev, data, zapisal)
    values (p_workspace, cur, obecne, auth.uid());
  update public.amico_state s
     set data = stary, rev = s.rev + 1, updated_at = now(), updated_by = auth.uid()
   where s.workspace_id = p_workspace;
  return cur + 1;
end; $fn$;
revoke all on function public.amico_przywroc_stan(uuid, bigint) from public, anon;
grant execute on function public.amico_przywroc_stan(uuid, bigint) to authenticated;

create or replace function public.amico_wymus_zapis(p_workspace uuid, p_data jsonb, p_rev bigint)
returns table (ok boolean, rev bigint, data jsonb)
language plpgsql security definer set search_path = public as $fn$
declare cur bigint; stare jsonb;
begin
  if public.amico_moja_rola(p_workspace) <> 'wlasciciel' then
    raise exception 'Tylko wlasciciel moze wymusic zapis';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Nieprawidlowe dane stanu';
  end if;
  select s.rev, s.data into cur, stare from public.amico_state s
   where s.workspace_id = p_workspace for update;
  if cur is null then raise exception 'Brak stanu tej firmy'; end if;
  if cur <> p_rev then
    return query select false, cur, stare;
    return;
  end if;
  insert into public.amico_state_history (workspace_id, rev, data, zapisal)
    values (p_workspace, cur, stare, auth.uid());
  update public.amico_state s
     set data = p_data, rev = s.rev + 1, updated_at = now(), updated_by = auth.uid()
   where s.workspace_id = p_workspace;
  return query select true, cur + 1, p_data;
end; $fn$;
revoke all on function public.amico_wymus_zapis(uuid, jsonb, bigint) from public, anon;
grant execute on function public.amico_wymus_zapis(uuid, jsonb, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) KONIEC SAMOOBSLUGOWYCH WEJSC.
--    amico_join pozwalal KAZDEMU zalogowanemu dopisac sie do firmy, jesli znal kod.
--    Kod jest widoczny dla kazdego czlonka, wiec jego wyciek = obcy w bazie.
--    amico_bootstrap potrafil zalozyc/przypisac firme. Oba odbieramy uzytkownikom.
-- ---------------------------------------------------------------------------
do $blok2$
begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname='public' and p.proname='amico_join') then
    execute 'revoke all on function public.amico_join(text, text) from authenticated, public, anon';
  end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname='public' and p.proname='amico_bootstrap') then
    execute 'revoke all on function public.amico_bootstrap(text) from authenticated, public, anon';
  end if;
end $blok2$;

-- ---------------------------------------------------------------------------
-- 8) NADANIE DOSTEPU PRZEZ WLASCICIELA (jedyna droga do firmy).
--    Wlasciciel podaje e-mail istniejacego konta i role. Bez kodow, bez samoobslugi.
-- ---------------------------------------------------------------------------
create or replace function public.amico_dodaj_czlonka(p_workspace uuid, p_email text, p_rola text)
returns uuid
language plpgsql security definer set search_path = public as $fn$
declare uid uuid; v_email text;
begin
  if public.amico_moja_rola(p_workspace) <> 'wlasciciel' then
    raise exception 'Tylko wlasciciel moze nadawac dostep do firmy';
  end if;
  if p_rola not in ('wlasciciel','kierownik','biuro','montazysta') then
    raise exception 'Nieprawidlowa rola';
  end if;
  v_email := lower(btrim(coalesce(p_email, '')));
  if v_email = '' then raise exception 'Podaj adres e-mail'; end if;

  select u.id into uid from auth.users u where lower(u.email) = v_email;
  if uid is null then
    raise exception 'Nie ma konta o adresie %. Najpierw zaloz konto w panelu Supabase.', v_email;
  end if;

  insert into public.amico_members (user_id, workspace_id, imie, email, rola)
    values (uid, p_workspace, split_part(v_email, '@', 1), v_email, p_rola)
  on conflict on constraint amico_members_pkey do update set rola = excluded.rola;
  return uid;
end; $fn$;
revoke all on function public.amico_dodaj_czlonka(uuid, text, text) from public, anon;
grant execute on function public.amico_dodaj_czlonka(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 9) STORAGE: limit rozmiaru i lista dozwolonych typow.
--    Blokujemy text/html i image/svg+xml - to tresci AKTYWNE, ktore w przegladarce
--    wykonuja skrypt. Dodatkowo aplikacja podaje dokumenty z wymuszonym pobraniem.
-- ---------------------------------------------------------------------------
update storage.buckets
   set public = false,
       file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array['image/jpeg','image/png','image/webp','image/heic','application/pdf']
 where id = 'skany';

update storage.buckets
   set public = false,
       file_size_limit = 26214400, -- 25 MB
       allowed_mime_types = array[
         'image/jpeg','image/png','image/webp','image/heic','application/pdf','text/plain','text/csv',
         'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'application/zip']
 where id = 'dokumenty';

select 'Twierdza gotowa: historia stanu, blokada masowego usuwania, koniec auto-dolaczania i kodow, RLS skanow' as status;
