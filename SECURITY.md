# Bezpieczeństwo AMICO — zasady dla każdego, kto dotyka tego kodu

## Model w jednym zdaniu

Aplikacja to SPA bez serwera, więc **przeglądarka i cała jej zawartość są niezaufane**.
Jedyną granicą bezpieczeństwa jest Postgres (RLS + funkcje RPC) i Supabase Auth.
Każda kontrola zrobiona wyłącznie w Reakcie jest kosmetyką.

## Żelazne zasady

1. **Nigdy nie wyłączaj RLS**, żeby coś zadziałało. Jeśli zapytanie nie zwraca danych, błąd jest
   w polityce albo w członkostwie — nie w RLS.
2. **Nigdy nie wprowadzaj klucza `service_role` / `sb_secret_` do aplikacji.** Nie ma serwera,
   w którym mógłby być bezpieczny — trafiłby do bundla, czyli do rąk użytkownika.
3. **Uprawnienia sprawdzaj w bazie.** Ukrycie przycisku nie jest kontrolą dostępu.
4. **Rola nigdy z `user_metadata`** (użytkownik zmienia je sam przez `auth.updateUser`).
   Źródłem prawdy jest `amico_members.rola`.
5. **Każda nowa tabela:** `enable row level security` + polityki per operacja
   (`select`/`insert`/`update`/`delete`) + `with check` przy zapisach + `revoke all … from anon`.
6. **Każda nowa funkcja `SECURITY DEFINER`:** `set search_path = public`, sprawdzenie
   `auth.uid()` i roli w środku, `revoke … from public, anon`, `grant execute to authenticated`.
7. **Nie kasuj twardo danych firmy.** Używaj miękkiego usuwania. `amico_state_history` jest
   jedyną siatką bezpieczeństwa przy pomyłce.

## Dodanie nowej osoby do firmy

1. Supabase → Authentication → Users → **Add user** (e-mail + hasło).
2. W aplikacji: Ustawienia → Użytkownicy → **Dostęp do firmy** → e-mail + rola.

Samo konto **nie daje** dostępu do danych. Nie ma kodów dołączenia ani samoobsługi —
to była realna luka i została zamknięta.

## Odejście pracownika

Ustawienia → Użytkownicy → usuń dostęp. Działa **natychmiast**, nawet gdy osoba ma otwartą
aplikację z ważnym tokenem, bo polityki sprawdzają członkostwo w tabeli, a nie rolę w tokenie.
Następnie usuń konto w Supabase → Authentication → Users.

## Gdy dane zniknęły albo ktoś je zepsuł

Jako właściciel:

```sql
select * from amico_historia_stanu('<workspace>');      -- lista wersji
select amico_przywroc_stan('<workspace>', <id>);        -- przywrócenie
```

Bieżąca wersja też trafia do archiwum, więc przywrócenie da się cofnąć.

## Gdy zapis jest odrzucany komunikatem o masowym usunięciu

To zadziałało zabezpieczenie. Sprawdź, czy usunięcie jest zamierzone. Jeśli tak — właściciel
używa `amico_wymus_zapis(...)`. **Nie obchodź tego, wyłączając blokadę.**

## Pliki

| Plik | Zawartość |
|---|---|
| `supabase/amico-twierdza.sql` | hartowanie bazy; idempotentne, uruchamiaj po każdej zmianie schematu |
| `SECURITY/00-recon.md` | mapa systemu, wersje, powierzchnia ataku |
| `SECURITY/01-audit.md` | findingi, dowody, co było nie tak |
| `SECURITY/02-fixes.md` | co i gdzie naprawiono |
| `SECURITY/03-tests.md` | testy wykonane i testy do wykonania na bazie |
| `SECURITY/MANUAL_STEPS.md` | ustawienia w panelach (Supabase, Vercel, GitHub) |
| `SECURITY/decyzje.md` | dlaczego coś zrobiono tak, a nie inaczej |
