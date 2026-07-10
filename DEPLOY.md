# Jak opublikować AMICO online (Vercel)

Aplikacja jest **gotowa i przetestowana** (build przechodzi, wszystkie ekrany działają).
Kod jest już zacommitowany w gicie w tym folderze (`amico-app`). Zostaje **jeden krok** — publikacja.

Nie zrobiłem tego automatycznie, bo publikacja wysyła na zewnątrz Wasze dane firmowe
(m.in. numery kont) — to decyzja, którą powinieneś świadomie zatwierdzić.

## Opcja A (zalecana) — GitHub → Vercel, auto‑aktualizacje

1. Utwórz **prywatne** repo na GitHub (w przeglądarce: https://github.com/new — nazwa np. `amico-app`, „Private").
2. W tym folderze uruchom (podmień `<user>`):
   ```bash
   git remote add origin https://github.com/<user>/amico-app.git
   git push -u origin master
   ```
3. Wejdź na https://vercel.com/new → „Import Git Repository" → wybierz `amico-app` → **Deploy**.
   Vercel sam wykryje Vite i zbuduje. Dostaniesz adres typu `amico-app-xxxx.vercel.app`
   (możesz podpiąć własną domenę, np. `app.amicco.pl`).

Od teraz każdy `git push` automatycznie aktualizuje aplikację online.

## Opcja B — bez GitHuba (Vercel CLI, jednorazowo)

```bash
npm i -g vercel
vercel login          # zaloguj się (przeglądarka)
vercel --prod         # w folderze amico-app → publikuje i zwraca link
```

## Instalacja na tablecie / telefonie (po publikacji)

- Wejdź pod adres z Vercela na tablecie.
- **iPad/iPhone**: przycisk „Udostępnij" → „Dodaj do ekranu początkowego".
- **Android**: menu przeglądarki → „Zainstaluj aplikację" (albo baner „Zainstaluj").
- Działa offline; dane są tylko na tym urządzeniu (rób kopię: Ustawienia → Kopia zapasowa).

## Uwaga o danych

Dane (klienci, umowy, podpisy) są przechowywane **lokalnie na urządzeniu** (offline).
Aby mieć te same dane na kilku urządzeniach, potrzebna byłaby chmura (etap 2 — mogę dodać Supabase).
