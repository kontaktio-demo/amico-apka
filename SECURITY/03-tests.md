# Faza 3 — testy

Status: **wykonane na produkcji 2026-09-05** (po uruchomieniu `amico-twierdza.sql`).

## Statyczne

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
`grep -rE "hydrateRoot|renderToString|StaticRouter"` → brak (nie ma SSR, `deserializeErrors` odpada).
`grep -rE "navigate\("` po odfiltrowaniu stałych ścieżek → brak (wszystkie cele nawigacji stałe).

## Baza produkcyjna — wyniki rzeczywiste

| Test | Oczekiwane | Wynik |
|---|---|---|
| RLS-1 tabele w `public` bez RLS | 0 | **BRAK (OK)** |
| RLS-2 polityki permisywne `true` | 0 | **BRAK (OK)** |
| RLS-4 `SECURITY DEFINER` bez `search_path` | 0 | **BRAK (OK)** |
| `anon` — polityki dające dostęp | 0 | **BRAK (OK)** — granty na tabelach są martwe przy RLS |
| Funkcje twierdzy obecne | 6 | **6/6** (`amico_dodaj_czlonka`, `amico_historia_stanu`, `amico_licz`, `amico_moja_rola`, `amico_przywroc_stan`, `amico_wymus_zapis`) |
| `amico_state_history` — liczba polityk | 0 (deny-all) | **jest, polityk: 0** |
| SEC-01 `amico_wejscie` auto-dołączanie | zablokowane | **ZABLOKOWANE (OK)** |
| SEC-02 `amico_save_state` blokada + archiwum | aktywne | **AKTYWNA + archiwizacja (OK)** |
| SEC-03 `amico_join` / `amico_bootstrap` dla `authenticated` | odebrane | **ODEBRANE (OK)** (oba) |
| SEC-10 `amico_skany` `DELETE` dla `authenticated` | odebrane | **ODEBRANE (OK)** |
| SEC-08 buckety | prywatne, limit, typy | **dokumenty**: `public=false`, 25 MB, 12 typów · **skany**: `public=false`, 25 MB, 5 typów |

### Weryfikacja blokady masowego usuwania (bez ruszania danych)

Świadomie **nie wykonano** realnego zapisu czyszczącego na produkcji — gdyby blokada miała lukę,
skasowałaby dane firmy. Zamiast tego zweryfikowano logikę:

- `amico_licz('{"klienci":[1..7]}','klienci')` → **7**; brak klucza → **0**; wartość nie-tablicowa → **0**
  (funkcja nie wywraca się na uszkodzonych danych).
- Symulacja zapisu `{}` na **rzeczywistym** stanie: blokadę wywołałyby **3 kolekcje**,
  największa chroniona to **`klienci` = 182 rekordy**. Zapis zostałby odrzucony.

### Supabase Advisors (security)

**0 błędów.** Pozostałe pozycje przeanalizowane:

- `rls_enabled_no_policy` (INFO) dla `amico_state_history` — **zamierzone**: brak polityk = deny-all,
  dostęp wyłącznie przez `SECURITY DEFINER`. Pozostałe tabele z tej listy (`accounts`, `clients`,
  `leads`, `logs`, `stats`, `audit_log`, `kmail_*`) należą do **innych aplikacji** w tym projekcie
  i również są zamknięte.
- `function_search_path_mutable` (WARN) dla `amico_licz` — **naprawione** w trakcie testów
  (`set search_path = public`, zweryfikowane: funkcja nadal zwraca poprawny wynik).
  Pozostałe dwa trafienia (`ustaw_updated_at`, `update_updated_at_column`) to funkcje triggerowe
  innych aplikacji w tym projekcie.
- `authenticated_security_definer_function_executable` (WARN) dla wszystkich `amico_*` —
  **z założenia**: tak działa aplikacja bez warstwy serwerowej. Każda z tych funkcji ma wewnętrzną
  kontrolę (`auth.uid()`, członkostwo, rola). To nie jest luka, tylko architektura.

### Integralność danych po hardeningu

`skany=80 · członkowie=3 · rev=1108 · historia=0`

Historia jest pusta, bo zapełnia się przy **pierwszym zapisie po wdrożeniu** — to poprawne
zachowanie, nie błąd.

## Regresja funkcjonalna

| Test | Wynik |
|---|---|
| Audyt 21 tras (render, konsola, przewijanie poziome) | **0 problemów** |
| Przepływy: kontrahent, raport kasowy, zamówienie, hurtownie | **0 błędów konsoli** |
| Odporność na uszkodzone dane (23 trasy) | **0 problemów** |
| Idempotentność synchronizacji | **true** |
| Regresja crashu Zadań (priorytet spoza listy) | **PASS** |
| Ekran logowania (tylko logowanie) | **PASS** |

## Testy urządzenia (E2E, do wykonania ręcznie)

- **E2E-3 (SEC-04):** zaloguj się, otwórz klientów, wyloguj → DevTools → Application:
  IndexedDB bez bazy firmy, `localStorage` bez kluczy `amico-*`, Cache Storage puste.
- **E2E-5 (SEC-05):** 15 minut bez dotykania → ekran blokady.
- **E2E-6 (SEC-06):** `curl -sI https://amico-apka.vercel.app | grep -i "content-security-policy"`.
