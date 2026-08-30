-- ============================================================================
-- AMICO - HARDENING: ochrona wlasciciela przed kierownikiem
-- ----------------------------------------------------------------------------
-- Problem (potwierdzony audytem): amico_set_role / amico_remove_member pozwalaly
-- roli 'kierownik' ZDEGRADOWAC lub USUNAC 'wlasciciela' (o ile wlascicieli bylo >1).
-- Podwladny mogl modyfikowac przelozonego - broken access control.
--
-- Ten skrypt jest CZYSTO RESTRYKCYJNY: dodaje warunek, ze istniejacego wlasciciela
-- moze modyfikowac/usunac WYLACZNIE inny wlasciciel. Nie dotyka zadnych danych.
-- Bezpieczny do wielokrotnego uruchomienia (create or replace).
--
-- Uruchom w Supabase -> SQL Editor (lub przez migracje).
-- ============================================================================

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
  -- Istniejacego wlasciciela moze modyfikowac wylacznie inny wlasciciel.
  if moja_rola <> 'wlasciciel' and exists (
    select 1 from public.amico_members m
     where m.workspace_id = p_workspace and m.user_id = p_user and m.rola = 'wlasciciel'
  ) then
    raise exception 'Tylko właściciel może zmienić rolę innego właściciela';
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
  -- Wlasciciela moze usunac wylacznie inny wlasciciel.
  if moja_rola <> 'wlasciciel' and exists (
    select 1 from public.amico_members m
     where m.workspace_id = p_workspace and m.user_id = p_user and m.rola = 'wlasciciel'
  ) then
    raise exception 'Tylko właściciel może usunąć innego właściciela';
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
