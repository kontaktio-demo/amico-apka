# Faza 3 — testy

## Statyczne (wykonane)

| Test | Komenda | Wynik |
|---|---|---|
| Typy | `npx tsc --noEmit` | **0 błędów** |
| Lint | `npx eslint "src/**/*.{ts,tsx}"` | **0 błędów** (8 ostrzeżeń: nieużywane dyrektywy `eslint-disable`) |
| Build | `npm run build` | **OK** |
| Zależności | `npm audit --production` | 3 moderate → 1 naprawiona, 2 niedotyczące (dowód niżej) |
| Sekrety w kodzie | `grep -rniE "service_role\|sb_secret_\|SUPABASE_SERVICE" src/ supabase/` | **0 trafień** |
| Sekrety w bundlu | `grep -rEo "sb_secret_\|service_role" dist/assets` | **0 trafień**; tylko `sb_publishable_` |
| Wektory XSS | `grep -rE "dangerouslySetInnerHTML\|innerHTML\|eval\(\|new Function\("` | jedyne trafienie: **stały literał** w `print.tsx:182` |
| Cache SW | `grep runtimeCaching vite.config.ts` | **brak** — cache wyłącznie statyków |

**Dowód, że pozostałe advisories `react-router` nie dotyczą aplikacji:**
`grep -rE "hydrateRoot|renderToString|StaticRouter"` → brak trafień (nie ma SSR, więc
`deserializeErrors` odpada). `grep -rE "navigate\("` po odfiltrowaniu stałych ścieżek → brak
trafień (wszystkie cele nawigacji są stałe, open redirect niewykonalny).

## Regresja funkcjonalna (wykonana po każdej zmianie)

| Test | Wynik |
|---|---|
| Audyt 21 tras (render, konsola, przewijanie poziome) | **0 problemów, 0 błędów** |
| Przepływy: kontrahent, raport kasowy, zamówienie, hurtownie | **wszystkie `true`, 0 błędów konsoli** |
| Odporność na uszkodzone dane (23 trasy) | **0 problemów** |
| Idempotentność synchronizacji | **`true`** |
| Regresja crashu Zadań (priorytet spoza listy) | **PASS** |
| Ekran logowania (tylko logowanie, bez rejestracji) | **PASS** |

## Testy bazodanowe — do wykonania PO uruchomieniu `amico-twierdza.sql`

Nie dało się ich wykonać w tej sesji: konektor Supabase wymagał ponownej autoryzacji, a sesja
jest nieinteraktywna. Zapytania są gotowe — uruchom w SQL Editor i porównaj z oczekiwaniem.

```sql
-- RLS-1: tabele w public bez RLS -> oczekiwane 0 wierszy
select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
where c.relkind = 'r' and n.nspname = 'public' and not c.relrowsecurity;

-- RLS-2: polityki permisywne "true" -> oczekiwane 0 wierszy
select tablename, policyname, cmd from pg_policies
where schemaname = 'public' and (qual = 'true' or with_check = 'true');

-- RLS-4: funkcje SECURITY DEFINER muszą mieć ustawiony search_path (proconfig != NULL)
select p.proname, p.prosecdef, p.proconfig from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef;

-- STOR-1 (SEC-08): limity i typy na bucketach
select id, public, file_size_limit, allowed_mime_types from storage.buckets;

-- Granty dla anon -> oczekiwane 0 wierszy
select table_name, privilege_type from information_schema.role_table_grants
where grantee = 'anon' and table_schema = 'public';
```

Testy negatywne wymagające drugiego konta (uruchom jako konto BEZ członkostwa):

- **RLS-3 (SEC-01):** `select * from amico_wejscie('Test');` → oczekiwany wyjątek
  „To konto nie ma dostępu do firmy".
- **RPC-2 (SEC-03):** `select * from amico_join('KOD','Test');` → oczekiwany błąd uprawnień.
- **RLS-5 (SEC-02):** `select * from amico_save_state('<ws>'::uuid, '{}'::jsonb, <rev>);`
  → oczekiwany wyjątek „Zapis zablokowany…".
- **RLS-6 (SEC-02):** bezpośredni `select * from amico_state_history` z aplikacji →
  brak uprawnień (brak polityk + `revoke`), a `amico_historia_stanu` jako właściciel → działa.

## Testy urządzenia (E2E, ręcznie)

- **E2E-3 (SEC-04):** zaloguj się, otwórz klientów, wyloguj. DevTools → Application:
  IndexedDB bez bazy firmy, `localStorage` bez kluczy `amico-*`, Cache Storage puste,
  „wstecz" nie pokazuje danych.
- **E2E-5 (SEC-05):** zostaw aplikację 15 minut bez dotykania → ekran blokady.
- **E2E-6 (SEC-06):** po deployu
  `curl -sI https://amico-apka.vercel.app | grep -i "content-security-policy\|strict-transport"`
  → nagłówki obecne.
