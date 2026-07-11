-- ============================================================================
-- AMICO – poprawki bezpieczenstwa do schematu (uruchom w Supabase → SQL Editor)
--
-- Wykryte podczas audytu przed oddaniem aplikacji:
--   1. amico_bootstrap wybieral firme przez "limit 1" BEZ "order by".
--      Osoba nalezaca do dwoch firm (np. pracownik, ktory najpierw zalozyl
--      konto, a potem dolaczyl kodem) mogla trafic do losowej z nich.
--   2. Nie bylo ZADNEGO sposobu, zeby odebrac dostep zwolnionemu pracownikowi.
--      Usuniecie go w aplikacji kasowalo tylko wpis w danych – w bazie dalej
--      mial prawo odczytu i zapisu stanu calej firmy.
--   3. Kodu firmy (join_code) nie dalo sie zmienic.
--
-- Skrypt jest idempotentny (mozna uruchomic wielokrotnie).
-- Nie rusza zadnych tabel poza wlasnymi (amico_*).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Kolejnosc czlonkostw – zeby wybor firmy byl deterministyczny
-- ---------------------------------------------------------------------------
alter table public.amico_members
  add column if not exists dolaczono timestamptz not null default now();

-- ---------------------------------------------------------------------------
-- 2. amico_bootstrap – deterministyczny wybor firmy
--    Preferujemy firme, w ktorej uzytkownik NIE jest wlascicielem-samotnikiem,
--    czyli te, do ktorej faktycznie dolaczyl; przy remisie – najstarsze czlonkostwo.
-- ---------------------------------------------------------------------------
create or replace function public.amico_bootstrap(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  select m.workspace_id into w
    from public.amico_members m
   where m.user_id = auth.uid()
   order by (select count(*) from public.amico_members x where x.workspace_id = m.workspace_id) desc,
            m.dolaczono asc
   limit 1;

  if w is null then
    insert into public.amico_workspaces (nazwa) values ('AMICO') returning id into w;
    insert into public.amico_members (user_id, workspace_id, imie, email, rola)
      values (auth.uid(), w, coalesce(nullif(p_imie, ''), 'Właściciel'),
              (select u.email from auth.users u where u.id = auth.uid()), 'wlasciciel');
    insert into public.amico_state (workspace_id, data, rev, updated_by)
      values (w, '{}'::jsonb, 0, auth.uid());
  else
    update public.amico_members m
       set imie = coalesce(nullif(p_imie, ''), m.imie)
     where m.user_id = auth.uid() and m.workspace_id = w;
  end if;

  return query
    select m.workspace_id, m.rola, ws.join_code, ws.nazwa
      from public.amico_members m
      join public.amico_workspaces ws on ws.id = m.workspace_id
     where m.user_id = auth.uid() and m.workspace_id = w;
end; $$;

-- ---------------------------------------------------------------------------
-- 3. Odebranie dostepu pracownikowi (tylko wlasciciel / kierownik)
--    Po wywolaniu ta osoba traci prawo odczytu i zapisu danych firmy.
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
    raise exception 'Brak uprawnien do usuwania osob z tej firmy';
  end if;

  if p_user = auth.uid() then
    raise exception 'Nie mozna usunac samego siebie';
  end if;

  delete from public.amico_members m
   where m.user_id = p_user and m.workspace_id = p_workspace;
end; $$;

-- ---------------------------------------------------------------------------
-- 4. Zmiana kodu firmy (po odejsciu pracownika stary kod przestaje dzialac)
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
    raise exception 'Brak uprawnien do zmiany kodu firmy';
  end if;

  nowy := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
  update public.amico_workspaces set join_code = nowy where id = p_workspace;
  return nowy;
end; $$;

-- ---------------------------------------------------------------------------
-- 5. Uprawnienia – nikt anonimowy nie moze wolac tych funkcji
-- ---------------------------------------------------------------------------
revoke all on function public.amico_bootstrap(text) from public, anon;
revoke all on function public.amico_remove_member(uuid, uuid) from public, anon;
revoke all on function public.amico_rotate_join_code(uuid) from public, anon;

grant execute on function public.amico_bootstrap(text) to authenticated;
grant execute on function public.amico_remove_member(uuid, uuid) to authenticated;
grant execute on function public.amico_rotate_join_code(uuid) to authenticated;
