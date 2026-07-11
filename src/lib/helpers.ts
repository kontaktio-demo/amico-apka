import type { Klient, Kontrahent, KontrahentTyp, PipelineEtap, Zlecenie, WycenaStatus, UmowaStatus } from './types'

export function klientNazwa(k?: Klient | null): string {
  if (!k) return '–'
  if (k.typ === 'firma') return k.nazwaFirmy || 'Firma bez nazwy'
  return [k.imie, k.nazwisko].filter(Boolean).join(' ') || 'Klient bez nazwy'
}
export function klientAdres(k?: Klient | null): string {
  if (!k) return ''
  return [k.ulica, [k.kod, k.miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ')
}

export const PIPELINE: { klucz: PipelineEtap; nazwa: string; tone: string }[] = [
  { klucz: 'nowy', nazwa: 'Nowy', tone: 'stone' },
  { klucz: 'kontakt', nazwa: 'Kontakt', tone: 'blue' },
  { klucz: 'wycena', nazwa: 'Wycena', tone: 'blue' },
  { klucz: 'umowa', nazwa: 'Umowa', tone: 'amber' },
  { klucz: 'pomiar', nazwa: 'Pomiar', tone: 'amber' },
  { klucz: 'produkcja', nazwa: 'Produkcja', tone: 'amber' },
  { klucz: 'montaz', nazwa: 'Montaż', tone: 'amber' },
  { klucz: 'odbior', nazwa: 'Odbiór', tone: 'green' },
  { klucz: 'zakonczone', nazwa: 'Zakończone', tone: 'green' },
  { klucz: 'utracony', nazwa: 'Utracony', tone: 'red' },
]
export function etapInfo(e: PipelineEtap) {
  return PIPELINE.find((p) => p.klucz === e) || PIPELINE[0]
}

export function domyslneEtapyZlecenia(): Zlecenie['etapy'] {
  return [
    { klucz: 'kontakt', nazwa: 'Kontakt / zapytanie', zrobione: false },
    { klucz: 'wycena', nazwa: 'Wycena wstępna', zrobione: false },
    { klucz: 'umowa', nazwa: 'Umowa i zadatek', zrobione: false },
    { klucz: 'pomiar', nazwa: 'Pomiar z natury', zrobione: false },
    { klucz: 'produkcja', nazwa: 'Produkcja / obróbka', zrobione: false },
    { klucz: 'montaz', nazwa: 'Transport i montaż', zrobione: false },
    { klucz: 'odbior', nazwa: 'Protokół odbioru', zrobione: false },
    { klucz: 'zakonczone', nazwa: 'Rozliczenie / zakończenie', zrobione: false },
  ]
}

export const KONTRAHENT_TYPY: { typ: KontrahentTyp; nazwa: string; lm: string }[] = [
  { typ: 'projektant', nazwa: 'Projektant', lm: 'Projektanci' },
  { typ: 'stolarz', nazwa: 'Stolarz', lm: 'Stolarze' },
  { typ: 'studio_kuchenne', nazwa: 'Studio kuchenne', lm: 'Studia kuchenne' },
  { typ: 'wykonawca', nazwa: 'Wykonawca', lm: 'Wykonawcy' },
  { typ: 'deweloper', nazwa: 'Deweloper', lm: 'Deweloperzy' },
  { typ: 'sprzedawca', nazwa: 'Sprzedawca / partner', lm: 'Sprzedawcy' },
  { typ: 'dostawca', nazwa: 'Dostawca / hurtownia', lm: 'Dostawcy' },
]
export function kontrahentTypNazwa(t: KontrahentTyp): string {
  return KONTRAHENT_TYPY.find((x) => x.typ === t)?.nazwa || t
}

export function wycenaStatusInfo(s: WycenaStatus): { label: string; tone: string } {
  return (
    {
      szkic: { label: 'Szkic', tone: 'stone' },
      wyslana: { label: 'Wysłana', tone: 'blue' },
      zaakceptowana: { label: 'Zaakceptowana', tone: 'green' },
      odrzucona: { label: 'Odrzucona', tone: 'red' },
      zrealizowana: { label: 'Zrealizowana', tone: 'green' },
    } as const
  )[s]
}
export function umowaStatusInfo(s: UmowaStatus): { label: string; tone: string } {
  return (
    {
      szkic: { label: 'Szkic', tone: 'stone' },
      do_podpisu: { label: 'Do podpisu', tone: 'amber' },
      podpisana: { label: 'Podpisana', tone: 'green' },
      anulowana: { label: 'Anulowana', tone: 'red' },
    } as const
  )[s]
}

export const UMOWA_TYPY: { typ: string; nazwa: string; opis: string }[] = [
  { typ: 'dzielo_23', nazwa: 'Umowa o dzieło – 23% VAT', opis: 'Osoba fizyczna, standardowa stawka VAT' },
  { typ: 'dzielo_8', nazwa: 'Umowa o dzieło – 8% VAT', opis: 'Budownictwo objęte społecznym programem mieszkaniowym' },
  { typ: 'dzielo_8_23', nazwa: 'Umowa o dzieło – 8/23% VAT', opis: 'Proporcja wg powierzchni (limit 300/150 m²)' },
  { typ: 'wspolpracy', nazwa: 'Umowa współpracy ze sprzedawcą', opis: 'Ekspozycja kamienia, zobowiązanie zakupowe' },
  { typ: 'prowizyjna', nazwa: 'Umowa prowizyjna', opis: 'Pozyskiwanie klientów, prowizja 10%' },
  { typ: 'oswiadczenie', nazwa: 'Oświadczenie klienta', opis: 'Akceptacja właściwości kamienia naturalnego' },
]
