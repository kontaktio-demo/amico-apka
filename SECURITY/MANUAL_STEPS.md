# Kroki do wykonania ręcznie (poza kodem)

Tego nie da się zmienić z repozytorium. Kolejność = priorytet.
Status: `[ ]` do zrobienia · `[x]` zrobione · data przy odhaczeniu.

---

## 1. Uruchom skrypt hartujący bazę — **NAJWAŻNIEJSZE**

`[x]` **WYKONANE 2026-09-05** — Supabase → SQL Editor → `supabase/amico-twierdza.sql` → Run.
 Zweryfikowane na produkcji: wszystkie 6 funkcji obecne, auto-dolaczanie zablokowane,
 blokada masowego usuwania aktywna, `amico_join`/`amico_bootstrap` odebrane, limity bucketow
 ustawione. Szczegoly w `03-tests.md`.

Skrypt jest idempotentny (można puścić wielokrotnie). Co robi:
- historia stanu firmy (`amico_state_history`) — każda wersja archiwizowana, nic nie ginie,
- blokada masowego usuwania w `amico_save_state`,
- koniec automatycznego dołączania do firmy (`amico_wejscie`),
- odebranie `amico_join` i `amico_bootstrap` (dołączanie kodem),
- `amico_dodaj_czlonka` — nadawanie dostępu przez właściciela,
- RLS na `amico_skany` + odebranie twardego kasowania,
- limity 25 MB i lista dozwolonych typów na bucketach.

**Weryfikacja po uruchomieniu** (ma zwrócić `Twierdza gotowa...`), a następnie:
```sql
-- musi zwrócić 0 wierszy: tabele w public bez RLS
select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
where c.relkind='r' and n.nspname='public' and not c.relrowsecurity;

-- musi pokazać limity i brak text/html oraz image/svg+xml
select id, public, file_size_limit, allowed_mime_types from storage.buckets;
```

**Uwaga na blokadę masowego usuwania:** jeśli kiedyś świadomie usuniecie dużo rekordów naraz,
zapis zostanie odrzucony z komunikatem. Wtedy właściciel używa `amico_wymus_zapis(...)`.
To celowe — chroni przed wyczyszczeniem bazy przez pomyłkę lub przejęte konto.

---

## 2. Supabase → Authentication (ustawienia, których nie widać z kodu)

`[ ]` **Providers → Email → „Allow new users to sign up" = OFF**
 Powód: aplikacja jest wewnętrzna. Konta zakłada właściciel.
 Weryfikacja: próba rejestracji z aplikacji/API zwraca błąd „signups not allowed".

`[ ]` **„Confirm email" = ON** oraz **„Secure email change" = ON**
 Powód: bez tego można podmienić adres konta bez potwierdzenia.

`[ ]` **Policies → minimalna długość hasła ≥ 12** i **„Leaked password protection" (HIBP) = ON**
 Powód: blokuje hasła z publicznych wycieków.

`[ ]` **MFA (TOTP) = ON i włączone dla konta właściciela**
 Powód: konto właściciela może nadawać dostęp i przywracać dane. Bez MFA wystarczy jedno hasło.

`[ ]` **Anonymous sign-ins = OFF** (jeśli nieużywane).

`[ ]` **Rate limits** — pozostaw domyślne lub zaostrz dla logowania i resetu hasła.

`[ ]` **URL Configuration:** Site URL = dokładnie `https://amico-apka.vercel.app`.
 Redirect URLs: bez wildcardów (`https://*`) i **bez `localhost`** w projekcie produkcyjnym.

`[ ]` **Custom SMTP** + rekordy **SPF/DKIM/DMARC** dla domeny nadawcy.
 Powód: domyślny SMTP Supabase nie jest produkcyjny (limity, dostarczalność, spoofing).

---

## 3. Supabase → ustawienia projektu

`[ ]` **Region projektu w UE** (np. `eu-central-1` / `eu-west-1`).
 Powód: dane osobowe klientów z Polski (RODO). **Jeśli projekt jest w US — to jest problem
 zgodności, nie tylko techniczny.** Migracja regionu = nowy projekt + przeniesienie danych;
 zaplanuj osobno.

`[ ]` **Database → Backups: PITR / codzienne kopie włączone.** Zrób próbne przywrócenie i zapisz
 wynik. Kopia, której nikt nie odtworzył, nie jest kopią.

`[ ]` **Database → Network Restrictions / Enforce SSL** — włącz, jeśli cokolwiek łączy się
 bezpośrednio do Postgresa (poza aplikacją przez API).

`[x]` **Advisors → Security: sprawdzone 2026-09-05 — 0 bledow.** Ostrzezenia przeanalizowane
 i opisane w `03-tests.md`; `amico_licz` naprawione (`search_path`). Performance advisors
 nadal warto przejrzec przy okazji.

`[ ]` **MFA na kontach zespołu w Supabase**, każdy ma własne konto (brak współdzielonego logowania).

---

## 4. Vercel

`[ ]` **Deployment Protection dla Preview = ON** (Vercel Authentication).
 Powód: preview deployments są publiczne pod losowym URL i łączą się z **produkcyjną** bazą.

`[ ]` Zmienne środowiskowe oznaczone jako **Sensitive**; osobne wartości dla `production`/`preview`.

`[ ]` **WAF / Firewall:** reguła rate limit na ścieżki logowania, ewentualnie Attack Challenge Mode.

`[ ]` Po deployu sprawdź nagłówki:
```bash
curl -sI https://amico-apka.vercel.app | grep -iE "content-security-policy|strict-transport|x-frame|x-content-type|referrer|permissions-policy|cross-origin"
```
Oczekiwane: CSP obecne, HSTS `max-age=31536000; includeSubDomains`, `X-Frame-Options: DENY`,
`X-Content-Type-Options: nosniff`.

`[ ]` **HSTS preload** — rozważ zgłoszenie domeny na hstspreload.org (dopiero gdy jesteś pewny HTTPS).

---

## 5. GitHub

`[ ]` Repozytorium **prywatne** (potwierdź; sprawdź też, czy kiedykolwiek było publiczne).
`[ ]` **Branch protection** na `main`: wymagany PR, brak force-push.
`[ ]` **Secret scanning** + **Dependabot** włączone.
`[ ]` Skan historii pod kątem sekretów:
```bash
gitleaks detect --source . --redact -v
```
Każde trafienie = **rotacja klucza**, nie samo usunięcie commita.

---

## 6. Procedury (spisz i trzymaj poza aplikacją)

`[ ]` **Offboarding pracownika:** Ustawienia → Użytkownicy → usuń dostęp. Działa **natychmiast**,
 nawet gdy osoba ma żywy token — wszystkie polityki sprawdzają członkostwo w bazie, nie w tokenie.
 Dodatkowo usuń konto w Supabase → Authentication → Users.

`[ ]` **Dodanie pracownika:** Supabase → Authentication → Users → Add user (e-mail + hasło),
 potem w aplikacji: Ustawienia → Użytkownicy → **Dostęp do firmy** → e-mail + rola.
 Samo założenie konta **nie daje** już wglądu w dane.

`[ ]` **Wyciek klucza / incydent:** rotacja kluczy w Supabase, wymuszenie wylogowania wszystkich,
 przegląd `amico_state_history` pod kątem podejrzanych zapisów, powiadomienie właściciela.

`[ ]` **Odtworzenie danych po pomyłce:** właściciel wywołuje `amico_historia_stanu(workspace)`
 (lista wersji) i `amico_przywroc_stan(workspace, id)`. Bieżąca wersja też trafia do archiwum,
 więc cofnięcie da się cofnąć.

`[ ]` **MFA** na: Supabase, Vercel, GitHub, rejestrze domeny, skrzynce pocztowej.
