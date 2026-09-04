# AMICO — audyt bezpieczeństwa (Faza 1)

Data: 2026-09-05 · Gałąź: `security/hardening` · Audytor: Claude Code

## Przemapowanie stacku (obowiązkowe wg briefu)

Brief zakładał Next.js App Router. **Rzeczywisty stack jest inny:**

| Zakładane | Rzeczywiste |
|---|---|
| Next.js App Router, SSR, RSC | **Vite 5.4 + React 18 SPA (HashRouter)** — brak SSR, brak RSC |
| middleware.ts, server actions, route handlers | **brak jakiegokolwiek kodu serwerowego aplikacji** |
| `getSession()` vs `getUser()` na serwerze | **N/A** — nie ma serwera aplikacji |
| DAL `server-only`, `requireRole()` | **N/A** — realizowane w Postgresie (RLS + RPC) |
| next-pwa | **vite-plugin-pwa 0.20.5 / workbox 7.4.1** (utrzymywany) |
| — | dodatkowo **desktop Electron 33** |

**Konsekwencja dla modelu bezpieczeństwa:** cała przeglądarka i cały bundle są niezaufane. Jedyną
realną granicą bezpieczeństwa są **RLS + funkcje RPC w Postgresie oraz Supabase Auth**. Dlatego
punkty A/C/J briefu dotyczące warstwy serwerowej przemapowano na kontrole bazodanowe (sekcja B),
a nie pominięto. Wszystkie punkty niedotyczące oznaczono `N/A` z uzasadnieniem.

## Model zagrożeń (skrót)

Aktorzy: anonim z internetu · zalogowany pracownik (montażysta/biuro) · **były pracownik z żywą
sesją** · **współdzielony/skradziony tablet w warsztacie** · osoba z dostępem do repo/Vercel/Supabase.
Aktywa: dane klientów (RODO: imię, telefon, adres, zdjęcia wnętrz), wyceny i marże, umowy i faktury,
skany dokumentów, integralność zleceń, konta i sesje.

---

## Findings

### SEC-01 | Critical | CWE-284 | Autoryzacja / wejście do firmy — **NAPRAWIONE**
**Lokalizacja:** `supabase/amico-wejscie.sql:29-40`, wołane z `src/lib/cloud.ts` przy każdym logowaniu.
**Opis:** `amico_wejscie()` dopisywało **każde** uwierzytelnione konto jako `montazysta` do
najstarszego workspace. Rola nie ograniczała odczytu — RLS sprawdza wyłącznie członkostwo.
**PoC:** dowolne konto Supabase → login → `amico_wejscie` → pełny odczyt i zapis `amico_state`
(klienci, faktury, marże). Zabezpieczenie istniało wyłącznie jako komentarz w pliku SQL.
**Wpływ:** przejęcie wszystkich danych firmy przez kogokolwiek, kto zdołał założyć konto.
**Fix:** auto-dołączanie usunięte; konto bez nadanego członkostwa dostaje odmowę. Poprawka również
w starym `amico-wejscie.sql`, żeby ponowne uruchomienie skryptu nie przywróciło luki.
**Test:** 03-tests §RLS-3.

### SEC-02 | Critical | CWE-693 | Integralność danych — **NAPRAWIONE**
**Lokalizacja:** `amico_save_state()` w `supabase/amico-bezpieczenstwo.sql`.
**Opis:** dowolny członek mógł wywołać RPC z `p_data = {}` i **nieodwracalnie skasować całą bazę
firmy**. `UPDATE` nadpisywał kolumnę w miejscu, bez historii. CAS chronił tylko przed kolizją wersji.
**PoC:** `supabase.rpc('amico_save_state', {p_workspace, p_data:{}, p_rev: <aktualny>})`.
**Wpływ:** trwała utrata wszystkich danych; brak możliwości odtworzenia poza kopiami na urządzeniach.
**Fix:** (a) archiwizacja każdej wersji w `amico_state_history` (tabela **bez polityk RLS** — dostęp
wyłącznie przez `SECURITY DEFINER`, członek jej nie skasuje), (b) **blokada masowego usunięcia** —
zapis redukujący dowolną kolekcję o ponad połowę jest odrzucany, (c) funkcje ratunkowe właściciela.
**Test:** 03-tests §RLS-5, §RLS-6.

### SEC-03 | High | CWE-284 | Samoobsługowe dołączanie kodem — **NAPRAWIONE**
**Lokalizacja:** `amico_join(p_code, p_imie)`, UI w `CloudPanel.tsx`.
**Opis:** każdy uwierzytelniony, kto znał kod firmy, dopisywał się sam jako `montazysta`. Kod był
**widoczny dla każdego członka** (zwracany przez `amico_wejscie` i wyświetlany w panelu do skopiowania).
**Wpływ:** wyciek kodu (zrzut ekranu, były pracownik, czat) = obcy w danych firmy.
**Fix:** `REVOKE EXECUTE` na `amico_join` i `amico_bootstrap`; UI dołączania i zakładania konta
usunięte; dodano `amico_dodaj_czlonka(workspace, email, rola)` — **tylko właściciel**, imiennie.
**Test:** 03-tests §RPC-2.

### SEC-04 | High | CWE-539 | Dane na urządzeniu po wylogowaniu — **NAPRAWIONE**
**Lokalizacja:** `logout()` w `src/components/Auth.tsx`.
**Opis:** „Wyloguj" czyściło jedynie znacznik ostatniego użytkownika. Na urządzeniu zostawały:
**pełna baza firmy w IndexedDB** (`amico-baza-v1`, nieszyfrowana), **żywy token sesji** w
`localStorage` (`amico-auth`) oraz Cache API.
**Wpływ:** współdzielony tablet w warsztacie / skradziony telefon = pełny dostęp do danych firmy.
**Fix:** `wyczyscUrzadzenie()` — kończy sesję, kasuje IndexedDB, wszystkie klucze `amico-*` i Cache API.
**Zabezpieczenie przed utratą pracy:** najpierw zapisuje niezapisane zmiany; gdy nie ma sieci,
**nie kasuje niczego i nie wylogowuje**, tylko informuje użytkownika.
**Test:** 03-tests §E2E-3.

### SEC-05 | High | CWE-613 | Brak auto-blokady — **NAPRAWIONE**
**Opis:** auto-blokada była świadomie wyłączona; raz zalogowane urządzenie zostawało odblokowane
bezterminowo, także po restarcie.
**Fix:** blokada po 15 min bezczynności oraz po powrocie z dłuższej przerwy (`visibilitychange`).
Odblokowanie PIN-em, biometrią lub hasłem; „Zmień użytkownika" zawsze dostępne (brak zakleszczenia).

### SEC-06 | High | CWE-1021 | Brak Content-Security-Policy — **NAPRAWIONE**
**Opis:** brak CSP. Nic nie ograniczało, dokąd strona może wysłać dane ani skąd wykonać skrypt.
**Fix:** CSP wymuszone w `vercel.json`: `script-src 'self'` (zweryfikowano — build nie ma skryptów
inline), `connect-src` ograniczone do własnej domeny i projektu Supabase (+`wss:` dla realtime),
`object-src 'none'`, `frame-ancestors 'none'`, `base-uri`/`form-action 'self'`,
`upgrade-insecure-requests`. Dodatkowo `Cross-Origin-Opener-Policy` i `X-Permitted-Cross-Domain-Policies`.
**Uwaga:** `style-src` zawiera `'unsafe-inline'` — wymagane przez inline `style=` Reacta/Tailwinda.
Nonce dla stylów wymagałby warstwy serwerowej, której ten stack nie ma (decyzja w `decyzje.md`).

### SEC-07 | Medium | CWE-522 | Podpisane URL ważne godzinę — **NAPRAWIONE**
`createSignedUrl(..., 3600)` dla skanów i dokumentów → **300 s**, cache klienta 4 min.

### SEC-08 | Medium | CWE-434 | Storage bez limitów, treści aktywne inline — **NAPRAWIONE**
Buckety `skany`/`dokumenty` były prywatne (dobrze), ale **bez `file_size_limit` i bez
`allowed_mime_types`**, a dokumenty serwowano inline — plik `.html`/`.svg` wykonałby skrypt
w kontekście domeny Storage. Fix: limit 25 MB, allowlista MIME **bez** `text/html` i `image/svg+xml`,
oraz wymuszone pobieranie (`download: true`) zamiast wyświetlania.

### SEC-09 | Medium | CWE-1395 | Podatna zależność — **NAPRAWIONE (częściowo, świadomie)**
`react-router-dom` 6.30.4 → **6.30.6**. Dwie pozostałe advisories **nie dotyczą tej aplikacji**:
`deserializeErrors` wymaga SSR (brak SSR), open redirect wymaga danych użytkownika w celu nawigacji —
zweryfikowano grepem: wszystkie `navigate()` mają cele stałe. Aktualizacja do v7 to zmiana łamiąca
na produkcyjnej aplikacji — świadomie odrzucona (`decyzje.md`).

### SEC-10 | Medium | CWE-284 | RLS skanów tylko w bazie — **NAPRAWIONE**
Tabela `amico_skany` powstała migracją MCP; repo zawierało wyłącznie definicję bucketa. Odtworzenie
środowiska z repo dałoby tabelę **bez RLS**. Fix: idempotentne wymuszenie RLS + polityki per operacja
+ **odebranie `DELETE`** (aplikacja i tak kasuje miękko — twardego kasowania nie da się już wykonać).

### SEC-11 | Info | Token sesji w `localStorage` — **ZAAKCEPTOWANE**
Nieodłączne dla SPA bez warstwy serwerowej (`@supabase/ssr` z ciasteczkami `HttpOnly` wymaga serwera).
Ryzyko ograniczone przez: brak wektorów XSS (zweryfikowano), CSP `script-src 'self'`, krótki JWT,
oraz czyszczenie przy wylogowaniu (SEC-04). Trwałe rozwiązanie = przeniesienie na Next.js/BFF.

### SEC-12 | Info | `select('*')` w `skanyDb.ts` — akceptowalne (RLS ogranicza do własnej firmy).

---

## Zweryfikowane jako poprawne (dowód, brak findingu)

- **Electron** (`electron/main.cjs:116-148`): `contextIsolation:true`, `nodeIntegration:false`,
  `sandbox:true`, preload, `setWindowOpenHandler`, guard `will-navigate`. **OK**
- **Service worker** (`vite.config.ts`): **brak `runtimeCaching`** — cache'owane wyłącznie statyczne
  assety (js/css/html/svg/png/woff). Żadna odpowiedź Supabase ani dane użytkownika nie trafiają
  do cache. **OK** (to najczęstszy błąd PWA — tu go nie ma)
- **XSS:** jedyne `innerHTML` (`print.tsx:182`) wstawia **stały** literał bez danych użytkownika.
  Brak `eval`, `new Function`, `document.write`, `srcdoc`, `dangerouslySetInnerHTML`. **OK**
- **URL od użytkownika:** `pelnyLink()` (`Hurtownie.tsx:12`) wymusza `https://` — `javascript:`
  nie przejdzie. Linki zewnętrzne mają `rel="noreferrer"`. **OK**
- **Sekrety:** w kodzie i bundlu wyłącznie klucz `sb_publishable_`. Brak `service_role`,
  `sb_secret_`, connection stringów. **OK**
- **Hasła lokalne:** PBKDF2-SHA256, 120 000 iteracji (hasło) i 60 000 (PIN), sól losowa,
  blokada PIN po 5 próbach. **OK**
- **Buckety:** oba `public=false`, polityki `storage.objects` per operacja, ścieżka przypięta do
  `workspace_id` przez `amico_is_member((storage.foldername(name))[1]::uuid)`. **OK**
- **Nazwy plików:** generowane/sanityzowane serwerowo-stronowo (`[^\w.\-]+` → `_`), brak path traversal. **OK**
- **Offboarding natychmiastowy:** usunięcie wiersza z `amico_members` odcina dostęp **od razu**,
  nawet przy żywym JWT — bo wszystkie polityki i RPC sprawdzają członkostwo w tabeli, nie w tokenie.
  To spełnia wymóg briefu „zbanowany użytkownik z żywym tokenem nie może nic odczytać". **OK**
- **CSV injection:** brak eksportu CSV/XLSX. **N/A**
- **CVE-2025-29927 (bypass middleware)** i **CVE-2025-55182 (React2Shell / deserializacja RSC)**:
  **N/A** — brak Next.js, brak middleware, brak SSR/RSC. React 18.3.1 nie jest podatny bez RSC.
- **`ignoreBuildErrors` / `ignoreDuringBuilds`:** nie występują; build przechodzi z pełnym `tsc`. **OK**

---

## UNVERIFIED — wymaga dostępu do paneli (patrz `MANUAL_STEPS.md`)

Konektor Supabase w tej sesji wymagał ponownej autoryzacji, więc poniższych **nie dało się
potwierdzić z kodu** i nie wolno ich uznać za bezpieczne bez sprawdzenia:

- Auth: wyłączona rejestracja, potwierdzanie e-maila, secure email change, ochrona haseł z wycieków
  (HIBP), minimalna długość hasła, MFA/TOTP dla właściciela, limity prób logowania.
- Auth URL Configuration: Site URL bez wildcardów, brak `localhost` w projekcie produkcyjnym.
- Region projektu (RODO — wymagany UE), backupy/PITR, Network Restrictions, wymuszone SSL.
- Vercel: ochrona deploymentów preview, oznaczenie zmiennych jako „Sensitive".
- GitHub: prywatność repo, branch protection, secret scanning, historia sekretów.
- Custom SMTP + SPF/DKIM/DMARC.
