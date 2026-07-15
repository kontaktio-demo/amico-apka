-- ============================================================================
-- AMICO – czysty start kont w chmurze (uruchom w Supabase -> SQL Editor -> Run)
--
-- Kasuje WSZYSTKIE konta logowania i dane firmy LEZACE W CHMURZE (workspace + stan),
-- zeby zaczac na czysto. NIE rusza zadnych tabel spoza amico_* i auth.users.
--
-- WAZNE: dane wpisane w aplikacji na urzadzeniu (PWA) zostaja na tym urzadzeniu.
-- Po tym resecie:
--   1. Na urzadzeniu z danymi (tablet/PWA): Ustawienia -> Chmura -> "Załóż konto"
--      (e-mail firmy + haslo). To wgra wszystkie dane do tej bazy Supabase.
--   2. Na kolejnych urzadzeniach (komputer/Electron): "Mam już konto" -> ten sam
--      e-mail i haslo. Dane pojawia sie automatycznie.
--
-- Skrypt jest idempotentny (mozna uruchomic wielokrotnie).
-- ============================================================================

-- 1) Dane i powiazania aplikacji (kolejnosc wazna przez klucze obce)
delete from public.amico_state;
delete from public.amico_members;
delete from public.amico_workspaces;

-- 2) Wszystkie konta logowania (auth). Po tym kroku zaden stary login nie dziala.
delete from auth.users;

-- Gotowe. Baza jest czysta - zaloz konto od nowa z poziomu aplikacji.
