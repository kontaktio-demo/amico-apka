-- ============================================================================
-- AMICO – utwardzenie bezpieczenstwa (uruchom w Supabase -> SQL Editor -> Run)
--
-- Ten plik zastepuje funkcje z amico-schema.sql i amico-poprawki-2.sql ICH
-- UTWARDZONYMI wersjami. Uruchom go PO amico-schema.sql. Jest idempotentny.
--
-- OCHRONA PRZED SQL INJECTION – jak jest zapewniona na kazdym poziomie:
--   1. KLIENT (aplikacja): wszystkie zapytania ida przez supabase-js
--      (.rpc(), .from().select().eq()...) - PostgREST parametryzuje kazda wartosc.
--      W kodzie nie ma ani jednego zapytania sklejanego ze stringow.
--   2. SERWER (te funkcje): NIE uzywaja dynamicznego SQL (brak EXECUTE || ...).
--      Wszystkie wartosci to PARAMETRY ($1, p_code, p_imie...) - Postgres nie
--      interpretuje ich jako kodu SQL. To fundamentalna, pelna ochrona.
--   3. search_path jest PRZYPIETY (set search_path = public) na kazdej funkcji
--      SECURITY DEFINER - blokuje podmiane funkcji/tabel przez atakujacego.
--   4. RLS wlaczone na wszystkich tabelach; dostep tylko dla czlonka workspace.
--   5. anon (niezalogowany) ma odebrane wszystkie prawa.
--
-- Dodatkowo ten plik dorzuca WALIDACJE WEJSC i limity (defense-in-depth):
--   - dlugosc imienia/kodu ograniczona, rola tylko z bialej listy,
--   - nikt nie zmieni wlasnej roli ani nie awansuje sie sam,
--   - blokada gigantycznych zapisow stanu (ochrona przed przeciazeniem),
--   - kod firmy tylko z bezpiecznych znakow.
-- ============================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Pomocnicze: przyciecie i oczyszczenie tekstu wejsciowego
-- ---------------------------------------------------------------------------
create or replace function public.amico_bezpieczny_tekst(p text, p_max int)
returns text
language sql immutable set search_path = public as $$
  -- Usuwa znaki sterujace (w tym \0) i przycina dlugosc. Czysto obronne -
  -- wartosc i tak jest parametrem, ale nie chcemy smieci w danych.
  select left(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', '', 'g'), greatest(p_max, 0));
$$;

-- ---------------------------------------------------------------------------
-- Czlonkostwo (uzywane przez RLS)
-- ---------------------------------------------------------------------------
create or replace function public.amico_is_member(w uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.amico_members m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

-- ---------------------------------------------------------------------------
-- Bootstrap: pierwsze konto / wejscie wlasciciela. Deterministyczny wybor firmy.
-- ---------------------------------------------------------------------------
create or replace function public.amico_bootstrap(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w uuid; v_imie text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  v_imie := public.amico_bezpieczny_tekst(p_imie, 120);

  -- Preferuj firme, w ktorej uzytkownik faktycznie jest (najwiecej czlonkow),
  -- przy remisie najstarsze czlonkostwo - zeby wybor byl powtarzalny.
  select m.workspace_id into w
    from public.amico_members m
   where m.user_id = auth.uid()
   order by (select count(*) from public.amico_members x where x.workspace_id = m.workspace_id) desc,
            m.created_at asc
   limit 1;

  if w is null then
    insert into public.amico_workspaces (nazwa) values ('AMICO') returning id into w;
    insert into public.amico_members (user_id, workspace_id, imie, email, rola)
      values (auth.uid(), w, coalesce(nullif(v_imie, ''), 'Właściciel'),
              (select u.email from auth.users u where u.id = auth.uid()), 'wlasciciel');
    insert into public.amico_state (workspace_id, data, rev, updated_by)
      values (w, '{}'::jsonb, 0, auth.uid());
  else
    update public.amico_members m
       set imie = coalesce(nullif(v_imie, ''), m.imie)
     where m.user_id = auth.uid() and m.workspace_id = w;
  end if;

  return query
    select m.workspace_id, m.rola, ws.join_code, ws.nazwa
      from public.amico_members m
      join public.amico_workspaces ws on ws.id = m.workspace_id
     where m.user_id = auth.uid() and m.workspace_id = w;
end; $$;

-- ---------------------------------------------------------------------------
-- Dolaczenie do firmy kodem. Kod tylko z bezpiecznych znakow [A-Z0-9].
-- ---------------------------------------------------------------------------
create or replace function public.amico_join(p_code text, p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w uuid; v_code text; v_imie text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  v_code := upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
  v_imie := public.amico_bezpieczny_tekst(p_imie, 120);
  if length(v_code) between 1 and 32 is not true then
    raise exception 'Nieprawidłowy kod dołączenia';
  end if;

  select ws.id into w from public.amico_workspaces ws where ws.join_code = v_code;
  if w is null then
    raise exception 'Nieprawidłowy kod dołączenia';
  end if;

  insert into public.amico_members (user_id, workspace_id, imie, email, rola)
    values (auth.uid(), w, coalesce(nullif(v_imie, ''), 'Pracownik'),
            (select u.email from auth.users u where u.id = auth.uid()), 'montazysta')
  on conflict on constraint amico_members_pkey do update set imie = excluded.imie;

  return query
    select m.workspace_id, m.rola, ws.join_code, ws.nazwa
      from public.amico_members m
      join public.amico_workspaces ws on ws.id = m.workspace_id
     where m.user_id = auth.uid() and m.workspace_id = w;
end; $$;

-- ---------------------------------------------------------------------------
-- Zapis stanu (CAS) + limit rozmiaru (ochrona przed przeciazeniem bazy).
-- ---------------------------------------------------------------------------
create or replace function public.amico_save_state(p_workspace uuid, p_data jsonb, p_rev bigint)
returns table (ok boolean, rev bigint, data jsonb)
language plpgsql security definer set search_path = public as $$
declare cur bigint;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  if not public.amico_is_member(p_workspace) then
    raise exception 'Brak dostępu do tej firmy';
  end if;
  if p_data is null or jsonb_typeof(p_data) <> 'object' then
    raise exception 'Nieprawidłowe dane stanu';
  end if;
  -- Twardy limit ~20 MB na cala baze firmy - realny stan to ulamek tego.
  if pg_column_size(p_data) > 20 * 1024 * 1024 then
    raise exception 'Dane firmy przekraczają dozwolony rozmiar';
  end if;

  select s.rev into cur from public.amico_state s
   where s.workspace_id = p_workspace for update;

  if cur is null then
    insert into public.amico_state (workspace_id, data, rev, updated_by)
      values (p_workspace, p_data, 1, auth.uid());
    return query select true, 1::bigint, p_data;
  elsif cur = p_rev then
    update public.amico_state s
       set data = p_data, rev = s.rev + 1, updated_at = now(), updated_by = auth.uid()
     where s.workspace_id = p_workspace;
    return query select true, cur + 1, p_data;
  else
    return query
      select false, cur, (select s.data from public.amico_state s where s.workspace_id = p_workspace);
  end if;
end; $$;

-- ---------------------------------------------------------------------------
-- Zmiana roli. Biala lista rol, brak awansu samego siebie, wlasciciela nadaje
-- tylko wlasciciel, i nie mozna zdjac ostatniego wlasciciela.
-- ---------------------------------------------------------------------------
create or replace function public.amico_set_role(p_user uuid, p_workspace uuid, p_rola text)
returns void
language plpgsql security definer set search_path = public as $$
declare moja_rola text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  if p_rola not in ('wlasciciel', 'kierownik', 'biuro', 'montazysta') then
    raise exception 'Nieprawidłowa rola';
  end if;

  select m.rola into moja_rola
    from public.amico_members m
   where m.workspace_id = p_workspace and m.user_id = auth.uid();

  if moja_rola is null or moja_rola not in ('wlasciciel', 'kierownik') then
    raise exception 'Brak uprawnień';
  end if;
  -- Nikt nie zmienia wlasnej roli (blokada samo-awansu).
  if p_user = auth.uid() then
    raise exception 'Nie można zmienić własnej roli';
  end if;
  -- Range wlasciciela nadaje wylacznie wlasciciel.
  if p_rola = 'wlasciciel' and moja_rola <> 'wlasciciel' then
    raise exception 'Tylko właściciel może nadać rolę właściciela';
  end if;
  -- Nie zdejmujemy ostatniego wlasciciela.
  if exists (
    select 1 from public.amico_members m
     where m.workspace_id = p_workspace and m.user_id = p_user and m.rola = 'wlasciciel'
  ) and p_rola <> 'wlasciciel' and (
    select count(*) from public.amico_members m
     where m.workspace_id = p_workspace and m.rola = 'wlasciciel'
  ) <= 1 then
    raise exception 'Musi pozostać co najmniej jeden właściciel';
  end if;

  update public.amico_members set rola = p_rola
   where user_id = p_user and workspace_id = p_workspace;
end; $$;

-- ---------------------------------------------------------------------------
-- Odebranie dostepu czlonkowi (tylko wlasciciel/kierownik, nie siebie,
-- nie ostatniego wlasciciela).
-- ---------------------------------------------------------------------------
create or replace function public.amico_remove_member(p_user uuid, p_workspace uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare moja_rola text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  select m.rola into moja_rola
    from public.amico_members m
   where m.user_id = auth.uid() and m.workspace_id = p_workspace;

  if moja_rola is null or moja_rola not in ('wlasciciel', 'kierownik') then
    raise exception 'Brak uprawnień do usuwania osób z tej firmy';
  end if;
  if p_user = auth.uid() then
    raise exception 'Nie można usunąć samego siebie';
  end if;
  if exists (
    select 1 from public.amico_members m
     where m.workspace_id = p_workspace and m.user_id = p_user and m.rola = 'wlasciciel'
  ) and (
    select count(*) from public.amico_members m
     where m.workspace_id = p_workspace and m.rola = 'wlasciciel'
  ) <= 1 then
    raise exception 'Nie można usunąć ostatniego właściciela';
  end if;

  delete from public.amico_members m
   where m.user_id = p_user and m.workspace_id = p_workspace;
end; $$;

-- ---------------------------------------------------------------------------
-- Zmiana kodu firmy (po odejsciu pracownika stary kod przestaje dzialac).
-- ---------------------------------------------------------------------------
create or replace function public.amico_rotate_join_code(p_workspace uuid)
returns text
language plpgsql security definer set search_path = public as $$
declare moja_rola text; nowy text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  select m.rola into moja_rola
    from public.amico_members m
   where m.user_id = auth.uid() and m.workspace_id = p_workspace;

  if moja_rola is null or moja_rola not in ('wlasciciel', 'kierownik') then
    raise exception 'Brak uprawnień do zmiany kodu firmy';
  end if;

  nowy := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.amico_workspaces set join_code = nowy where id = p_workspace;
  return nowy;
end; $$;

-- ---------------------------------------------------------------------------
-- Uprawnienia: nic dla anonima, wykonanie tylko dla zalogowanych.
-- ---------------------------------------------------------------------------
revoke all on public.amico_workspaces from anon;
revoke all on public.amico_members    from anon;
revoke all on public.amico_state      from anon;

revoke all on function public.amico_bezpieczny_tekst(text, int)    from public, anon;
revoke all on function public.amico_is_member(uuid)                from public, anon;
revoke all on function public.amico_bootstrap(text)                from public, anon;
revoke all on function public.amico_join(text, text)               from public, anon;
revoke all on function public.amico_save_state(uuid, jsonb, bigint) from public, anon;
revoke all on function public.amico_set_role(uuid, uuid, text)     from public, anon;
revoke all on function public.amico_remove_member(uuid, uuid)      from public, anon;
revoke all on function public.amico_rotate_join_code(uuid)         from public, anon;

grant execute on function public.amico_is_member(uuid)                to authenticated;
grant execute on function public.amico_bootstrap(text)                to authenticated;
grant execute on function public.amico_join(text, text)               to authenticated;
grant execute on function public.amico_save_state(uuid, jsonb, bigint) to authenticated;
grant execute on function public.amico_set_role(uuid, uuid, text)     to authenticated;
grant execute on function public.amico_remove_member(uuid, uuid)      to authenticated;
grant execute on function public.amico_rotate_join_code(uuid)         to authenticated;
-- amico_bezpieczny_tekst jest funkcja pomocnicza wolana wewnatrz innych - nie nadajemy execute.

-- Gotowe. Baza jest utwardzona.
