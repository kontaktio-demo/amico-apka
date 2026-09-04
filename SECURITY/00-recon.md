# Faza 0 — rekonesans

Data: 2026-09-05

## Wersje (z `package-lock.json`, nie z zakresów)

`react` 18.3.1 · `react-dom` 18.3.1 · `vite` 5.4.21 · `@supabase/supabase-js` 2.110.2 ·
`react-router-dom` 6.30.6 (po aktualizacji) · `vite-plugin-pwa` 0.20.5 (`workbox-build` 7.4.1) ·
`electron` 33.4.11 · `jspdf` 4.2.1 · `html2canvas` 1.4.1.

Brak `next`, brak `zod`, brak `next-pwa` (nieutrzymywanej biblioteki z briefu).

## Architektura

SPA (Vite + React + HashRouter) hostowana statycznie na Vercel. **Zero kodu serwerowego
aplikacji** — brak middleware, server actions, route handlers, SSR i RSC. Dodatkowo build
desktopowy Electron (`electron/main.cjs` + `preload.cjs`).

Cała autoryzacja żyje w Postgresie: RLS + funkcje RPC `SECURITY DEFINER`. To jest jedyny
punkt, w którym da się cokolwiek wymusić — reszta jest po stronie klienta i jest niezaufana.

## Klient Supabase

Jeden, przeglądarkowy: `src/lib/supabase.ts`. Klucz `sb_publishable_` (publiczny z założenia,
chroni RLS). `persistSession: true`, `storageKey: 'amico-auth'` (localStorage).
**Brak klienta `service_role` w całym repozytorium** — zweryfikowano grepem po
`service_role|sb_secret_|SUPABASE_SERVICE`: 0 trafień w `src/`, `supabase/` i w `dist/`.

## Powierzchnia bazy

Tabele: `amico_workspaces`, `amico_members`, `amico_state`, `amico_skany`,
`amico_state_history` (nowa). RLS włączone na wszystkich. `amico_state_history` celowo
**bez polityk** — dostęp wyłącznie przez `SECURITY DEFINER`.

Funkcje RPC dostępne dla `authenticated`: `amico_is_member`, `amico_wejscie`,
`amico_save_state`, `amico_set_role`, `amico_remove_member`, `amico_rotate_join_code`,
`amico_moja_rola`, `amico_historia_stanu`, `amico_przywroc_stan`, `amico_wymus_zapis`,
`amico_dodaj_czlonka`. **Odebrane użytkownikom:** `amico_join`, `amico_bootstrap`.

Buckety Storage: `skany`, `dokumenty` — oba `public=false`, polityki per operacja przypięte do
`workspace_id` będącego pierwszym segmentem ścieżki
(`amico_is_member(((storage.foldername(name))[1])::uuid)`).

## Model ról

Rola pochodzi z `amico_members.rola` (tabela chroniona RLS) — **nie** z `user_metadata`,
które użytkownik może zmienić sam przez `auth.updateUser`. Tego częstego błędu tutaj nie ma.

Kluczowa właściwość: polityki RLS sprawdzają **członkostwo**, nie rolę zapisaną w tokenie.
Dlatego usunięcie członkostwa odcina dostęp natychmiast, mimo żywego JWT.

## PWA / urządzenie

Manifest: `start_url '/'`, `scope '/'`, `display standalone`, bez tokenów w URL.
Service worker: `registerType autoUpdate`, `clientsClaim`, `cleanupOutdatedCaches`,
`globPatterns` obejmuje tylko statyki. **Brak `runtimeCaching`** — żadna odpowiedź API nie jest
cache'owana (to najczęstszy błąd PWA; tutaj go nie ma).

Dane lokalne: IndexedDB `amico-baza-v1` (cała baza firmy, nieszyfrowana),
localStorage: `amico-auth`, `amico-baza-ws`, `amico-workspace`, `amico-ostatni-uzytkownik`,
`amico-rev-<ws>`, `amico-pin-proby-<id>`.

## Integracje zewnętrzne

Brak analityki, brak zewnętrznych skryptów, fonty lokalne. PDF generowany w przeglądarce
(`jspdf`/`html2canvas`) — **brak Playwright/puppeteer po stronie serwera**, więc ryzyko
SSRF i odczytu plików lokalnych przez generator PDF nie występuje.

Jedyny zewnętrzny host: `https://<projekt>.supabase.co` (REST + Storage + Realtime `wss`).
To pozwoliło domknąć `connect-src` w CSP do jednej domeny.

## Model zagrożeń

Aktorzy: anonim z internetu · zalogowany pracownik (montażysta/biuro) · **były pracownik
z żywą sesją** · **współdzielony lub skradziony tablet w warsztacie** · osoba z dostępem do
repo/Vercel/Supabase · dostawca złośliwej zależności npm.

Aktywa: dane osobowe klientów (RODO: imię, telefon, adres, zdjęcia wnętrz), wyceny i marże,
umowy i faktury, skany dokumentów, integralność zleceń, konta i sesje.
