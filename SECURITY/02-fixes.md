# Faza 2 — wprowadzone poprawki

Każda pozycja odnosi się do ID z `01-audit.md`.

| ID | Poprawka | Gdzie |
|---|---|---|
| SEC-01 | Koniec auto-dołączania do firmy | `supabase/amico-twierdza.sql` §4, `supabase/amico-wejscie.sql` |
| SEC-02 | Historia stanu + blokada masowego usuwania + funkcje ratunkowe | `amico-twierdza.sql` §1, §3, §6 |
| SEC-03 | Odebranie `amico_join`/`amico_bootstrap`; nadawanie dostępu przez właściciela | `amico-twierdza.sql` §7, §8 · `UzytkownicyPanel.tsx` · `CloudPanel.tsx` · `cloud.ts` |
| SEC-04 | Wylogowanie czyści urządzenie (IndexedDB, localStorage, Cache API, sesja) | `cloud.ts: wyczyscUrzadzenie()` · `Auth.tsx: logout()` |
| SEC-05 | Auto-blokada po 15 min bezczynności i po powrocie z dłuższej przerwy | `Auth.tsx` |
| SEC-06 | CSP + Cross-Origin-Opener-Policy + X-Permitted-Cross-Domain-Policies | `vercel.json` |
| SEC-07 | TTL podpisanych URL 3600 s → 300 s (cache klienta 4 min) | `cloud.ts` |
| SEC-08 | Limit 25 MB, allowlista MIME bez `text/html` i `image/svg+xml`, wymuszone pobieranie | `amico-twierdza.sql` §9 · `cloud.ts` |
| SEC-09 | `react-router-dom` 6.30.4 → 6.30.6 | `package-lock.json` |
| SEC-10 | RLS `amico_skany` odtworzone w repo + odebranie twardego `DELETE` | `amico-twierdza.sql` §5 |

## Jak poprawki chronią przed utratą danych

Dwie z nich dotykają danych, więc zostały napisane tak, żeby **nie mogły niczego zniszczyć**:

- `amico_save_state` archiwizuje **poprzednią** wersję zanim cokolwiek nadpisze, a przy
  podejrzanym skurczu w ogóle nie wykonuje `UPDATE`.
- `wyczyscUrzadzenie()` najpierw próbuje zapisać niezapisane zmiany. Gdy nie ma sieci —
  **przerywa, nie kasuje niczego i nie wylogowuje**, a użytkownik dostaje komunikat.

## Świadomie nieodwracalne (bezpieczeństwo ponad wygodę)

- Nie da się już samemu dołączyć do firmy, nawet znając kod. Dostęp nadaje właściciel imiennie.
- Nie da się twardo skasować skanu (tylko miękko) ani rekordu historii stanu.
- Zapis kasujący ponad połowę dowolnej kolekcji jest odrzucany do czasu użycia
  `amico_wymus_zapis` przez właściciela.

## Weryfikacja po każdej zmianie

`npx tsc --noEmit` → 0 · `npx eslint` → 0 błędów · `npm run build` → OK ·
audyt 21 tras → 0 problemów · przepływy/uszkodzone dane/idempotentność/crash/login → PASS.
Szczegóły w `03-tests.md`.
