-- =====================================================================
--  AMICO - ustawienie hasel zespolu  (Supabase -> SQL Editor -> Run)
--  Jedna firma AMICO, wlascicielka = milena@amicco.pl.
--    milena@amicco.pl    (Milena, WLASCICIELKA)        haslo: Amico123!
--    biuro@amicco.pl     (Jakub, KIEROWNIK biura)      haslo: Amico123@
--    wiktoria@amicco.pl  (Wiktoria, PRACOWNICA biura)  haslo: Amico123$
--
--  Bezpieczne: tylko UPDATE hasel na ISTNIEJACYCH kontach. Nic nie kasuje,
--  nie rusza danych firmy (klientow, faktur itd.). Zalogowane sesje dzialaja dalej.
-- =====================================================================

-- (1) PODGLAD - ktore konta istnieja i jaka maja role w firmie:
select u.email,
       (u.encrypted_password is not null) as ma_haslo,
       (u.email_confirmed_at is not null) as potwierdzony,
       m.rola                              as rola_w_firmie
from auth.users u
left join public.amico_members m on m.user_id = u.id
where u.email in ('milena@amicco.pl','biuro@amicco.pl','wiktoria@amicco.pl')
order by u.email;

-- (2) USTAWIENIE HASEL (bcrypt jak w Supabase Auth):
update auth.users set
  encrypted_password = extensions.crypt('Amico123!', extensions.gen_salt('bf', 10)),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email = 'milena@amicco.pl';

update auth.users set
  encrypted_password = extensions.crypt('Amico123@', extensions.gen_salt('bf', 10)),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email = 'biuro@amicco.pl';

update auth.users set
  encrypted_password = extensions.crypt('Amico123$', extensions.gen_salt('bf', 10)),
  email_confirmed_at = coalesce(email_confirmed_at, now()),
  updated_at = now()
where email = 'wiktoria@amicco.pl';

-- (3) SPRAWDZENIE - powinno pokazac 3 konta z ma_haslo = true:
select u.email, (u.encrypted_password is not null) as ma_haslo, m.rola as rola_w_firmie
from auth.users u
left join public.amico_members m on m.user_id = u.id
where u.email in ('milena@amicco.pl','biuro@amicco.pl','wiktoria@amicco.pl')
order by u.email;

-- UWAGA: jesli w podgladzie (1) ktoregos e-maila NIE MA - to konto jeszcze nie
-- istnieje w chmurze. Wtedy ta osoba zaklada je RAZ w aplikacji: "Dolaczam do firmy"
-- + KOD FIRMY (Ustawienia -> Chmura u Mileny), haslo ustawia przy rejestracji.
-- Role (kierownik / pracownik biura) nadaje Milena: Ustawienia -> Uzytkownicy.
