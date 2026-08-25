-- =====================================================================
--  AMICO - proste wejscie do JEDYNEJ firmy (dla uproszczonego logowania)
--  Uruchom raz w: Supabase -> SQL Editor -> Run. Idempotentne, bezpieczne,
--  nie rusza danych firmy. Wymaga wczesniej uruchomionego schematu AMICO
--  (funkcja amico_bezpieczny_tekst).
--
--  Po co: logowanie w aplikacji to teraz sam e-mail + haslo. "Zaloz konto"
--  ma automatycznie dolaczyc do tej samej firmy AMICO (bez kodow, bez wyboru
--  "zakladam/dolaczam"). Ta funkcja to obsluguje.
-- =====================================================================

create or replace function public.amico_wejscie(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w uuid; v_imie text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  -- Czyszczenie imienia bez zaleznosci od innych funkcji (dziala na kazdym schemacie).
  v_imie := left(regexp_replace(coalesce(p_imie, ''), '[[:cntrl:]]', '', 'g'), 120);

  -- 1) Firma, ktorej uzytkownik JUZ jest czlonkiem (najstarsze czlonkostwo).
  select m.workspace_id into w
    from public.amico_members m
   where m.user_id = auth.uid()
   order by m.created_at asc
   limit 1;

  -- 2) Nie jest czlonkiem zadnej? Dolacz do JEDYNEJ / najstarszej istniejacej firmy.
  if w is null then
    select ws.id into w from public.amico_workspaces ws order by ws.created_at asc limit 1;
    if w is not null then
      -- Najnizsza rola (montazysta) - najmniej uprawnien. Wlascicielka podniesie role
      -- w aplikacji (Ustawienia -> Uzytkownicy), jesli osoba ma miec wiekszy dostep.
      insert into public.amico_members (user_id, workspace_id, imie, email, rola)
        values (auth.uid(), w, coalesce(nullif(v_imie, ''), 'Pracownik'),
                (select u.email from auth.users u where u.id = auth.uid()), 'montazysta')
      on conflict on constraint amico_members_pkey do update set imie = excluded.imie;
    end if;
  end if;

  -- 3) W ogole nie ma jeszcze zadnej firmy? Pierwsze konto zaklada ja jako wlasciciel.
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

revoke all on function public.amico_wejscie(text) from public, anon;
grant execute on function public.amico_wejscie(text) to authenticated;

-- UWAGA (bezpieczenstwo): punkt 2 sprawia, ze KAZDA osoba, ktora zaloguje sie/zalozy
-- konto, dolacza do firmy AMICO. Dla wewnetrznej apki (prywatny adres, kilka osob) to
-- wygoda. Jesli chcesz, zeby konta zakladala tylko wlascicielka:
-- Supabase -> Authentication -> Sign In / Providers -> wylacz "Allow new users to sign up".
-- Wtedy w aplikacji dziala samo logowanie, a nowe osoby dodaje wlascicielka w panelu Supabase.
