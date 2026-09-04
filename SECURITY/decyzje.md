# Dziennik decyzji

## 2026-09-05 — Faza 0

**Stack jest inny niż w briefie.** Brief zakładał Next.js App Router. Aplikacja to Vite + React
SPA bez warstwy serwerowej. Każdy punkt dotyczący middleware, server actions, RSC, `getSession()`
na serwerze i DAL `server-only` przemapowano na kontrole w Postgresie (RLS + RPC) albo oznaczono
`N/A` z uzasadnieniem w `01-audit.md`. Nic nie zostało pominięte po cichu.

Konsekwencja: CVE-2025-29927 (bypass middleware) i CVE-2025-55182 (React2Shell, deserializacja
RSC) **nie dotyczą** tej aplikacji — nie ma middleware ani SSR/RSC. React 18.3.1 bez RSC nie jest
podatny.

## 2026-09-05 — Faza 2

**`style-src 'unsafe-inline'` zostaje.** React i Tailwind ustawiają style inline (`style=`).
Nonce dla stylów wymagałby generowania nagłówka per request, czyli warstwy serwerowej, której ten
stack nie ma. Ryzyko jest niskie (CSS injection bez możliwości wykonania skryptu), a kluczowe
`script-src 'self'` **bez** `unsafe-inline` zostało utrzymane — to ono blokuje wykonanie kodu.

**`react-router` zostaje na 6.30.6.** Dwie pozostałe advisories nie dotyczą aplikacji (dowód
w `03-tests.md`). Aktualizacja do v7 to zmiana łamiąca na produkcji używanej codziennie przez
firmę. Odłożone do zaplanowanej migracji, nie do wykonania „przy okazji" hardeningu.

**Token sesji zostaje w `localStorage`.** Ciasteczka `HttpOnly` wymagają `@supabase/ssr`
i serwera. Ryzyko ograniczone przez CSP `script-src 'self'`, brak wektorów XSS (zweryfikowany)
i czyszczenie przy wylogowaniu. Trwałe rozwiązanie to przeniesienie na BFF/Next.js — decyzja
biznesowa, nie techniczna. Zapisane jako dług.

**`signOut({ scope: 'local' })` pozostaje lokalny.** Globalne wylogowanie wyrzucałoby naraz
wszystkie urządzenia firmy (komputer w biurze + tablety monterów), co przy pracy w terenie jest
szkodliwe. Odcięcie byłego pracownika realizuje **usunięcie członkostwa**, które działa
natychmiast mimo żywego tokenu, bo polityki sprawdzają tabelę, nie token. To spełnia wymóg
briefu dotyczący zbanowanego użytkownika.

**Blokada masowego usuwania może zablokować legalną operację.** Świadomie: dyrektywa brzmiała
„bezpieczeństwo ponad wygodę", a utrata danych jest nieodwracalna. Furtka dla właściciela:
`amico_wymus_zapis`.

**Auto-blokada 15 minut** — była wcześniej wyłączona na wyraźne życzenie właściciela. Nowa
dyrektywa ją przywraca. Wartość łatwa do zmiany w `Auth.tsx` (stała `LIMIT`), gdyby okazała się
zbyt uciążliwa w warsztacie.

**Allowlista MIME może odrzucić nietypowy plik** (np. `.dwg`). Lista jest w `amico-twierdza.sql`
§9 i można ją rozszerzyć. Celowo **nie zawiera** `text/html` ani `image/svg+xml` — to treści
aktywne, które wykonują skrypt w kontekście domeny Storage.

## Czego nie udało się zweryfikować w tej sesji

Konektor Supabase wymagał ponownej autoryzacji, a sesja jest nieinteraktywna (nie da się przejść
OAuth). W konsekwencji **nie uruchomiono** `amico-twierdza.sql` na produkcji i **nie odpytano**
Security/Performance Advisors. Wszystkie takie pozycje trafiły do `MANUAL_STEPS.md` razem
ze sposobem weryfikacji. Do czasu ich wykonania status bazy pozostaje `UNVERIFIED` — kod jest
przygotowany, ale baza nadal działa na starych funkcjach.
