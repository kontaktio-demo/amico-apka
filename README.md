# AMICO — System zarządzania Pracownią Kamieniarską

Aplikacja **PWA** (działa offline, instalowalna na tablecie/telefonie) dla firmy **Pracownia Kamieniarska AMICO** (blaty kamienne, granit / marmur / kwarc / spiek / Dekton — pomiar, produkcja, montaż).

## Co potrafi

- **Pulpit** — przegląd: lejek realizacji, kalendarz, klienci, należności.
- **Klienci CRM** — karta klienta (dane, osoba kontaktowa, historia, osoby projektu, status), akcje: zleć pomiar, wyślij ofertę, generuj umowę/zlecenie/protokół, mail/SMS. Zgoda RODO, PESEL opcjonalny/maskowany.
- **Oferty / Wyceny** — formularz „Wstępna wycena prac kamieniarskich" 1:1: pozycje, VAT per pozycja (8/23%), podsumowanie, warunki, standardowe uwagi, podpis klienta i firmy.
- **Umowy** — umowy o dzieło (8% / 23% / 8‑23% wg powierzchni BSPM), umowa prowizyjna, umowa współpracy (ekspozycja), oświadczenie — pełna treść prawna, kwota słownie, podpis odręczny na ekranie.
- **Faktury** — faktura VAT (elementy art. 106e), zaliczkowa/proforma, podsumowanie wg stawek, MPP, kwota słownie.
- **Protokoły / KP** — protokół odbioru, dowód KP (kasa przyjmie).
- **Zlecenia** — pipeline realizacji z checklistą etapów, powiązania z wyceną/umową/protokołem/fakturą.
- **Kalendarz** — pomiary, montaże, transporty.
- **Kontrahenci** — projektanci, stolarze, studia kuchenne, wykonawcy, deweloperzy, sprzedawcy, dostawcy (+ prowizje).
- **Produkty / Katalog** — materiały kamienne i usługi z cennikiem.
- **Ekspozycje** — ekspozycje kamienia u partnerów, śledzenie zobowiązania zakupowego (5‑krotność), rozliczenia.
- **Finanse** — raport kasowy, przelewy (walidacja NRB), obrót pieniężny.
- **Odprawa** — dzienna odprawa (montaże, pomiary, transport, rozliczenia, nowe umowy).
- **Ustawienia** — dwa podmioty (Amico Andrzej Fiks / Amico Milena Fiks), zespół, logo, klauzule, kopia zapasowa (eksport/import JSON), pamięć trwała.

**Wszędzie: DRUKUJ / PDF + WYŚLIJ.** Dane trzymane lokalnie na urządzeniu (offline, IndexedDB) + kopia zapasowa do pliku.

## Uruchomienie

```bash
npm install
npm run dev      # tryb deweloperski
npm run build    # build produkcyjny (dist/)
npm run preview  # podgląd builda
node scripts/gen-icons.mjs   # regeneracja ikon PWA
```

## Stos

React 18 · TypeScript · Vite · Tailwind CSS · Zustand · IndexedDB (idb-keyval) · vite-plugin-pwa · lucide-react · Fraunces + Inter.

## Prywatność / RODO

Dane klientów (w tym opcjonalny PESEL) przechowywane wyłącznie lokalnie na urządzeniu. Podpis składany odręcznie na ekranie zapisywany jako obraz z metadanymi (czas, urządzenie). Zalecane: włączenie pamięci trwałej i regularne kopie zapasowe (Ustawienia).
