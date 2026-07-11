import type { Baza, Firma, Pracownik, Produkt, Ustawienia } from './types'
import { nowISO } from './format'
import { uid } from './id'

// ---------- Podmioty AMICO (z dokumentow zrodlowych) ----------
const firmaAndrzej: Firma = {
  id: 'firma_andrzej',
  nazwa: 'Amico Andrzej Fiks',
  wlasciciel: 'Andrzej Fiks',
  marka: 'Pracownia Kamieniarska AMICO',
  nip: '7281747667',
  ulica: 'ul. Brzezińska 84',
  kod: '95-020',
  miasto: 'Bedoń Wieś k/Łodzi',
  telefon: '795 040 609',
  email: 'biuro@amicco.pl',
  www: 'amico.kontaktio.pl',
  bank: 'ING Bank Śląski',
  konto: '19105014611000009250678415',
  domyslnyVat: 23,
  domyslna: true,
  kolor: '#0f5c3f',
}
const firmaMilena: Firma = {
  id: 'firma_milena',
  nazwa: 'Amico Milena Fiks',
  wlasciciel: 'Milena Fiks',
  marka: 'Pracownia Kamieniarska AMICO',
  nip: '9710504453',
  ulica: 'ul. Brzezińska 84',
  kod: '95-020',
  miasto: 'Bedoń Wieś k/Łodzi',
  telefon: '795 040 609',
  email: 'biuro@amicco.pl',
  www: 'amico.kontaktio.pl',
  bank: 'Bank',
  konto: '55195000012006072044630002',
  domyslnyVat: 8,
  domyslna: false,
  kolor: '#166b45',
}

const pracownicy: Pracownik[] = [
  { id: uid('pr'), imie: 'Ciastki', rola: 'montaz', aktywny: true },
  { id: uid('pr'), imie: 'Bogdan', rola: 'montaz', aktywny: true },
  { id: uid('pr'), imie: 'Sasza', rola: 'montaz', aktywny: true },
  { id: uid('pr'), imie: 'Biuro AMICO', rola: 'biuro', aktywny: true },
]

// ---------- Katalog materialow i uslug ----------
const P = (nazwa: string, kategoria: Produkt['kategoria'], jednostka: Produkt['jednostka'], cenaNetto: number, vat: Produkt['vat'], extra: Partial<Produkt> = {}): Produkt => ({
  id: uid('prod'),
  nazwa,
  kategoria,
  jednostka,
  cenaNetto,
  vat,
  aktywny: true,
  ...extra,
})

const produkty: Produkt[] = [
  // Uslugi (domyslne pozycje z wyceny)
  P('Kamień (materiał)', 'usluga', 'm²', 0, 23, { opis: 'Wartość płyty wg wybranego materiału' }),
  P('Obróbki kamieniarskie', 'usluga', 'mb', 0, 23),
  P('Pomiar z natury / wykonanie szablonów', 'usluga', 'usł', 0, 23),
  P('Montaż', 'usluga', 'usł', 0, 23),
  P('Transport', 'usluga', 'usł', 0, 23),
  P('Zlew podblatowy – montaż', 'usluga', 'szt', 0, 23),
  P('Wycięcie pod płytę grzewczą', 'usluga', 'szt', 0, 23),
  P('Impregnacja kamienia', 'usluga', 'm²', 0, 23),
  // Granity
  P('Granit Nero Assoluto', 'granit', 'm²', 0, 23, { grubosc: '2/3 cm', kolor: 'czarny' }),
  P('Granit Steel Grey', 'granit', 'm²', 0, 23, { grubosc: '2/3 cm', kolor: 'szary' }),
  P('Granit Bianco Cristal', 'granit', 'm²', 0, 23, { grubosc: '2/3 cm', kolor: 'biały' }),
  // Marmury
  P('Marmur Calacatta', 'marmur', 'm²', 0, 23, { grubosc: '2 cm', kolor: 'biały' }),
  P('Marmur Bianco Carrara', 'marmur', 'm²', 0, 23, { grubosc: '2 cm', kolor: 'biało-szary' }),
  // Konglomeraty kwarcowe
  P('Silestone (kwarc)', 'konglomerat', 'm²', 0, 23, { producent: 'Cosentino', grubosc: '2 cm' }),
  P('Technistone (kwarc)', 'konglomerat', 'm²', 0, 23, { grubosc: '2 cm' }),
  P('Caesarstone (kwarc)', 'konglomerat', 'm²', 0, 23, { grubosc: '2 cm' }),
  // Spieki
  P('Laminam (spiek)', 'spiek', 'm²', 0, 23, { producent: 'Laminam', grubosc: '12 mm' }),
  P('Neolith (spiek)', 'spiek', 'm²', 0, 23, { producent: 'Neolith', grubosc: '12 mm' }),
  // Dekton
  P('Dekton', 'dekton', 'm²', 0, 23, { producent: 'Cosentino', grubosc: '20 mm' }),
  // Trawertyn / onyks
  P('Trawertyn', 'trawertyn', 'm²', 0, 23),
  P('Onyks (podświetlany)', 'onyks', 'm²', 0, 23),
  // Akcesoria
  P('Zlew granitowy podwieszany', 'akcesorium', 'szt', 0, 23),
  P('Klej / silikon kamieniarski', 'akcesorium', 'szt', 0, 23),
]

// ---------- Klauzule / teksty ----------
const KLAUZULA_RODO =
  'Administratorem danych osobowych jest Pracownia Kamieniarska AMICO (ul. Brzezińska 84, 95-020 Bedoń Wieś, e-mail: biuro@amicco.pl). Dane przetwarzane są w celu przygotowania oferty, zawarcia i realizacji umowy oraz wystawienia dokumentów księgowych (art. 6 ust. 1 lit. b i c RODO). Podanie danych jest dobrowolne, lecz niezbędne do realizacji zamówienia. Mają Państwo prawo dostępu do danych, ich sprostowania, usunięcia oraz ograniczenia przetwarzania. Dane przechowywane są przez okres realizacji umowy oraz przez okres wymagany przepisami prawa (m.in. podatkowymi).'

const KLAUZULA_PODPIS =
  'Dokument został podpisany elektronicznie na urządzeniu dotykowym w obecności przedstawiciela AMICO. Złożenie podpisu jest potwierdzeniem zapoznania się z treścią dokumentu i jej akceptacji. Podpis wraz z datą i godziną złożenia stanowi integralną część dokumentu.'

const STANDARDOWE_UWAGI = [
  'Zgłoszenie gotowości do wykonania pomiaru do cięcia drogą mailową na adres biuro@amicco.pl lub SMS na numer 795 040 609.',
  'Za każdy nieuzasadniony przyjazd ekipy montażowej i brak możliwości wykonania pomiarów – opłata dodatkowa 200 zł netto + VAT.',
  'Na pomiarze musi być osoba decyzyjna do uzgodnień – warunek konieczny.',
  'Muszą być zakupione wszystkie akcesoria typu: zlew, bateria, dozownik, płyta grzewcza, gniazda nablatowe, okap.',
  'Kamieniarze nie podłączają zlewu hydraulicznie, ani płyty grzewczej elektrycznie. Mocują akcesoria do kamienia.',
  'Ledy i oświetlenie instaluje elektryk lub stolarz.',
  'Wycena będzie skorygowana po obmiarze z natury.',
]

const ustawienia: Ustawienia = {
  aktywnaFirmaId: firmaAndrzej.id,
  numeracja: {},
  standardoweUwagiWyceny: STANDARDOWE_UWAGI,
  klauzulaRodo: KLAUZULA_RODO,
  klauzulaPodpis: KLAUZULA_PODPIS,
  motyw: 'jasny',
}

export function pustaBaza(): Baza {
  return {
    wersja: 1,
    usuniete: [],
    firmy: [firmaAndrzej, firmaMilena],
    uzytkownicy: [],
    pracownicy,
    klienci: [],
    kontrahenci: [],
    produkty,
    wyceny: [],
    umowy: [],
    zlecenia: [],
    protokoly: [],
    kp: [],
    faktury: [],
    wydarzenia: [],
    obrot: [],
    raportyKasowe: [],
    przelewy: [],
    ekspozycje: [],
    odprawy: [],
    zadania: [],
    skany: [],
    ustawienia,
  }
}

// Przykladowe dane demonstracyjne (mozna wyczyscic w Ustawieniach)
export function bazaDemo(): Baza {
  const b = pustaBaza()
  const now = nowISO()
  b.klienci.push({
    id: uid('kl'),
    typ: 'osoba',
    imie: 'Anna',
    nazwisko: 'Kowalska',
    telefon: '600 100 200',
    email: 'anna.kowalska@example.com',
    ulica: 'ul. Piotrkowska 100',
    kod: '90-001',
    miasto: 'Łódź',
    etap: 'wycena',
    zrodlo: 'Polecenie',
    tagi: ['blat kuchenny', 'granit'],
    zgodaRodo: true,
    zgodaRodoData: now,
    historia: [
      { id: uid('h'), data: now, typ: 'notatka', tresc: 'Zapytanie o blat kuchenny z granitu, ok. 4 mb.' },
      { id: uid('h'), data: now, typ: 'pomiar', tresc: 'Umówiony pomiar z natury.' },
    ],
    utworzono: now,
    zaktualizowano: now,
  })
  return b
}
