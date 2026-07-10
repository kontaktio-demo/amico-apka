// ============================================================================
// AMICO – model danych. Wszystko trzymane lokalnie (offline-first, IndexedDB).
// ============================================================================

export type ID = string
export type ISODate = string // 'YYYY-MM-DD'
export type ISODateTime = string

export type VatRate = 0 | 5 | 8 | 23
export type Unit = 'm²' | 'mb' | 'szt' | 'kpl' | 'usł' | 'h' | 'godz'

export interface Signature {
  dataUrl: string // PNG base64
  signedAt: ISODateTime
  signer: string // imie i nazwisko podpisujacego
  role?: string
  urzadzenie?: string // metadane dowodowe (user agent)
  dokumentId?: ID
}

// ---------- Podmiot (firma / Wykonawca) ----------
export interface Firma {
  id: ID
  nazwa: string // np. "Amico Andrzej Fiks"
  wlasciciel: string // np. "Andrzej Fiks"
  marka: string // "Pracownia Kamieniarska AMICO"
  nip: string
  regon?: string
  ulica: string
  kod: string
  miasto: string
  telefon: string
  email: string
  www?: string
  bank?: string
  konto?: string // NRB
  domyslnyVat: VatRate
  domyslna: boolean
  kolor?: string
}

// ---------- Uzytkownicy / logowanie ----------
export type Rola = 'wlasciciel' | 'kierownik' | 'biuro' | 'montazysta'

export interface Uzytkownik {
  id: ID
  imie: string
  email: string
  rola: Rola
  hasloHash: string
  salt: string
  pinHash?: string
  pinSalt?: string
  webauthnId?: string // base64url credential id (biometria/urzadzenie)
  kolor?: string
  aktywny: boolean
  utworzono: ISODateTime
}

// ---------- Osoby w zespole ----------
export interface Pracownik {
  id: ID
  imie: string
  rola: 'montaz' | 'pomiar' | 'biuro' | 'kierownik' | 'transport' | 'inny'
  telefon?: string
  aktywny: boolean
}

// ---------- Klient (CRM) ----------
export type KlientTyp = 'osoba' | 'firma'
export type PipelineEtap =
  | 'nowy'
  | 'kontakt'
  | 'wycena'
  | 'umowa'
  | 'pomiar'
  | 'produkcja'
  | 'montaz'
  | 'odbior'
  | 'zakonczone'
  | 'utracony'

export interface WpisHistorii {
  id: ID
  data: ISODateTime
  typ: 'notatka' | 'telefon' | 'email' | 'sms' | 'pomiar' | 'oferta' | 'umowa' | 'zlecenie' | 'protokol' | 'platnosc' | 'status'
  tresc: string
}

export interface OsobaKontaktowa {
  imieNazwisko?: string
  telefon?: string
  email?: string
}

export interface OsobyProjektu {
  projektantId?: ID
  stolarzId?: ID
  wykonawcaId?: ID
  koordynatorId?: ID
}

export interface Klient {
  id: ID
  typ: KlientTyp
  // osoba
  imie?: string
  nazwisko?: string
  pesel?: string
  // firma
  nazwaFirmy?: string
  nip?: string
  // wspolne
  telefon?: string
  email?: string
  ulica?: string
  kod?: string
  miasto?: string
  osobaKontaktowa?: OsobaKontaktowa
  osobyProjektu?: OsobyProjektu
  etap: PipelineEtap
  zrodlo?: string // skad przyszedl (polecenie, google, deweloper...)
  tagi: string[]
  daneDoPomiaru?: string
  dodatkoweInfo?: string
  zgodaRodo?: boolean
  zgodaRodoData?: ISODateTime
  historia: WpisHistorii[]
  utworzono: ISODateTime
  zaktualizowano: ISODateTime
}

// ---------- Kontrahenci (projektanci / stolarze / wykonawcy / deweloperzy / sprzedawcy) ----------
export type KontrahentTyp = 'projektant' | 'stolarz' | 'studio_kuchenne' | 'wykonawca' | 'deweloper' | 'sprzedawca' | 'dostawca'

export interface Prowizja {
  id: ID
  numerZlecenia?: string
  kwota: number
  zaKogo?: string
  dataNaliczenia?: ISODate
  dataWyplaty?: ISODate
  wyplacona: boolean
}

export interface Kontrahent {
  id: ID
  typ: KontrahentTyp
  nazwa: string // imie i nazwisko lub nazwa firmy
  firma?: string
  telefon?: string
  email?: string
  specjalizacja?: string
  branza?: string // dla wykonawcow (glazurnik, elektryk...)
  nip?: string
  adres?: string
  dataKontaktu?: ISODate
  stawkaProwizji?: number // %
  prowizje: Prowizja[]
  notatki?: string
  aktywny: boolean
  utworzono: ISODateTime
}

// ---------- Produkty / cennik ----------
export type ProduktKategoria =
  | 'granit'
  | 'marmur'
  | 'trawertyn'
  | 'onyks'
  | 'kwarc'
  | 'spiek'
  | 'dekton'
  | 'konglomerat'
  | 'usluga'
  | 'akcesorium'

export interface Produkt {
  id: ID
  nazwa: string
  kategoria: ProduktKategoria
  jednostka: Unit
  cenaNetto: number
  vat: VatRate
  opis?: string
  producent?: string
  kolor?: string
  grubosc?: string // np. "2/3 cm"
  aktywny: boolean
}

// ---------- Pozycja kosztorysowa (wspolna dla wyceny/faktury) ----------
export interface Pozycja {
  id: ID
  lp: number
  nazwa: string
  jednostka: Unit
  ilosc: number
  cenaNetto: number // za jednostke
  vat: VatRate
  rabat?: number // %
}

// ---------- Wycena (oferta) ----------
export type WycenaStatus = 'szkic' | 'wyslana' | 'zaakceptowana' | 'odrzucona' | 'zrealizowana'

export interface Wycena {
  id: ID
  numer: string
  firmaId: ID
  klientId?: ID
  // dane klienta (mozna wpisac recznie bez klienta w bazie)
  klientNazwa?: string
  klientAdres?: string
  klientTelefon?: string
  klientEmail?: string
  // miejsce realizacji
  miejsceAdres?: string
  miejscePietro?: string
  miejsceUwagi?: string
  zakresPrac?: string
  nazwaMaterialu?: string
  pozycje: Pozycja[]
  domyslnyVat: VatRate
  osobaFizyczna: boolean
  // warunki
  warunkiPlatnosci?: string
  zaliczka?: string
  doplata?: string
  waznosc?: ISODate
  uwagi?: string
  // przygotowanie pod montaz
  przygBlaty?: boolean
  przygWodaPrad?: boolean
  przygDojazd?: boolean
  przygInne?: string
  status: WycenaStatus
  podpisKlienta?: Signature
  podpisFirmy?: Signature
  zalaczniki: Zalacznik[]
  utworzono: ISODateTime
  zaktualizowano: ISODateTime
}

export interface Zalacznik {
  id: ID
  nazwa: string
  typ: string
  dataUrl?: string
  rozmiar?: number
}

// ---------- Umowy ----------
export type UmowaTyp =
  | 'dzielo_8'
  | 'dzielo_23'
  | 'dzielo_8_23'
  | 'prowizyjna'
  | 'wspolpracy'
  | 'oswiadczenie'

export type UmowaStatus = 'szkic' | 'do_podpisu' | 'podpisana' | 'anulowana'

export interface Umowa {
  id: ID
  numer: string
  typ: UmowaTyp
  firmaId: ID
  klientId?: ID
  zlecenieId?: ID
  wycenaId?: ID
  miejscowoscZawarcia?: string
  dataZawarcia?: ISODate
  // strona "Zamawiajacy"
  zamawiajacyNazwa?: string
  zamawiajacyAdres?: string
  zamawiajacyPesel?: string
  zamawiajacyNip?: string
  zamawiajacyTelefon?: string
  zamawiajacyEmail?: string
  // przedmiot
  adresRealizacji?: string
  przedmiot?: string
  powierzchniaM2?: string
  // terminy
  terminRozpoczecia?: ISODate
  terminZakonczenia?: ISODate
  terminUstawieniaMebli?: string
  // wynagrodzenie
  wynagrodzenieBrutto?: number
  zadatek?: number
  progPracDodatkowych?: number
  // pola specyficzne
  pola: Record<string, string> // elastyczne pola dla roznych szablonow
  status: UmowaStatus
  podpisZamawiajacego?: Signature
  podpisWykonawcy?: Signature
  zalaczniki: Zalacznik[]
  utworzono: ISODateTime
  zaktualizowano: ISODateTime
}

// ---------- Zlecenie (projekt / realizacja) ----------
export interface EtapZlecenia {
  klucz: PipelineEtap
  nazwa: string
  zrobione: boolean
  data?: ISODate
}

export interface Zlecenie {
  id: ID
  numer: string
  firmaId: ID
  klientId?: ID
  tytul: string
  adres?: string
  osoby: OsobyProjektu
  etap: PipelineEtap
  etapy: EtapZlecenia[]
  wartoscNetto?: number
  wartoscBrutto?: number
  wycenaId?: ID
  umowaId?: ID
  protokolId?: ID
  fakturaId?: ID
  dataPomiaru?: ISODate
  dataMontazu?: ISODate
  notatki?: string
  utworzono: ISODateTime
  zaktualizowano: ISODateTime
}

// ---------- Protokol odbioru ----------
export interface Protokol {
  id: ID
  numer: string
  firmaId: ID
  klientId?: ID
  zlecenieId?: ID
  klientNazwa?: string
  klientAdres?: string
  klientTelefon?: string
  numerZamowienia?: string
  data?: ISODate
  odebraneElementy?: string
  uwagi?: string
  podpisKlienta?: Signature
  utworzono: ISODateTime
}

// ---------- KP (Kasa Przyjmie) ----------
export interface KP {
  id: ID
  numer: string
  firmaId: ID
  klientId?: ID
  data: ISODate
  odKogo?: string
  kwota: number
  tytul?: string
  slownie?: string
  podpisPrzyjmujacy?: Signature
  utworzono: ISODateTime
}

// ---------- Faktura ----------
export type FakturaTyp = 'vat' | 'zaliczkowa' | 'koncowa' | 'proforma'
export type FakturaStatus = 'szkic' | 'wystawiona' | 'oplacona' | 'zaległa'

export interface Faktura {
  id: ID
  numer: string
  typ: FakturaTyp
  firmaId: ID
  klientId?: ID
  nabywcaNazwa?: string
  nabywcaNip?: string
  nabywcaAdres?: string
  dataWystawienia: ISODate
  dataSprzedazy?: ISODate
  terminPlatnosci?: ISODate
  sposobPlatnosci?: 'przelew' | 'gotowka' | 'karta'
  konto?: string
  splitPayment?: boolean
  pozycje: Pozycja[]
  zaplacono?: number
  uwagi?: string
  status: FakturaStatus
  utworzono: ISODateTime
}

// ---------- Kalendarz ----------
export type WydarzenieTyp = 'pomiar' | 'montaz' | 'transport' | 'spotkanie' | 'odbior' | 'inne'
export interface Wydarzenie {
  id: ID
  data: ISODate
  godzina?: string
  typ: WydarzenieTyp
  tytul: string
  klientId?: ID
  zlecenieId?: ID
  pracownikId?: ID
  adres?: string
  notatki?: string
  zrobione: boolean
}

// ---------- Finanse ----------
export interface ObrotPozycja {
  id: ID
  data: ISODate
  przychod?: number
  rozchod?: number
  zaCo: string
  kto?: string
  firmaId?: ID
}

export interface RaportKasowyRow {
  id: ID
  nazwisko?: string
  zlec?: string
  tresc?: string
  przychod?: number
  rozchod?: number
}
export interface RaportKasowy {
  id: ID
  numer: string
  firmaId: ID
  od: ISODate
  do: ISODate
  saldoPoczatkowe: number
  wiersze: RaportKasowyRow[]
  data?: ISODate
  podpis?: Signature
  utworzono: ISODateTime
}

export interface Przelew {
  id: ID
  firmaId: ID
  odbiorca: string
  konto: string
  tytul: string
  kwota: number
  data: ISODate
  status: 'do_zaplaty' | 'zaplacony'
  splitPayment?: boolean
}

// ---------- Ekspozycje kamienia ----------
export interface RozliczenieEkspozycji {
  id: ID
  data?: ISODate
  numerZlecenia?: string
  nazwiskoKlienta?: string
  kwotaNetto: number
}
export interface Ekspozycja {
  id: ID
  numer: string
  firmaId: ID
  sprzedawcaId?: ID
  nazwaFirmy?: string
  dataPodpisania?: ISODate
  dataDo?: ISODate
  numerZlecenia?: string
  wartoscNetto: number
  wartoscBrutto: number
  krotnosc: number // domyslnie 5
  wartoscPrac: number
  rozliczenia: RozliczenieEkspozycji[]
  dokumentacja: Zalacznik[]
  utworzono: ISODateTime
}

// ---------- Odprawa (dzienna) ----------
export interface OdprawaSekcja {
  klucz: string
  tytul: string
  pozycje: string[]
}
export interface Odprawa {
  id: ID
  data: ISODate
  sekcje: OdprawaSekcja[]
  utworzono: ISODateTime
}

// ---------- Zadania (przypisywanie pracy) ----------
export type ZadanieStatus = 'do_zrobienia' | 'w_trakcie' | 'zrobione'
export type ZadaniePriorytet = 'niski' | 'sredni' | 'wysoki'
export interface Zadanie {
  id: ID
  tytul: string
  opis?: string
  przypisanyDo?: ID // pracownikId lub uzytkownikId
  klientId?: ID
  zlecenieId?: ID
  termin?: ISODate
  godzina?: string
  priorytet: ZadaniePriorytet
  status: ZadanieStatus
  utworzono: ISODateTime
  zaktualizowano: ISODateTime
}

// ---------- Skany / dokumenty (skaner PDF) ----------
export type SkanKategoria = 'umowa' | 'protokol' | 'faktura' | 'pomiar' | 'projekt' | 'kosztorys' | 'zdjecie' | 'inne'
export interface Skan {
  id: ID
  nazwa: string
  kategoria: SkanKategoria
  strony: string[] // JPEG dataURL – kolejne strony/kartki po skanie i obróbce
  zlecenieId?: ID
  klientId?: ID
  notatka?: string
  utworzono: ISODateTime
}

// ---------- Ustawienia ----------
export interface Ustawienia {
  aktywnaFirmaId: ID
  logoDataUrl?: string
  numeracja: Record<string, number> // liczniki numeracji dokumentow wg roku
  standardoweUwagiWyceny: string[]
  klauzulaRodo: string
  klauzulaPodpis: string
  motyw: 'jasny'
}

// ---------- Baza (root) ----------
export interface Baza {
  wersja: number
  firmy: Firma[]
  uzytkownicy: Uzytkownik[]
  pracownicy: Pracownik[]
  klienci: Klient[]
  kontrahenci: Kontrahent[]
  produkty: Produkt[]
  wyceny: Wycena[]
  umowy: Umowa[]
  zlecenia: Zlecenie[]
  protokoly: Protokol[]
  kp: KP[]
  faktury: Faktura[]
  wydarzenia: Wydarzenie[]
  obrot: ObrotPozycja[]
  raportyKasowe: RaportKasowy[]
  przelewy: Przelew[]
  ekspozycje: Ekspozycja[]
  odprawy: Odprawa[]
  zadania: Zadanie[]
  skany: Skan[]
  ustawienia: Ustawienia
}
