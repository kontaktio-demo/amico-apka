-- =====================================================================
--  AMICO – schemat chmury (Supabase)  [wersja 2 – utwardzona]
--  BEZPIECZNE: tworzy WYŁĄCZNIE obiekty z prefiksem amico_.
--  Nie modyfikuje ani nie usuwa żadnych istniejących tabel/danych.
--  Idempotentny – można uruchomić ponownie.
--  Uruchom w: Supabase → SQL Editor → New query → wklej → Run.
-- =====================================================================

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

-- Cała baza firmy jako jeden dokument JSON + licznik wersji (rev) do kontroli konfliktów
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
-- Zapis stanu wyłącznie przez funkcję amico_save_state (kontrola wersji) – brak polityk INSERT/UPDATE.

-- ---------- Funkcje (RPC) ----------
-- Każda funkcja twardo wymaga zalogowania (auth.uid()) – ochrona przed anonimem.

create or replace function public.amico_bootstrap(p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  select m.workspace_id into w from public.amico_members m where m.user_id = auth.uid() limit 1;

  if w is null then
    insert into public.amico_workspaces (nazwa) values ('AMICO') returning id into w;
    insert into public.amico_members (user_id, workspace_id, imie, email, rola)
      values (auth.uid(), w, coalesce(nullif(p_imie, ''), 'Właściciel'),
              (select u.email from auth.users u where u.id = auth.uid()), 'wlasciciel');
    insert into public.amico_state (workspace_id, data, rev, updated_by)
      values (w, '{}'::jsonb, 0, auth.uid())
      on conflict (workspace_id) do nothing;
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

create or replace function public.amico_join(p_code text, p_imie text)
returns table (workspace_id uuid, rola text, join_code text, nazwa text)
language plpgsql security definer set search_path = public as $$
declare w uuid;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;

  select ws.id into w from public.amico_workspaces ws where ws.join_code = upper(trim(p_code));
  if w is null then
    raise exception 'Nieprawidłowy kod dołączenia';
  end if;

  insert into public.amico_members (user_id, workspace_id, imie, email, rola)
    values (auth.uid(), w, coalesce(nullif(p_imie, ''), 'Pracownik'),
            (select u.email from auth.users u where u.id = auth.uid()), 'montazysta')
  on conflict (user_id, workspace_id) do update set imie = excluded.imie;

  return query
    select m.workspace_id, m.rola, ws.join_code, ws.nazwa
      from public.amico_members m
      join public.amico_workspaces ws on ws.id = m.workspace_id
     where m.user_id = auth.uid() and m.workspace_id = w;
end; $$;

-- Zapis stanu z kontrolą wersji (CAS). ok=false => konflikt, zwraca aktualny stan serwera.
create or replace function public.amico_save_state(p_workspace uuid, p_data jsonb, p_rev bigint)
returns table (ok boolean, rev bigint, data jsonb)
language plpgsql security definer set search_path = public as $$
declare cur bigint;
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  if not public.amico_is_member(p_workspace) then
    raise exception 'Brak dostępu do tej firmy';
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

create or replace function public.amico_set_role(p_user uuid, p_workspace uuid, p_rola text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Wymagane logowanie'; end if;
  if not exists (
    select 1 from public.amico_members m
     where m.workspace_id = p_workspace and m.user_id = auth.uid()
       and m.rola in ('wlasciciel', 'kierownik')
  ) then
    raise exception 'Brak uprawnień';
  end if;
  update public.amico_members set rola = p_rola
   where user_id = p_user and workspace_id = p_workspace;
end; $$;

-- ---------- Uprawnienia (utwardzenie: nic dla anonima) ----------
revoke all on public.amico_workspaces from anon;
revoke all on public.amico_members    from anon;
revoke all on public.amico_state      from anon;

revoke all on function public.amico_is_member(uuid)                 from public, anon;
revoke all on function public.amico_bootstrap(text)                 from public, anon;
revoke all on function public.amico_join(text, text)                from public, anon;
revoke all on function public.amico_save_state(uuid, jsonb, bigint) from public, anon;
revoke all on function public.amico_set_role(uuid, uuid, text)      from public, anon;

grant select on public.amico_workspaces, public.amico_members, public.amico_state to authenticated;
grant execute on function public.amico_is_member(uuid)                 to authenticated;
grant execute on function public.amico_bootstrap(text)                 to authenticated;
grant execute on function public.amico_join(text, text)                to authenticated;
grant execute on function public.amico_save_state(uuid, jsonb, bigint) to authenticated;
grant execute on function public.amico_set_role(uuid, uuid, text)      to authenticated;

-- ---------- Realtime (dodanie tylko naszej tabeli do istniejącej publikacji) ----------
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
