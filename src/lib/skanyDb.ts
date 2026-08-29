import { supabase } from './supabase'
import { useCloud } from './cloud'
import { useStore } from './store'
import type { Skan, SkanKategoria } from './types'

// ============================================================================
// AMICO - SKANY jako osobne wiersze w tabeli public.amico_skany (NIE w blobie bazy).
// Dzieki temu skalują się do dziesiątek tysięcy: ładujemy STRONAMI (limit/offset), a nie
// wszystko naraz; wyszukiwanie i filtr po stronie bazy (indeksy). Obrazy stron dalej w
// Storage (bucket skany) - w wierszu tylko sciezki (albo base64 przejsciowo, gdy offline).
// ============================================================================

const BUCKET = 'skany'
export const STRONA_ROZMIAR = 60 // ile skanow na "strone" listy

export type SkanRow = {
  id: string
  workspace_id: string
  nazwa: string | null
  kategoria: string | null
  strony: string[]
  zlecenie_id: string | null
  klient_id: string | null
  notatka: string | null
  utworzono: string
  zm: string
  usuniety: boolean
  ma_base64: boolean
}

function czyBase64(s: string): boolean {
  return typeof s === 'string' && s.startsWith('data:')
}
function rowNaSkan(r: SkanRow): Skan & { _zm?: string } {
  return {
    id: r.id,
    nazwa: r.nazwa || '',
    kategoria: (r.kategoria || 'inne') as SkanKategoria,
    strony: Array.isArray(r.strony) ? r.strony : [],
    zlecenieId: r.zlecenie_id || undefined,
    klientId: r.klient_id || undefined,
    notatka: r.notatka || undefined,
    utworzono: r.utworzono,
    _zm: r.zm,
  }
}

function ws(): string | null {
  return useCloud.getState().workspaceId
}

// ---------- Odczyt (stronicowany, filtrowany po stronie bazy) ----------
export async function listaSkanow(opts: {
  kategoria?: string
  szukaj?: string
  offset?: number
  limit?: number
}): Promise<{ skany: (Skan & { _zm?: string })[]; jestWiecej: boolean }> {
  const w = ws()
  if (!w) return { skany: [], jestWiecej: false }
  const limit = opts.limit ?? STRONA_ROZMIAR
  const offset = opts.offset ?? 0
  let q = supabase
    .from('amico_skany')
    .select('*')
    .eq('workspace_id', w)
    .eq('usuniety', false)
    .order('utworzono', { ascending: false })
    .range(offset, offset + limit) // +1 sztuka, zeby wykryc "jest wiecej"
  if (opts.kategoria) q = q.eq('kategoria', opts.kategoria)
  const szukaj = (opts.szukaj || '').trim()
  if (szukaj) {
    // Neutralizujemy znaki, ktore albo lamia skladnie filtra .or() PostgREST ( , ( ) " \ ),
    // albo sa wieloznacznikami LIKE ( % _ ) - zamieniamy na spacje, wiec szukanie jest
    // doslowne i nie da sie nim wywolac bledu zapytania.
    const esc = szukaj.replace(/[%_,()"\\]/g, ' ')
    q = q.or(`nazwa.ilike.%${esc}%,notatka.ilike.%${esc}%`)
  }
  const { data, error } = await q
  if (error) throw error
  const rows = (data || []) as SkanRow[]
  const jestWiecej = rows.length > limit
  return { skany: rows.slice(0, limit).map(rowNaSkan), jestWiecej }
}

export async function policzSkany(): Promise<number> {
  const w = ws()
  if (!w) return 0
  const { count } = await supabase
    .from('amico_skany')
    .select('id', { count: 'exact', head: true })
    .eq('workspace_id', w)
    .eq('usuniety', false)
  return count || 0
}

export async function skanyDlaZlecenia(zlecenieId: string): Promise<(Skan & { _zm?: string })[]> {
  const w = ws()
  if (!w || !zlecenieId) return []
  const { data, error } = await supabase
    .from('amico_skany')
    .select('*')
    .eq('workspace_id', w)
    .eq('usuniety', false)
    .eq('zlecenie_id', zlecenieId)
    .order('utworzono', { ascending: false })
  if (error) throw error
  return ((data || []) as SkanRow[]).map(rowNaSkan)
}

// ---------- Zapis / usuniecie ----------
export async function zapiszSkan(skan: Skan): Promise<void> {
  const w = ws()
  if (!w) throw new Error('Brak połączenia z firmą w chmurze.')
  const maB64 = (skan.strony || []).some(czyBase64)
  const { error } = await supabase.from('amico_skany').upsert(
    {
      id: skan.id,
      workspace_id: w,
      nazwa: skan.nazwa || '',
      kategoria: skan.kategoria || 'inne',
      strony: skan.strony || [],
      zlecenie_id: skan.zlecenieId || null,
      klient_id: skan.klientId || null,
      notatka: skan.notatka || null,
      utworzono: skan.utworzono || new Date().toISOString(),
      zm: new Date().toISOString(),
      usuniety: false,
      ma_base64: maB64,
    },
    { onConflict: 'id' },
  )
  if (error) throw error
  if (maB64) void offloadSkanyTabela() // od razu spróbuj przenieść do Storage
}

// Zapis SAMYCH metadanych (nazwa/kategoria/przypisania/notatka) - NIE dotyka `strony`,
// zeby nie nadpisac sciezek wgranych przez offload.
export async function zapiszMetaSkanu(id: string, p: Partial<Skan>): Promise<void> {
  const w = ws()
  if (!w) throw new Error('Brak połączenia z firmą w chmurze.')
  // 'klucz' in p (a nie !== undefined): ODPIECIE od zlecenia/klienta przekazuje undefined,
  // ale klucz JEST obecny -> musimy zapisac null. Inaczej odpiecie ginie po cichu.
  const patch: Record<string, unknown> = { zm: new Date().toISOString() }
  if ('nazwa' in p) patch.nazwa = p.nazwa || ''
  if ('kategoria' in p) patch.kategoria = p.kategoria
  if ('zlecenieId' in p) patch.zlecenie_id = p.zlecenieId || null
  if ('klientId' in p) patch.klient_id = p.klientId || null
  if ('notatka' in p) patch.notatka = p.notatka || null
  const { error } = await supabase.from('amico_skany').update(patch).eq('workspace_id', w).eq('id', id)
  if (error) throw error
}

export async function usunSkan(id: string): Promise<void> {
  const w = ws()
  if (!w) throw new Error('Brak połączenia z firmą w chmurze.')
  // Miekkie usuniecie (propaguje sie, nie wskrzesza). Plikow w Storage NIE kasujemy od razu -
  // sprzata je odroczony GC (skan usuniety > 30 dni), zeby edycja-po-usunieciu z innego
  // urzadzenia nie zostawila pustych stron.
  const { error } = await supabase
    .from('amico_skany')
    .update({ usuniety: true, zm: new Date().toISOString() })
    .eq('workspace_id', w)
    .eq('id', id)
  if (error) throw error
}

// ---------- Realtime (druga osoba od razu widzi nowe/zmienione skany) ----------
export function subskrybujSkany(onZmiana: () => void): () => void {
  const w = ws()
  if (!w) return () => {}
  const kanal = supabase
    .channel(`amico_skany_${w}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'amico_skany', filter: `workspace_id=eq.${w}` }, () =>
      onZmiana(),
    )
    .subscribe()
  return () => {
    kanal.unsubscribe()
  }
}

// ---------- Offload base64 -> Storage (dla wierszy z ma_base64) ----------
let offloadWTrakcie = false
// Gdy bucket "skany" nie istnieje (nie uruchomiono amico-skany.sql) - nie ponawiamy w kolko,
// pokazujemy JEDEN komunikat i czekamy. Kasowane przy wznowieniu/online (zresetujBrakBucketaTabela).
let brakBucketaSkanow = false
export function zresetujBrakBucketaTabela() {
  brakBucketaSkanow = false
}
export async function offloadSkanyTabela(): Promise<void> {
  const w = ws()
  if (!w || offloadWTrakcie || brakBucketaSkanow) return
  offloadWTrakcie = true
  try {
    // Bierzemy tylko wiersze, ktore realnie maja base64 (partial index) - garść naraz.
    const { data, error } = await supabase
      .from('amico_skany')
      .select('id, strony')
      .eq('workspace_id', w)
      .eq('usuniety', false)
      .eq('ma_base64', true)
      .limit(20)
    if (error || !data) return
    for (const row of data as { id: string; strony: string[] }[]) {
      const strony = row.strony || []
      const nowe: string[] = []
      let zmiana = false
      let dalejBase64 = false
      for (let i = 0; i < strony.length; i++) {
        const p = strony[i]
        if (!czyBase64(p)) {
          nowe.push(p)
          continue
        }
        const sciezka = `${w}/${row.id}-${i}.jpg`
        const buf = dataUrlNaBlob(p)
        const { error: eUp } = await supabase.storage.from(BUCKET).upload(sciezka, buf, {
          upsert: true,
          contentType: 'image/jpeg',
        })
        if (eUp) {
          nowe.push(p) // nie udalo sie (offline / brak bucketa) - zostaje base64
          dalejBase64 = true
          if (/bucket|not found|does not exist/i.test(eUp.message || '')) {
            brakBucketaSkanow = true
            useCloud.getState().ustaw({
              status: 'blad',
              blad:
                'Magazyn skanów nie jest gotowy - uruchom raz w Supabase skrypt supabase/amico-skany.sql. Skany są bezpieczne, pojawią się w chmurze po uruchomieniu skryptu.',
            })
            return
          }
        } else {
          nowe.push(sciezka)
          zmiana = true
        }
      }
      if (zmiana) {
        // NIE zmieniamy zm (to zmiana mechaniczna) - ale kolumny zm nie ruszamy w update:
        await supabase.from('amico_skany').update({ strony: nowe, ma_base64: dalejBase64 }).eq('workspace_id', w).eq('id', row.id)
      }
    }
  } finally {
    offloadWTrakcie = false
  }
}

// Jednorazowe przeniesienie skanow ze STAREGO blobu (baza.skany) do tabeli. Wywolywane po
// polaczeniu - lapie skany zrobione na tym urzadzeniu zanim wprowadzilismy tabele (np. offline).
// Tylko WSTAWIA (idempotentnie po id) - NIE czysci blobu, zeby stara wersja aplikacji na innym
// urzadzeniu dalej je widziala do czasu aktualizacji.
let migracjaBlobZrobiona = false
export async function migrujBlobSkanyDoTabeli(): Promise<void> {
  const w = ws()
  if (migracjaBlobZrobiona || !w) return
  const blobSkany = (useStore.getState().baza.skany || []) as (Skan & { _zm?: string })[]
  if (!blobSkany.length) {
    migracjaBlobZrobiona = true
    return
  }
  try {
    const wiersze = blobSkany
      .filter((s) => s && s.id)
      .map((s) => ({
        id: s.id,
        workspace_id: w,
        nazwa: s.nazwa || '',
        kategoria: s.kategoria || 'inne',
        strony: s.strony || [],
        zlecenie_id: s.zlecenieId || null,
        klient_id: s.klientId || null,
        notatka: s.notatka || null,
        utworzono: s.utworzono || new Date().toISOString(),
        zm: s._zm || s.utworzono || new Date().toISOString(),
        usuniety: false,
        ma_base64: (s.strony || []).some(czyBase64),
      }))
    // KLUCZOWE: ignoreDuplicates (INSERT ... ON CONFLICT DO NOTHING) - migracja z blobu tylko
    // WSTAWIA brakujace skany, NIGDY nie nadpisuje istniejacych. Inaczej wskrzeszalaby skan
    // usuniety w tabeli (usuniety=true) albo cofala edycje metadanych (blob ma stara wersje).
    const { error } = await supabase.from('amico_skany').upsert(wiersze, { onConflict: 'id', ignoreDuplicates: true })
    if (error) throw error
    migracjaBlobZrobiona = true
    void offloadSkanyTabela()
  } catch {
    /* ponowimy przy nastepnym polaczeniu */
  }
}

// base64 dataURL -> Blob (bez fetch(data:) - to lamie CSP)
function dataUrlNaBlob(dataUrl: string): Blob {
  const przecinek = dataUrl.indexOf(',')
  const b64 = dataUrl.slice(przecinek + 1)
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: 'image/jpeg' })
}
