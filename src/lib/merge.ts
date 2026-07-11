import type { Baza, Tombstone } from './types'
import { pustaBaza } from './seed'

// Znacznik ostatniej zmiany rekordu (ustawiany w store.upsert)
const zm = (r: any): string => (r?._zm || r?.zaktualizowano || r?.utworzono || '') as string

/**
 * Scala dwie wersje bazy (lokalna + z serwera) tak, aby NIC nie zginelo:
 *  - rekordy laczone po id; wygrywa nowszy (znacznik _zm),
 *  - usuniecia propagowane przez tombstones (usuniete),
 *  - ustawienia: nowsze wygrywaja.
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

    out[k] = [...mapa.values()].filter((rec) => {
      const t = tomby.get(`${String(k)}::${rec.id}`)
      // usun tylko wtedy, gdy skasowano PO ostatniej zmianie rekordu
      return !t || t < zm(rec)
    })
  }

  // 3) Tombstones do zapisu (przytnij starsze niz 90 dni)
  const granica = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString()
  out.usuniete = [...tomby.entries()]
    .map(([key, t]): Tombstone => {
      const i = key.indexOf('::')
      return { k: key.slice(0, i), id: key.slice(i + 2), t }
    })
    .filter((x) => x.t > granica)

  // 4) Ustawienia – nowsze wygrywaja
  const lu: any = lokalna.ustawienia
  const ru: any = zdalna.ustawienia
  out.ustawienia = !ru ? lu : !lu ? ru : zm(lu) >= zm(ru) ? lu : ru

  out.wersja = Math.max(lokalna.wersja || 1, zdalna.wersja || 1)
  return out as Baza
}

// Czy zdalna baza jest "pusta" (nowy workspace)
export function pustyStan(b: any): boolean {
  if (!b || typeof b !== 'object') return true
  return !Array.isArray(b.firmy) || b.firmy.length === 0
}
