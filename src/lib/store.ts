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

export const useStore = create<AppState>((setState, getState) => ({
  baza: pustaBaza(),
  hydrated: false,
  bladZapisu: null,

  init: async () => {
    const zapisana = await loadBaza()
    if (zapisana && zapisana.firmy?.length) {
      setState({ baza: migruj(zapisana), hydrated: true })
    } else {
      // Start bez danych demo – demo mozna wczytac recznie w Ustawieniach.
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
          // np. QuotaExceededError – uzytkownik MUSI o tym wiedziec
          setState({
            bladZapisu:
              e?.name === 'QuotaExceededError'
                ? 'Brak miejsca na urządzeniu – zrób kopię i usuń stare skany.'
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
    // znacznik zmiany – potrzebny do bezpiecznego scalania miedzy urzadzeniami
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
    // migruj – dane z chmury moga pochodzic z innej wersji aplikacji
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
    const key = `${prefix}-${rok}`
    const kolejny = (getState().baza.ustawienia.numeracja[key] || 0) + 1
    return `${prefix} ${kolejny}/${rok}`
  },

  kolejnyNumer: (prefix) => {
    const rok = new Date().getFullYear()
    const key = `${prefix}-${rok}`
    const s = getState()
    const kolejny = (s.baza.ustawienia.numeracja[key] || 0) + 1
    setState((st) => ({
      baza: {
        ...st.baza,
        // _zm jest KONIECZNE – bez niego scalanie mogloby cofnac licznik i wygenerowac duplikaty numerow
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

  eksportJSON: () => JSON.stringify(getState().baza, null, 2),

  importJSON: (json) => {
    try {
      const parsed = JSON.parse(json) as Baza
      if (!parsed.firmy || !Array.isArray(parsed.firmy)) return false
      getState().setBaza(migruj(parsed))
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
  return scalona
}
