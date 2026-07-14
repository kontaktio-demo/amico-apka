import type { Baza, Tombstone } from './types'
import { pustaBaza } from './seed'

// Znacznik ostatniej zmiany rekordu (ustawiany w store.upsert)
const zm = (r: any): string => (r?._zm || r?.zaktualizowano || r?.utworzono || '') as string

/**
 * Scala dwie wersje bazy (lokalna + z serwera) tak, aby NIC nie zginelo:
 * - rekordy laczone po id; wygrywa nowszy (znacznik _zm),
 * - usuniecia propagowane przez tombstones (usuniete),
 * - ustawienia: nowsze wygrywaja.
 */
export function scalBaze(lokalna: Baza, zdalna: Baza): Baza {
  const wzor = pustaBaza()
  const out: any = { ...wzor }

  // 1) Tombstones – najnowszy wpis per (kolekcja,id)
  const tomby = new Map<string, string>()
  for (const t of [...(lokalna.usuniete || []), ...(zdalna.usuniete || [])]) {
    if (!t?.k || !t?.id) continue
    const key = `${t.k}::${t.id}`
    const prev = tomby.get(key)
    if (!prev || t.t > prev) tomby.set(key, t.t)
  }

  // 2) Kolekcje – suma rekordow, nowszy wygrywa, skasowane odpadaja
  for (const k of Object.keys(wzor) as (keyof Baza)[]) {
    if (k === 'usuniete') continue
    if (!Array.isArray((wzor as any)[k])) continue

    const l: any[] = Array.isArray((lokalna as any)[k]) ? (lokalna as any)[k] : []
    const r: any[] = Array.isArray((zdalna as any)[k]) ? (zdalna as any)[k] : []

    const mapa = new Map<string, any>()
    for (const rec of r) if (rec?.id) mapa.set(rec.id, rec)
    for (const rec of l) {
      if (!rec?.id) continue
      const ist = mapa.get(rec.id)
      if (!ist || zm(rec) >= zm(ist)) mapa.set(rec.id, rec)
    }

    out[k] = [...mapa.values()]
      .filter((rec) => {
        const t = tomby.get(`${String(k)}::${rec.id}`)
        // usun tylko wtedy, gdy skasowano PO ostatniej zmianie rekordu
        return !t || t < zm(rec)
      })
      // KLUCZOWE: stala kolejnosc po id. Bez tego dwa urzadzenia z tym samym
      // zbiorem rekordow tworza tablice w roznej kolejnosci (kolejnosc wstawiania
      // do Map), porownanie "czy stan sie rozni" jest zawsze prawdziwe i baza
      // krazy w kolko miedzy urzadzeniami (petla zapisow ze skanami base64).
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))
  }

  // 3) Tombstones do zapisu (przytnij starsze niz 90 dni)
  const granica = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  out.usuniete = [...tomby.entries()]
    .map(([key, t]): Tombstone => {
      const i = key.indexOf('::')
      return { k: key.slice(0, i), id: key.slice(i + 2), t }
    })
    .filter((x) => x.t > granica)
    // Stala kolejnosc tombstonow – z tego samego powodu co przy kolekcjach wyzej.
    .sort((a, b) => `${a.k}::${a.id}`.localeCompare(`${b.k}::${b.id}`))

  // 4) Ustawienia – nowsze wygrywaja, ALE licznik numeracji scalamy przez MAX.
  // (licznik jest monotoniczny – cofniecie = duplikaty numerow faktur/umow!)
  const lu: any = lokalna.ustawienia
  const ru: any = zdalna.ustawienia
  const wygrany: any = !ru ? lu : !lu ? ru : zm(lu) >= zm(ru) ? lu : ru
  const przegrany: any = wygrany === lu ? ru : lu
  const numeracja: Record<string, number> = { ...(przegrany?.numeracja || {}) }
  for (const [k2, v] of Object.entries(wygrany?.numeracja || {})) {
    numeracja[k2] = Math.max(Number(v) || 0, Number(numeracja[k2]) || 0)
  }
  out.ustawienia = { ...(wygrany || {}), numeracja }

  // 5) Sekrety lokalne (hash hasla, PIN, biometria) NIGDY nie ida do chmury,
  // wiec po scaleniu przywracamy je z wersji lokalnej.
  const sekretyLokalne = new Map<string, any>()
  for (const u of (lokalna as any).uzytkownicy || []) sekretyLokalne.set(u.id, u)
  out.uzytkownicy = (out.uzytkownicy || []).map((u: any) => {
    const l = sekretyLokalne.get(u.id)
    if (!l) return u
    return {
      ...u,
      hasloHash: u.hasloHash || l.hasloHash,
      salt: u.salt || l.salt,
      pinHash: u.pinHash ?? l.pinHash,
      pinSalt: u.pinSalt ?? l.pinSalt,
      webauthnId: u.webauthnId ?? l.webauthnId,
    }
  })

  out.wersja = Math.max(lokalna.wersja || 1, zdalna.wersja || 1)
  return out as Baza
}

// Kopia bazy BEZ sekretow – tylko taka trafia do chmury.
// (hashe hasel/PIN i klucze biometrii sa danymi urzadzenia, nie firmy)
export function bezSekretow(b: Baza): Baza {
  const kopia: any = { ...b }
  kopia.uzytkownicy = (b.uzytkownicy || []).map((u: any) => {
    const { hasloHash, salt, pinHash, pinSalt, webauthnId, ...reszta } = u
    return reszta
  })
  return kopia as Baza
}

// Czy zdalna baza jest "pusta" (nowy workspace)
export function pustyStan(b: any): boolean {
  if (!b || typeof b !== 'object') return true
  return !Array.isArray(b.firmy) || b.firmy.length === 0
}
