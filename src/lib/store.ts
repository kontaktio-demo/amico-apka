import { create } from 'zustand'
import type { Baza, Firma } from './types'
import { loadBaza, saveBaza, clearBaza } from './db'
import { pustaBaza } from './seed'
import { nowISO } from './format'

// Kolekcje bedace tablicami obiektow z polem id
type ArrKeys = {
  [K in keyof Baza]: Baza[K] extends Array<{ id: string }> ? K : never
}[keyof Baza]

type ArrItem<K extends ArrKeys> = Baza[K] extends Array<infer T> ? T : never

interface AppState {
  baza: Baza
  hydrated: boolean
  bladZapisu: string | null // blad zapisu lokalnego (np. brak miejsca)
  init: () => Promise<void>
  persist: () => void
  setBaza: (b: Baza) => void
  zastapBaze: (b: Baza) => void // podmiana bazy z chmury (bez ponownego wypychania)
  // Generyczne CRUD dla kolekcji
  upsert: <K extends ArrKeys>(key: K, item: ArrItem<K>) => void
  remove: <K extends ArrKeys>(key: K, id: string) => void
  patch: (fn: (b: Baza) => void) => void
  // Ustawienia / firmy
  updateUstawienia: (p: Partial<Baza['ustawienia']>) => void
  aktywnaFirma: () => Firma
  setAktywnaFirma: (id: string) => void
  // Numeracja dokumentow (ciagla per rok)
  podgladNumeru: (prefix: string) => string
  kolejnyNumer: (prefix: string) => string
  // Zarzadzanie danymi
  eksportJSON: () => string
  importJSON: (json: string) => boolean
  wyczyscWszystko: () => Promise<void>
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

// Numeracja dokumentow jest osobna dla KAZDEGO podmiotu (firma_andrzej / firma_milena),
// bo kazdy podatnik prowadzi wlasna, ciagla serie faktur. Wspolny licznik robilby
// dziury w seriach obu firm.
function numerKey(s: AppState, prefix: string, rok: number): string {
  const firmaId = s.aktywnaFirma().id
  return `${firmaId}-${prefix}-${rok}`
}
// Stan licznika dla klucza. Jesli klucza per-firma jeszcze nie ma, ale istnieje stary
// klucz globalny (sprzed rozdzielenia na podmioty) - dziedziczymy z niego, zeby nie
// cofnac istniejacej serii.
function stanLicznika(s: AppState, key: string, prefix: string, rok: number): number {
  const num = s.baza.ustawienia.numeracja
  if (num[key] != null) return num[key]
  const stary = num[`${prefix}-${rok}`]
  return stary != null ? stary : 0
}
// Najwyzszy numer JUZ uzyty przez istniejacy dokument danego prefiksu/roku/firmy.
// Dzieki temu, gdy dwa urzadzenia offline nadadza ten sam numer, po scaleniu kolejny
// numer "przeskoczy" duplikat zamiast tworzyc go po raz kolejny.
function maxUzytyNumer(s: AppState, prefix: string, rok: number, firmaId: string): number {
  const re = new RegExp('^' + prefix + '\\s+(\\d+)/' + rok + '$')
  const kolekcje: any[][] = [
    s.baza.wyceny,
    s.baza.umowy,
    s.baza.zlecenia,
    s.baza.faktury,
    s.baza.protokoly,
    s.baza.kp,
    s.baza.raportyKasowe,
    s.baza.ekspozycje,
  ]
  let max = 0
  for (const kol of kolekcje) {
    if (!kol) continue
    for (const r of kol) {
      if (!r || r.firmaId !== firmaId) continue
      const m = re.exec(r.numer || '')
      if (m) {
        const n = Number(m[1])
        if (n > max) max = n
      }
    }
  }
  return max
}

export const useStore = create<AppState>((setState, getState) => ({
  baza: pustaBaza(),
  hydrated: false,
  bladZapisu: null,

  init: async () => {
    const zapisana = await loadBaza()
    if (zapisana && zapisana.firmy?.length) {
      setState({ baza: migruj(zapisana), hydrated: true })
    } else {
      // Start bez danych demo - demo mozna wczytac recznie w Ustawieniach.
      // (Losowe rekordy demo powodowalyby duplikaty po synchronizacji.)
      const pusta = pustaBaza()
      setState({ baza: pusta, hydrated: true })
      await saveBaza(pusta)
    }
  },

  persist: () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveBaza(getState().baza)
        .then(() => {
          if (getState().bladZapisu) setState({ bladZapisu: null })
        })
        .catch((e) => {
          // np. QuotaExceededError - uzytkownik MUSI o tym wiedziec
          setState({
            bladZapisu:
              e?.name === 'QuotaExceededError'
                ? 'Brak miejsca na urządzeniu - zrób kopię i usuń stare skany.'
                : 'Nie udało się zapisać danych lokalnie.',
          })
        })
    }, 250)
  },

  setBaza: (b) => {
    setState({ baza: b })
    getState().persist()
  },

  upsert: (key, item) => {
    // znacznik zmiany - potrzebny do bezpiecznego scalania miedzy urzadzeniami
    const stamped: any = { ...(item as any), _zm: nowISO() }
    setState((s) => {
      const arr = s.baza[key] as any[]
      const idx = arr.findIndex((x) => x.id === stamped.id)
      const next = idx >= 0 ? arr.map((x) => (x.id === stamped.id ? stamped : x)) : [...arr, stamped]
      return { baza: { ...s.baza, [key]: next } }
    })
    getState().persist()
  },

  remove: (key, id) => {
    setState((s) => {
      const arr = s.baza[key] as any[]
      const usuniete = [
        ...(s.baza.usuniete || []).filter((t) => !(t.k === key && t.id === id)),
        { k: String(key), id, t: nowISO() },
      ]
      return { baza: { ...s.baza, [key]: arr.filter((x) => x.id !== id), usuniete } }
    })
    getState().persist()
  },

  zastapBaze: (b) => {
    // migruj - dane z chmury moga pochodzic z innej wersji aplikacji
    const m = migruj(b)
    setState({ baza: m })
    saveBaza(m).catch((e) => {
      setState({
        bladZapisu:
          e?.name === 'QuotaExceededError' ? 'Brak miejsca na urządzeniu.' : 'Nie udało się zapisać danych lokalnie.',
      })
    })
  },

  patch: (fn) => {
    setState((s) => {
      const copy: Baza = structuredClone(s.baza)
      fn(copy)
      return { baza: copy }
    })
    getState().persist()
  },

  updateUstawienia: (p) => {
    setState((s) => ({ baza: { ...s.baza, ustawienia: { ...s.baza.ustawienia, ...p, _zm: nowISO() } as any } }))
    getState().persist()
  },

  aktywnaFirma: () => {
    const b = getState().baza
    return b.firmy.find((f) => f.id === b.ustawienia.aktywnaFirmaId) || b.firmy[0]
  },

  setAktywnaFirma: (id) => {
    getState().updateUstawienia({ aktywnaFirmaId: id })
  },

  // Podglad nastepnego numeru BEZ zuzywania licznika.
  // Formularz pokazuje numer od razu, ale dopoki dokument nie zostanie zapisany,
  // numer nie jest "spalony" - inaczej otwarcie i anulowanie nowej faktury
  // robilo trwala dziure w numeracji (a ta musi byc ciagla).
  podgladNumeru: (prefix) => {
    const rok = new Date().getFullYear()
    const st = getState()
    const key = numerKey(st, prefix, rok)
    const firmaId = st.aktywnaFirma().id
    const kolejny = Math.max(stanLicznika(st, key, prefix, rok), maxUzytyNumer(st, prefix, rok, firmaId)) + 1
    return `${prefix} ${kolejny}/${rok}`
  },

  kolejnyNumer: (prefix) => {
    const rok = new Date().getFullYear()
    const s = getState()
    const key = numerKey(s, prefix, rok)
    const firmaId = s.aktywnaFirma().id
    // Bierzemy wyzsza z dwoch wartosci: licznika i realnie uzytego numeru - to eliminuje
    // duplikaty numerow powstale przy pracy offline na dwoch urzadzeniach.
    const kolejny = Math.max(stanLicznika(s, key, prefix, rok), maxUzytyNumer(s, prefix, rok, firmaId)) + 1
    setState((st) => ({
      baza: {
        ...st.baza,
        // _zm jest KONIECZNE - bez niego scalanie mogloby cofnac licznik i wygenerowac duplikaty numerow
        ustawienia: {
          ...st.baza.ustawienia,
          numeracja: { ...st.baza.ustawienia.numeracja, [key]: kolejny },
          _zm: nowISO(),
        } as any,
      },
    }))
    getState().persist()
    return `${prefix} ${kolejny}/${rok}`
  },

  // Kopia zapasowa to PELNA kopia do przeniesienia na inne urzadzenie - MUSI zawierac
  // dane logowania (hash hasla/PIN, nie samo haslo), bo inaczej po wczytaniu na nowym
  // urzadzeniu nie dalo by sie w ogole zalogowac. To hasze PBKDF2, nie jawne hasla;
  // plik kopii trzymaj przy sobie (pendrive), a nie wysylaj obcym.
  eksportJSON: () => JSON.stringify(getState().baza, null, 2),

  importJSON: (json) => {
    try {
      const parsed = JSON.parse(json) as Baza
      if (!parsed.firmy || !Array.isArray(parsed.firmy)) return false
      // Jesli w kopii ktoregos konta brakowaloby danych logowania (np. starsza kopia
      // bez sekretow), odtwarzamy je z biezacej bazy, zeby dalo sie dalej wejsc.
      const sekrety = new Map(getState().baza.uzytkownicy.map((u) => [u.id, u]))
      const scalone = {
        ...parsed,
        uzytkownicy: (parsed.uzytkownicy || []).map((u: any) => {
          const l: any = sekrety.get(u.id)
          if (!l) return u
          return {
            ...u,
            hasloHash: u.hasloHash || l.hasloHash,
            salt: u.salt || l.salt,
            pinHash: u.pinHash ?? l.pinHash,
            pinSalt: u.pinSalt ?? l.pinSalt,
            webauthnId: u.webauthnId ?? l.webauthnId,
          }
        }),
      }
      getState().setBaza(migruj(scalone as Baza))
      return true
    } catch {
      return false
    }
  },

  wyczyscWszystko: async () => {
    const pusta = pustaBaza()
    setState({ baza: pusta })
    await clearBaza()
    await saveBaza(pusta)
  },
}))

// Uzupelnia brakujace kolekcje w starszych/niepelnych bazach
function migruj(b: Baza): Baza {
  const wzor = pustaBaza()
  const scalona: Baza = { ...wzor, ...b }
  for (const k of Object.keys(wzor) as (keyof Baza)[]) {
    if (Array.isArray((wzor as any)[k]) && !Array.isArray((scalona as any)[k])) {
      ;(scalona as any)[k] = (wzor as any)[k]
    }
  }
  scalona.ustawienia = { ...wzor.ustawienia, ...b.ustawienia }
  // firmy zawsze musza istniec
  if (!scalona.firmy?.length) scalona.firmy = wzor.firmy

  // --- Wycofanie drugiego podmiotu ---
  // Dzialalnosc prowadzi WYLACZNIE Amico Andrzej Fiks. Historyczny drugi podmiot
  // (firma_milena) usuwamy z listy firm RAZ (przez tombstone), ale rekordy przypiete
  // do niego przepinamy na Andrzeja ZAWSZE - takze te, ktore przyjda pozniej z chmury
  // od urzadzenia z niezaktualizowana wersja aplikacji. Bez tego taki rekord (KP,
  // raport kasowy, przelew, obrot, protokol) po scaleniu wpada do bazy, ale znika ze
  // wszystkich widokow filtrowanych po firmaId - czyli "gubi sie" niezauwazenie.
  const DO_USUNIECIA = 'firma_milena'
  const DOMYSLNA = 'firma_andrzej'
  if (scalona.firmy?.some((f) => f.id === DO_USUNIECIA)) {
    scalona.firmy = scalona.firmy.filter((f) => f.id !== DO_USUNIECIA)
    const maTomb = (scalona.usuniete || []).some((t) => t.k === 'firmy' && t.id === DO_USUNIECIA)
    if (!maTomb) scalona.usuniete = [...(scalona.usuniete || []), { k: 'firmy', id: DO_USUNIECIA, t: nowISO() }]
  }
  if (!scalona.firmy?.length) scalona.firmy = wzor.firmy
  // cel przepiecia = docelowy podmiot (nigdy ten usuwany)
  const cel = scalona.firmy.find((f) => f.id === DOMYSLNA) || scalona.firmy[0]
  for (const k of Object.keys(scalona) as (keyof Baza)[]) {
    const arr: any = (scalona as any)[k]
    if (!Array.isArray(arr)) continue
    for (const r of arr) if (r && r.firmaId === DO_USUNIECIA) r.firmaId = cel.id
  }
  if (scalona.ustawienia.aktywnaFirmaId === DO_USUNIECIA) {
    scalona.ustawienia = { ...scalona.ustawienia, aktywnaFirmaId: cel.id, _zm: nowISO() } as any
  }
  // Jedyna poprawna strona firmy to marmurowydom.pl - podmieniamy TYLKO stary domyslny
  // adres. Pustego pola NIE ruszamy (uzytkownik moze je celowo wyczyscic), zeby migracja
  // nie nadpisywala recznej edycji i nie robila rozjazdu miedzy widokiem a chmura.
  scalona.firmy = scalona.firmy.map((f) =>
    f.id === DOMYSLNA && f.www === 'amico.kontaktio.pl' ? { ...f, www: 'marmurowydom.pl' } : f,
  )
  // --- Defensywna normalizacja tablic w rekordach ---
  // Brakujaca tablica (stare dane, import starej kopii, czesciowa synchronizacja) kladla
  // CALY widok przy odczycie (.map/.reduce/.length/[0]). Gwarantujemy, ze kazdy rekord ma
  // swoje tablice - zaden niepelny rekord nie wywali strony (ErrorBoundary).
  const normArr = (rec: any, pola: string[]) => {
    if (!rec || pola.every((p) => Array.isArray(rec[p]))) return rec
    const kopia = { ...rec }
    for (const p of pola) if (!Array.isArray(kopia[p])) kopia[p] = []
    return kopia
  }
  const mapNorm = (klucz: keyof Baza, pola: string[]) => {
    const arr = (scalona as any)[klucz]
    if (Array.isArray(arr)) (scalona as any)[klucz] = arr.map((r: any) => normArr(r, pola))
  }
  mapNorm('kontrahenci', ['prowizje'])
  mapNorm('klienci', ['tagi', 'historia'])
  mapNorm('wyceny', ['pozycje'])
  mapNorm('faktury', ['pozycje'])
  mapNorm('raportyKasowe', ['wiersze'])
  mapNorm('ekspozycje', ['rozliczenia'])
  mapNorm('skany', ['strony'])
  mapNorm('dokumenty', ['widoczneDla'])
  // Zlecenie: tablica `etapy` + OBIEKT `osoby` (przypisania) - oba musza istniec, bo
  // widok szczegolow czyta z.osoby.projektantId itd.
  if (Array.isArray((scalona as any).zlecenia)) {
    ;(scalona as any).zlecenia = (scalona as any).zlecenia.map((z: any) => {
      const zz = normArr(z, ['etapy'])
      return zz.osoby && typeof zz.osoby === 'object' ? zz : { ...zz, osoby: {} }
    })
  }
  // Odprawa ma tablice zagniezdzona: sekcje[].pozycje - normalizujemy oba poziomy.
  if (Array.isArray((scalona as any).odprawy)) {
    ;(scalona as any).odprawy = (scalona as any).odprawy.map((o: any) => {
      const oo = normArr(o, ['sekcje'])
      return { ...oo, sekcje: oo.sekcje.map((s: any) => normArr(s, ['pozycje'])) }
    })
  }
  return scalona
}
