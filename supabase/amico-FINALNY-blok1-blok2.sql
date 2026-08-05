-- =====================================================================
--  AMICO – KOMPLETNA KOMENDA DO SUPABASE (Blok 1 + Blok 2)
--  Uruchom w: Supabase -> SQL Editor -> New query -> wklej CALOSC -> Run.
--
--  BLOK 1  = struktura + utwardzone funkcje + zabezpieczenia (idempotentny,
--            mozna uruchamiac wielokrotnie, nie psuje istniejacych danych).
--  BLOK 2  = CZYSTY START: kasuje WSZYSTKIE dane firm i WSZYSTKIE konta,
--            zeby oddac system klientowi na czysto. Jesli chcesz zachowac
--            dane/konta - NIE uruchamiaj Bloku 2 (usun te sekcje na dole).
-- =====================================================================


-- #####################################################################
-- ##  BLOK 1 – STRUKTURA + BEZPIECZENSTWO                             ##
-- #####################################################################

create extension if not exists pgcrypto;

-- ---------- Tabele ----------
create table if not exists public.amico_workspaces (
  id         uuid primary key default gen_random_uuid(),
  nazwa      text not null default 'AMICO',
  join_code  text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_at timestamptz not null default now()
);

create table if not exists public.amico_members (
  user_id      uuid not null references auth.users(id) on delete cascade,
  workspace_id uuid not null references public.amico_workspaces(id) on delete cascade,
  imie         text not null default '',
  email        text,
  rola         text not null default 'montazysta'
               check (rola in ('wlasciciel', 'kierownik', 'biuro', 'montazysta')),
  created_at   timestamptz not null default now(),
  primary key (user_id, workspace_id)
);

create table if not exists public.amico_state (
  workspace_id uuid primary key references public.amico_workspaces(id) on delete cascade,
  data         jsonb not null default '{}'::jsonb,
  rev          bigint not null default 0,
  updated_at   timestamptz not null default now(),
  updated_by   uuid
);

-- ---------- RLS ----------
alter table public.amico_workspaces enable row level security;
alter table public.amico_members    enable row level security;
alter table public.amico_state      enable row level security;

create or replace function public.amico_is_member(w uuid)
returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.amico_members m
    where m.workspace_id = w and m.user_id = auth.uid()
  );
$$;

drop policy if exists amico_ws_select    on public.amico_workspaces;
drop policy if exists amico_m_select     on public.amico_members;
drop policy if exists amico_state_select on public.amico_state;

create policy amico_ws_select    on public.amico_workspaces for select to authenticated
  using (public.amico_is_member(id));
create policy amico_m_select     on public.amico_members    for select to authenticated
  using (public.amico_is_member(workspace_id));
create policy amico_state_select on public.amico_state      for select to authenticated
  using (public.amico_is_member(workspace_id));
-- Zapis stanu WYLACZNIE przez funkcje amico_save_state (kontrola wersji) - brak polityk INSERT/UPDATE.

-- ---------- Pomocnicze: czyszczenie tekstu wejsciowego ----------
create or replace function public.amico_bezpieczny_tekst(p text, p_max int)
returns text
language sql immutable set search_path = public as $$
  select left(regexp_replace(coalesce(p, ''), '[[:cntrl:]]', '', 'g'), greatest(p_max, 0));
$$;

-- ---------- Bootstrap: pierwsze konto / wejscie wlasciciela (deterministyczny wybor firmy) ----------
create or replace function public.amico_bootstrap(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare w uuid; v_imie text;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  v_imie := public.amico_bezpieczny_tekst(p_imie, 120);

  -- Preferuj firme, w ktorej uzytkownik faktycznie jest (najwiecej czlonkow),
  -- przy remisie najstarsze czlonkostwo - wybor jest powtarzalny (bez tego zwykle
  -- logowanie moglo trafic w puste, prywatne workspace i podmienic dane).
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

-- ---------- Dolaczenie do firmy kodem (kod tylko [A-Z0-9], dlugosc 1-32) ----------
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

-- ---------- Zapis stanu (CAS) + walidacja + limit ~20 MB ----------
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

-- ---------- Zmiana roli (biala lista, bez samo-awansu, ochrona ostatniego wlasciciela) ----------
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
  if p_user = auth.uid() then
    raise exception 'Nie można zmienić własnej roli';
  end if;
  if p_rola = 'wlasciciel' and moja_rola <> 'wlasciciel' then
    raise exception 'Tylko właściciel może nadać rolę właściciela';
  end if;
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

-- ---------- Odebranie dostepu czlonkowi ----------
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

-- ---------- Zmiana kodu firmy ----------
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

-- ---------- Uprawnienia: nic dla anonima, wykonanie tylko dla zalogowanych ----------
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

grant select on public.amico_workspaces, public.amico_members, public.amico_state to authenticated;
grant execute on function public.amico_is_member(uuid)                 to authenticated;
grant execute on function public.amico_bootstrap(text)                 to authenticated;
grant execute on function public.amico_join(text, text)                to authenticated;
grant execute on function public.amico_save_state(uuid, jsonb, bigint) to authenticated;
grant execute on function public.amico_set_role(uuid, uuid, text)      to authenticated;
grant execute on function public.amico_remove_member(uuid, uuid)       to authenticated;
grant execute on function public.amico_rotate_join_code(uuid)          to authenticated;

-- ---------- Realtime (dodaje tylko nasza tabele do publikacji) ----------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'amico_state'
  ) then
    alter publication supabase_realtime add table public.amico_state;
  end if;
exception when others then
  null;
end $$;


-- #####################################################################
-- ##  BLOK 2 – CZYSTY START (kasuje WSZYSTKIE dane i konta)          ##
-- ##  Usun te sekcje, jesli chcesz zachowac istniejace dane/konta.   ##
-- #####################################################################

delete from public.amico_state;
delete from public.amico_members;
delete from public.amico_workspaces;

-- Kasuje wszystkie konta logowania (auth). Po tym pierwsze uruchomienie AMICO
-- zaklada konto wlasciciela od nowa ("Zakładam pierwszy raz").
delete from auth.users;

-- Gotowe. Baza jest utwardzona i pusta - system gotowy do przekazania.
