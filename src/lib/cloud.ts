import { create } from 'zustand'
import { supabase } from './supabase'
import { useStore, migruj } from './store'
import { scalBaze, pustyStan, bezSekretow } from './merge'
import { pustaBaza } from './seed'
import type { Baza, Rola, Uzytkownik } from './types'
import { hashHasla, losowaSol, zapiszOstatniego } from './auth'
import { nowISO } from './format'

// ============================================================================
// AMICO - synchronizacja z chmura (Supabase).
// Model: cala baza firmy = jeden dokument JSON + licznik wersji (rev).
// Zapis: CAS (compare-and-swap). Konflikt -> scalenie -> ponowna proba.
// Zasada nadrzedna: ZADNA zmiana nie moze zginac ani zostac cicho nadpisana.
// ============================================================================

export type SyncStatus = 'off' | 'laczenie' | 'ok' | 'zapisywanie' | 'offline' | 'blad' | 'sesja'

// Postgres przechowuje jsonb z kluczami POSORTOWANYMI, wiec zwykly JSON.stringify
// lokalnego obiektu nigdy nie zgadza sie ze stanem z serwera (inna kolejnosc kluczy).
// Bez tego porownanie "czy sie rozni" jest ZAWSZE prawdziwe i dwa urzadzenia
// w nieskonczonosc odsylaja sobie cala baze.
//
// KRYTYCZNE (pamiec): NIE budujemy pelnego stringa calej bazy. Przy wielu skanach
// baza ma dziesiatki MB (base64), a materializowanie jej jako string 2-3x zajmowalo
// ~100+ MB naraz -> iPhone (PWA) zabijal karte (Safari "Wielokrotnie wystapil problem").
// Zamiast tego LICZYMY skrot strumieniowo: przechodzimy strukture kanonicznie (klucze
// posortowane, undefined pomijane) i zwijamy w dwa niezalezne 32-bit akumulatory FNV-1a.
// Pamiec O(1), szansa kolizji ~2^-64 (znikoma). Rowna postac kanoniczna -> rowny hash.
function stabilnyHash(v: any): string {
  let h1 = 0x811c9dc5 | 0
  let h2 = 0x1b873593 | 0
  const zwin = (s: string) => {
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i)
      h1 = Math.imul(h1 ^ c, 0x01000193)
      h2 = Math.imul(h2 ^ c, 0x01000193)
      h2 = (h2 << 13) | (h2 >>> 19) // rotacja -> drugi hash niezalezny od pierwszego
    }
  }
  const idz = (x: any) => {
    // Znaczniki typu + PREFIKS DLUGOSCI dla stringow/kluczy -> postac jednoznaczna:
    // dwie rozne struktury kanoniczne nie moga dac tego samego strumienia.
    if (x === null) return zwin("n;")
    const t = typeof x
    if (t === "string") {
      zwin("s" + x.length + ":")
      zwin(x)
      return
    }
    if (t === "number") return zwin("#" + x + ";")
    if (t === "boolean") return zwin(x ? "bT;" : "bF;")
    if (t !== "object") return zwin("?" + String(x) + ";")
    if (Array.isArray(x)) {
      zwin("[" + x.length + ":")
      for (let i = 0; i < x.length; i++) idz(x[i])
      return zwin("]")
    }
    const klucze = Object.keys(x)
      .filter((k) => x[k] !== undefined)
      .sort()
    zwin("{" + klucze.length + ":")
    for (const k of klucze) {
      zwin("k" + k.length + ":")
      zwin(k)
      idz(x[k])
    }
    zwin("}")
  }
  idz(v)
  return (h1 >>> 0).toString(16).padStart(8, '0') + (h2 >>> 0).toString(16).padStart(8, '0')
}

// Przyblizony rozmiar bazy w bajtach - liczony strumieniowo (bez budowania pelnego
// stringa) tylko do wyswietlenia "rozmiar bazy" w Ustawieniach. Nie musi byc co do
// bajta; chodzi o to, by NIE alokowac dziesiatek MB przy kazdym zapisie duzej bazy.
function rozmiarBajtowPrzybl(v: any): number {
  let n = 0
  const idz = (x: any) => {
    if (x === null) {
      n += 4
      return
    }
    const t = typeof x
    if (t === 'string') {
      n += (x as string).length + 2
      return
    }
    if (t === 'number' || t === 'boolean') {
      n += String(x).length
      return
    }
    if (t !== 'object') {
      n += 4
      return
    }
    if (Array.isArray(x)) {
      n += 2
      for (let i = 0; i < x.length; i++) {
        n += 1
        idz(x[i])
      }
      return
    }
    for (const k of Object.keys(x)) {
      if (x[k] === undefined) continue
      n += k.length + 4
      idz(x[k])
    }
    n += 2
  }
  idz(v)
  return n
}

// Rozklad rozmiaru bazy (KB) na klasy - do DIAGNOZY bledu limitu 20 MB. Rozroznia skany od
// pozostalych base64 (podpisy, logo), zeby komunikat/log nie wskazywal falszywie na skany.
function diagnozaRozmiaruBazy(): Record<string, number> {
  const b: any = useStore.getState().baza
  let skanyB64 = 0
  for (const s of b.skany || []) for (const p of s.strony || []) if (czyBase64Strona(p)) skanyB64 += p.length
  let wszystkieB64 = 0
  const walk = (x: any) => {
    if (typeof x === 'string') {
      if (x.startsWith('data:')) wszystkieB64 += x.length
      return
    }
    if (Array.isArray(x)) {
      for (const e of x) walk(e)
      return
    }
    if (x && typeof x === 'object') for (const k of Object.keys(x)) walk(x[k])
  }
  walk(b)
  const calosc = rozmiarBajtowPrzybl(b)
  return {
    calkowita: Math.round(calosc / 1024),
    skany_base64: Math.round(skanyB64 / 1024),
    inne_base64_podpisy_logo: Math.round((wszystkieB64 - skanyB64) / 1024),
    metadane: Math.round((calosc - wszystkieB64) / 1024),
  }
}

// Czy blad wynika z niewaznej sesji (usuniety user, zmienione haslo, wygasly/uniewazniony token)?
function czyBladSesji(e: any): boolean {
  const m = `${e?.message || ''} ${e?.details || ''} ${e?.hint || ''}`.toLowerCase()
  const kod = String(e?.code || '')
  // Konto usuniete w Supabase: token nadal "wazny", ale auth.uid() nie istnieje juz w auth.users
  // -> proba wpisu do amico_members lamie klucz obcy (23503).
  const usunieteKonto = kod === '23503' || (m.includes('foreign key') && m.includes('amico_members'))
  return (
    usunieteKonto ||
    kod === '401' ||
    kod === '403' ||
    m.includes('jwt') ||
    m.includes('sub claim') ||
    m.includes('wymagane logowanie') ||
    m.includes('not authenticated') ||
    m.includes('invalid token') ||
    m.includes('token is expired') ||
    m.includes('refresh token')
  )
}

// Zamienia techniczny (czesto angielski) komunikat bledu na zrozumialy po polsku.
// Dzieki temu pasek bledu chmury nie straszy uzytkownika "Failed to fetch".
export function bladPoPolsku(e: any): string {
  const m: string = (e?.message || e || '').toString()
  if (!m) return 'Błąd połączenia z chmurą'
  if (/failed to fetch|networkerror|network request failed|load failed|timeout/i.test(m))
    return 'Brak połączenia z internetem - zmiany zapiszą się automatycznie, gdy wróci zasięg.'
  if (/row-level security|permission denied|not authorized|403/i.test(m))
    return 'Brak uprawnień do zapisu w chmurze - zaloguj się ponownie (Ustawienia → Chmura).'
  if (/jwt|401|token|not authenticated|session/i.test(m))
    return 'Sesja w chmurze wygasła - zaloguj się ponownie (Ustawienia → Chmura).'
  // Serwer (amico_save_state) odrzuca baze > 20 MB komunikatem "Dane firmy przekraczają
  // dozwolony rozmiar". Bez tego wpisu wpadal do ogolnego bledu i user nie wiedzial, ze
  // problem to ROZMIAR (za duzo skanow), a nie internet.
  if (/payload|too large|entity too large|\b413\b|przekracz|dozwolony rozmiar|rozmiar|20\s?mb|\bsize\b/i.test(m))
    return 'Baza jest za duża, żeby zapisać w chmurze (najczęściej dużo skanów). Sprawdź w Ustawieniach → Chmura co zajmuje najwięcej i usuń/zmniejsz stare skany. Jeśli magazyn skanów nie był jeszcze skonfigurowany, uruchom w Supabase skrypt amico-skany.sql.'
  if (/statement timeout|canceling statement/i.test(m))
    return 'Zapis do chmury trwał za długo (duża baza). Zmniejsz liczbę/rozmiar skanów - spróbuję ponownie.'
  if (/does not exist|schema cache|PGRST202|amico_/i.test(m))
    return 'Baza w chmurze nie jest przygotowana - uruchom skrypt SQL (supabase/amico-schema.sql).'
  return 'Nie udało się zapisać w chmurze. Zmiany są bezpieczne na urządzeniu i wyślą się ponownie.'
}

// Sesja przestala byc wazna - przestajemy sie dobijac i prosimy o ponowne logowanie.
// Dane lokalne zostaja nietkniete.
async function obsluzWygaslaSesje() {
  stopSync()
  try {
    // scope: 'local' jest KLUCZOWE. Domyslne wylogowanie w Supabase jest globalne -
    // uniewaznia sesje na WSZYSTKICH urzadzeniach. Przez to potkniecie sesji w jednej
    // aplikacji (np. na komputerze) wyrzucalo uzytkownika takze z tabletu.
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  useCloud.getState().ustaw({
    status: 'sesja',
    workspaceId: null,
    blad: 'Sesja w chmurze wygasła - zaloguj się ponownie (Ustawienia → Chmura). Twoje dane są bezpieczne na urządzeniu.',
  })
}

interface CloudState {
  status: SyncStatus
  email: string | null
  workspaceId: string | null
  joinCode: string | null
  rola: Rola | null
  blad: string | null
  ostatniZapis: string | null
  rozmiarKB: number
  ustaw: (p: Partial<CloudState>) => void
}
export const useCloud = create<CloudState>((set) => ({
  status: 'off',
  email: null,
  workspaceId: null,
  joinCode: null,
  rola: null,
  blad: null,
  ostatniZapis: null,
  rozmiarKB: 0,
  ustaw: (p) => set(p),
}))

const C = () => useCloud.getState()

// ---------- rev serwera + przypisanie bazy do firmy ----------
const revKey = (ws: string) => `amico-rev-${ws}`
const getRev = (ws: string): number => Number(localStorage.getItem(revKey(ws)) || 0)
const setRev = (ws: string, r: number) => localStorage.setItem(revKey(ws), String(r))

// Do KTOREJ firmy naleza dane lokalne. Chroni przed wmieszaniem danych firmy A do firmy B.
const WS_KEY = 'amico-baza-ws'
const getBazaWs = () => localStorage.getItem(WS_KEY)
const setBazaWs = (ws: string) => localStorage.setItem(WS_KEY, ws)

// Ktora firme wybralismy swiadomie (bootstrap albo dolaczenie kodem).
// Pracownik, ktory najpierw zaklada konto, a potem dolacza kodem, ma DWA czlonkostwa.
// amico_bootstrap robi "limit 1" bez ORDER BY, wiec bez tego moglby wylosowac
// puste, prywatne workspace i skasowac lokalne dane (zastapLokalneZdalnym).
const AKT_WS = 'amico-workspace'
export const zapamietajWorkspace = (ws: string) => localStorage.setItem(AKT_WS, ws)

export async function ustalWorkspace(imie: string) {
  const sesja = await sesjaChmury()
  const uid = sesja?.user.id
  const zapamietany = localStorage.getItem(AKT_WS)

  if (uid && zapamietany) {
    const { data } = await supabase
      .from('amico_members')
      .select('workspace_id, rola')
      .eq('user_id', uid)
      .eq('workspace_id', zapamietany)
      .maybeSingle()
    if (data) {
      const { data: w } = await supabase
        .from('amico_workspaces')
        .select('join_code')
        .eq('id', zapamietany)
        .maybeSingle()
      return {
        workspaceId: data.workspace_id as string,
        rola: data.rola as Rola,
        joinCode: (w?.join_code as string) || '',
      }
    }
  }

  const r = await bootstrapFirmy(imie)
  zapamietajWorkspace(r.workspaceId)
  return r
}

// ---------- Sesja / konto ----------
export async function sesjaChmury() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function zarejestrujChmura(email: string, haslo: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: haslo })
  if (error) throw error
  if (!data.session) {
    const r = await supabase.auth.signInWithPassword({ email, password: haslo })
    if (r.error) throw new Error('POTWIERDZ_EMAIL')
  }
  return true
}

export async function zalogujChmura(email: string, haslo: string) {
  const { error } = await supabase.auth.signInWithPassword({ email, password: haslo })
  if (error) throw error
  return true
}

export async function wylogujChmura() {
  // Nie gubimy niezapisanych zmian
  try {
    if (brudne || wTrakcie) await zapisz()
  } catch {
    /* zmiany zostaja lokalnie */
  }
  const ws = C().workspaceId
  stopSync()
  if (ws) localStorage.removeItem(revKey(ws))
  // UWAGA: NIE kasujemy WS_KEY. To jedyny znacznik mowiacy, do ktorej firmy naleza
  // dane lezace na tym urzadzeniu. Skasowanie go sprawia, ze po zalogowaniu sie na
  // konto INNEJ firmy dane starej firmy zostalyby z nia scalone i wypchniete do chmury.
  // Wylogowanie dotyczy TYLKO tego urzadzenia. Bez scope: 'local' Supabase uniewaznia
  // sesje wszedzie - wylogowanie sie na komputerze wyrzucalo tez z tabletu.
  await supabase.auth.signOut({ scope: 'local' })
  C().ustaw({ status: 'off', email: null, workspaceId: null, joinCode: null, rola: null, blad: null })
}

// Odlacza urzadzenie od chmury BEZ wysylania czegokolwiek. Uzywane przy czyszczeniu
// danych lokalnych, zeby pusta baza nie poszla na serwer.
// Kasujemy WSZYSTKIE slady polaczenia i wylogowujemy sie (lokalnie). Inaczej po
// restarcie startSync() ponownie sciagnal cala baze firmy z chmury - czyszczenie
// byloby pozorne, a przy okazji ktos moglby wejsc w cudze dane.
export async function odlaczOdChmury() {
  const ws = C().workspaceId
  stopSync()
  if (ws) localStorage.removeItem(revKey(ws))
  localStorage.removeItem(WS_KEY)
  localStorage.removeItem(AKT_WS)
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* ignore */
  }
  C().ustaw({ status: 'off', email: null, workspaceId: null, joinCode: null, rola: null, blad: null })
}

export async function bootstrapFirmy(imie: string) {
  const { data, error } = await supabase.rpc('amico_bootstrap', { p_imie: imie })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  if (!r) throw new Error('Nie udało się przygotować firmy w chmurze')
  return { workspaceId: r.workspace_id as string, rola: r.rola as Rola, joinCode: r.join_code as string }
}

export async function dolaczDoFirmy(kod: string, imie: string) {
  const { data, error } = await supabase.rpc('amico_join', { p_code: kod, p_imie: imie })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  return { workspaceId: r.workspace_id as string, rola: r.rola as Rola, joinCode: r.join_code as string }
}

// Proste "wejscie" do JEDYNEJ firmy AMICO - uzywane przez uproszczone logowanie
// (sam e-mail + haslo, bez kodow i wyboru "zakladam/dolaczam"). Serwerowa funkcja
// amico_wejscie: dolacza konto do istniejacej firmy, a jesli firmy jeszcze nie ma -
// tworzy ja (pierwsze konto = wlasciciel). Gdy serwer nie ma jeszcze tej funkcji
// (nie uruchomiono SQL), spadamy do dotychczasowej sciezki, zeby nic nie przestalo dzialac.
export async function wejscieDoAmico(imie: string) {
  const { data, error } = await supabase.rpc('amico_wejscie', { p_imie: imie })
  if (error) {
    // Fallback TYLKO gdy funkcji nie ma jeszcze na serwerze (nie uruchomiono SQL).
    // PGRST202 = PostgREST nie znalazl funkcji. NIE lapiemy bledow RUNTIME w srodku
    // funkcji, zeby ich nie maskowac i nie zmieniac po cichu zachowania.
    const kod = (error as any)?.code || ''
    if (kod === 'PGRST202' || /PGRST202|Could not find the function/i.test(error.message || '')) {
      return ustalWorkspace(imie) // istniejacy czlonek trafia do swojej firmy
    }
    throw error
  }
  const r = Array.isArray(data) ? data[0] : data
  if (!r) throw new Error('Nie udało się wejść do firmy AMICO')
  zapamietajWorkspace(r.workspace_id as string)
  return { workspaceId: r.workspace_id as string, rola: r.rola as Rola, joinCode: r.join_code as string }
}

// ---------- Dokumenty do pobrania (pliki w Supabase Storage) ----------
// Pliki NIE ida do bazy JSON (limit ~20MB) - trzymamy je w osobnym magazynie
// (bucket "dokumenty"), a w bazie tylko metadane (nazwa, sciezka, kto widzi).
const BUCKET_DOK = 'dokumenty'

export async function wgrajDokument(plik: File, id: string): Promise<{ sciezka: string; typ?: string; rozmiar: number }> {
  const ws = C().workspaceId
  if (!ws) throw new Error('Brak połączenia z firmą w chmurze – zaloguj się.')
  const bezpieczna = (plik.name || 'plik').replace(/[^\w.\-]+/g, '_').slice(-80)
  const sciezka = `${ws}/${id}-${bezpieczna}`
  const { error } = await supabase.storage
    .from(BUCKET_DOK)
    .upload(sciezka, plik, { upsert: true, contentType: plik.type || undefined })
  if (error) {
    if (/bucket|not found|does not exist/i.test(error.message || ''))
      throw new Error('Magazyn plików nie jest gotowy – uruchom skrypt supabase/amico-dokumenty.sql.')
    throw error
  }
  return { sciezka, typ: plik.type || undefined, rozmiar: plik.size }
}

export async function dokumentPodpisanyUrl(sciezka: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(BUCKET_DOK).createSignedUrl(sciezka, 60 * 60)
  if (error) return null
  return data?.signedUrl || null
}

export async function usunDokumentZChmury(sciezka: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET_DOK).remove([sciezka])
  } catch {
    /* plik i tak znika z listy - metadane usuwamy lokalnie */
  }
}

// ---------- Skany (obrazy stron w Supabase Storage; w bazie tylko SCIEZKI) ----------
// Obrazow skanow NIE trzymamy w bazie JSON (limit 20 MB). Trafiaja do osobnego magazynu
// (bucket "skany"), a strona skanu to albo base64 (jeszcze nie przeniesiony / offline),
// albo sciezka w magazynie. Dzieki temu mozna skanowac BEZ limitu, a baza pozostaje mala.
const BUCKET_SKAN = 'skany'
export function czyBase64Strona(s: string): boolean {
  return typeof s === 'string' && s.startsWith('data:')
}
// base64 dataURL -> Blob (BEZ fetch(data:...) - to lamie CSP connect-src).
function dataUrlNaBlob(dataUrl: string): Blob {
  const przecinek = dataUrl.indexOf(',')
  const meta = dataUrl.slice(0, przecinek)
  const b64 = dataUrl.slice(przecinek + 1)
  const mime = /:(.*?);/.exec(meta)?.[1] || 'image/jpeg'
  const bin = atob(b64)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}
type WynikUpladu = 'ok' | 'brak-bucketa' | 'blad'
function czyBrakBucketa(m: string): boolean {
  return /bucket|not found|does not exist/i.test(m || '')
}
async function wgrajSkanStrone(dataUrl: string, sciezka: string): Promise<WynikUpladu> {
  try {
    const { error } = await supabase.storage
      .from(BUCKET_SKAN)
      .upload(sciezka, dataUrlNaBlob(dataUrl), { upsert: true, contentType: 'image/jpeg' })
    if (!error) return 'ok'
    // Rozrozniamy brak konfiguracji (bucket nie istnieje) od zwyklego bledu sieci - inaczej
    // offload po cichu pada w nieskonczonosc i baza rosnie do limitu (patrz zapisz/limit 20 MB).
    return czyBrakBucketa(error.message || '') ? 'brak-bucketa' : 'blad'
  } catch (e: any) {
    return czyBrakBucketa(String(e?.message || e)) ? 'brak-bucketa' : 'blad'
  }
}
const skanUrlCache = new Map<string, { url: string; do: number }>()
export async function skanUrl(sciezka: string): Promise<string | null> {
  if (czyBase64Strona(sciezka)) return sciezka
  const c = skanUrlCache.get(sciezka)
  if (c && c.do > Date.now()) return c.url
  try {
    const { data, error } = await supabase.storage.from(BUCKET_SKAN).createSignedUrl(sciezka, 60 * 60)
    if (error || !data?.signedUrl) return null
    skanUrlCache.set(sciezka, { url: data.signedUrl, do: Date.now() + 50 * 60 * 1000 })
    return data.signedUrl
  } catch {
    return null
  }
}
export async function usunSkanyZChmury(sciezki: string[]): Promise<void> {
  const realne = (sciezki || []).filter((s) => !czyBase64Strona(s))
  if (!realne.length) return
  try {
    await supabase.storage.from(BUCKET_SKAN).remove(realne)
  } catch {
    /* obraz i tak znika z listy - metadane usuwamy lokalnie */
  }
}
// Do PDF/druku potrzebne base64 - sciezki zamieniamy z powrotem na dataURL.
export async function rozwinStrony(strony: string[]): Promise<string[]> {
  const out: string[] = []
  for (const s of strony || []) {
    if (czyBase64Strona(s)) {
      out.push(s)
      continue
    }
    const url = await skanUrl(s)
    if (!url) continue
    try {
      const blob = await (await fetch(url)).blob()
      const dataUrl = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(r.result as string)
        r.onerror = rej
        r.readAsDataURL(blob)
      })
      out.push(dataUrl)
    } catch {
      /* pomijamy strone, ktorej nie da sie pobrac */
    }
  }
  return out
}
// Przenosi obrazy skanow z bazy (base64) do magazynu plikow - baza JSON przestaje puchnac,
// a zapis do chmury dziala bez limitu. base64 zamieniamy na sciezke DOPIERO po udanym
// wgraniu (nic nie ginie). Uruchamiane po polaczeniu z chmura i cyklicznie.
let offloadWTrakcie = false
// Gdy bucket "skany" nie istnieje (nie uruchomiono amico-skany.sql), nie ponawiamy uploadu
// w kolko (co 45 s calego zbioru) - pokazujemy JEDEN czytelny komunikat i czekamy. Flaga
// jest kasowana przy wznowieniu/ponownym polaczeniu, wiec po uruchomieniu SQL offload wroci.
let brakBucketaSkanow = false
export function zresetujBrakBucketaSkanow() {
  brakBucketaSkanow = false
}
export async function offloadSkany(): Promise<void> {
  const ws = C().workspaceId
  if (!ws || offloadWTrakcie || brakBucketaSkanow) return
  offloadWTrakcie = true
  try {
    const skany = useStore.getState().baza.skany || []
    for (const s of skany) {
      const strony = s.strony || []
      if (!strony.some(czyBase64Strona)) continue // juz przeniesiony
      // FAZA 1: wgraj wszystkie strony base64 tego skanu, zbierajac mape base64 -> sciezka.
      // NIE modyfikujemy jeszcze rekordu - w trakcie uploadu (sekundy) uzytkownik moze ten
      // sam skan edytowac, usunac lub dodac strone; nadpisanie starym snapshotem gubiloby te
      // zmiany i WSKRZESZALO usuniete skany. Dlatego zapis robimy na AKTUALNYM rekordzie nizej.
      const mapa = new Map<string, string>()
      for (let i = 0; i < strony.length; i++) {
        const str = strony[i]
        if (!czyBase64Strona(str)) continue
        const wynik = await wgrajSkanStrone(str, `${ws}/${s.id}-${i}.jpg`)
        if (wynik === 'brak-bucketa') {
          brakBucketaSkanow = true
          C().ustaw({
            status: 'blad',
            blad:
              'Magazyn skanów nie jest gotowy - uruchom raz w Supabase skrypt supabase/amico-skany.sql. Do tego czasu skany zostają w bazie i przy dużej liczbie mogą blokować zapis w chmurze.',
          })
          return
        }
        if (wynik === 'ok') mapa.set(str, `${ws}/${s.id}-${i}.jpg`)
      }
      if (!mapa.size) continue // offline / nic sie nie wgralo - zostawiamy base64 na pozniej

      // FAZA 2: READ-MODIFY-WRITE na AKTUALNYM rekordzie (moze byc juz inny niz snapshot).
      const akt = useStore.getState().baza.skany.find((x) => x.id === s.id)
      if (!akt) continue // skan usuniety w miedzyczasie - USZANUJ usuniecie, nie wskrzeszaj
      const aktStrony = akt.strony || []
      const noweStrony = aktStrony.map((p) => mapa.get(p) || p) // podmien TYLKO realnie wgrane base64
      if (noweStrony.some((p, i) => p !== aktStrony[i]))
        useStore.getState().upsert('skany', { ...akt, strony: noweStrony })
    }
  } finally {
    offloadWTrakcie = false
  }
}

export async function zmienRoleWChmurze(userId: string, rola: Rola) {
  const ws = C().workspaceId
  if (!ws) return
  const { error } = await supabase.rpc('amico_set_role', { p_user: userId, p_workspace: ws, p_rola: rola })
  if (error) throw error
}

// Odbiera pracownikowi dostep do danych firmy w chmurze. Bez tego usuniecie osoby
// w aplikacji kasowalo tylko lokalny wpis - w bazie miala dalej prawo odczytu i zapisu,
// a jej konto "zmartwychwstawalo" przy nastepnym logowaniu.
// Wymaga funkcji amico_remove_member z supabase/amico-poprawki-2.sql.
export async function usunCzlonkaZChmury(userId: string) {
  const ws = C().workspaceId
  if (!ws) return
  const { error } = await supabase.rpc('amico_remove_member', { p_user: userId, p_workspace: ws })
  if (error) throw error
}

// Lokalne konto (hash hasla/PIN zostaje TYLKO na urzadzeniu - nie trafia do chmury)
export async function zsynchronizujUzytkownikaLokalnie(opts: {
  id: string
  imie: string
  email: string
  rola: Rola
  haslo: string
  // Konto zalozone LOKALNIE przed polaczeniem z chmura. Po polaczeniu ta sama osoba
  // dostawala drugi wpis (inne id) i widniala na liscie uzytkownikow dwa razy.
  // Przenosimy PIN/biometrie na konto chmurowe i kasujemy stary wpis.
  zastapId?: string
}): Promise<string> {
  const st = useStore.getState()
  const stary =
    opts.zastapId && opts.zastapId !== opts.id ? st.baza.uzytkownicy.find((u) => u.id === opts.zastapId) : undefined
  const istniejacy = st.baza.uzytkownicy.find((u) => u.id === opts.id) || stary
  const sol = istniejacy?.salt || losowaSol()
  const u: Uzytkownik = {
    id: opts.id,
    // Przy zwyklym logowaniu nie ma pola "Imie i nazwisko" - wtedy zostawiamy
    // imie, ktore juz znamy. Adres e-mail jako imie to ostatecznosc.
    imie: opts.imie || istniejacy?.imie || opts.email || 'Użytkownik',
    email: opts.email,
    rola: opts.rola,
    hasloHash: await hashHasla(opts.haslo, sol),
    salt: sol,
    pinHash: istniejacy?.pinHash,
    pinSalt: istniejacy?.pinSalt,
    webauthnId: istniejacy?.webauthnId,
    kolor: istniejacy?.kolor || '#3a4a7a',
    // NIE wymuszamy true przy kazdym logowaniu - inaczej dezaktywowany pracownik
    // reaktywuje sam siebie, a zmiana rozjezdza sie na wszystkie urzadzenia.
    aktywny: istniejacy?.aktywny !== false,
    utworzono: istniejacy?.utworzono || nowISO(),
  }
  st.upsert('uzytkownicy', u)
  if (stary) st.remove('uzytkownicy', stary.id)
  zapiszOstatniego(u.id)
  return u.id
}

// ---------- Stan ----------
async function pobierzStan(ws: string): Promise<{ data: any; rev: number } | null> {
  const { data, error } = await supabase.from('amico_state').select('data, rev').eq('workspace_id', ws).maybeSingle()
  if (error) throw error
  if (!data) return null
  return { data: data.data, rev: Number(data.rev) }
}

// Tanie pobranie SAMEGO numeru wersji (bez calej bazy) - do heartbeatu wykrywajacego
// zmiany z innych urzadzen, gdyby kanal realtime cicho padl (czeste na iPhone).
async function pobierzRev(ws: string): Promise<number | null> {
  try {
    const { data, error } = await supabase.from('amico_state').select('rev').eq('workspace_id', ws).maybeSingle()
    if (error || !data) return null
    return Number(data.rev)
  } catch {
    return null
  }
}

let stosujeZdalne = false
let timer: ReturnType<typeof setTimeout> | null = null
let wTrakcie = false
let brudne = false
let proby = 0
let ostatniSukces = 0 // znacznik ostatniego UDANEGO zapisu (okno laski dla banera bledu)
let heartbeat: ReturnType<typeof setInterval> | null = null
let unsubStore: (() => void) | null = null
let kanal: ReturnType<typeof supabase.channel> | null = null

function zaplanujZapis(opoznienie = 1200) {
  brudne = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void zapisz(), opoznienie)
}

async function zapisz(): Promise<void> {
  const ws = C().workspaceId
  if (!ws) return
  if (wTrakcie) {
    brudne = true
    return
  }
  // UWAGA: NIE blokujemy zapisu na podstawie navigator.onLine. Na iPhone w trybie PWA
  // ta flaga czesto KLAMIE (pokazuje offline mimo dzialajacego internetu - po uspieniu
  // aplikacji, przelaczeniu WiFi/LTE). Zamiast blokowac, PROBUJEMY zapisac; jesli fetch
  // naprawde padnie, obsluzy to blok catch (z oknem laski, bez straszenia banerem).

  wTrakcie = true
  brudne = false
  C().ustaw({ status: 'zapisywanie' })
  let blad: any = null

  try {
    for (let i = 0; i < 4; i++) {
      const doWyslania = bezSekretow(useStore.getState().baza)
      // Rozmiar liczymy strumieniowo (bez budowania 25+ MB stringa tylko dla licznika).
      C().ustaw({ rozmiarKB: Math.round(rozmiarBajtowPrzybl(doWyslania) / 1024) })

      const { data, error } = await supabase.rpc('amico_save_state', {
        p_workspace: ws,
        p_data: doWyslania,
        p_rev: getRev(ws),
      })
      if (error) throw error
      const r: any = Array.isArray(data) ? data[0] : data

      if (r?.ok) {
        setRev(ws, Number(r.rev))
        proby = 0
        ostatniSukces = Date.now()
        C().ustaw({ status: 'ok', ostatniZapis: nowISO(), blad: null })
        return
      }

      // Konflikt - ktos zapisal w miedzyczasie: scal i ponow
      setRev(ws, Number(r?.rev || 0))
      const scalona = scalBaze(useStore.getState().baza, (r?.data || {}) as Baza)
      stosujeZdalne = true
      useStore.getState().zastapBaze(scalona)
      stosujeZdalne = false
    }
    throw new Error('Nie udało się rozwiązać konfliktu zapisu')
  } catch (e: any) {
    blad = e
    // Diagnostyka: pelny bled do konsoli (kod/detale/hint + rozmiar bazy) - zeby przyczyne
    // dalo sie ustalic, a nie zgadywac. Widoczne w konsoli przegladarki / na desktopie.
    console.error(
      'AMICO chmura - blad zapisu:',
      e?.message || e,
      '| code:', e?.code,
      '| details:', e?.details,
      '| hint:', e?.hint,
      '| rozmiarKB:', useCloud.getState().rozmiarKB,
    )
    // Gdy przyczyna to ROZMIAR (limit 20 MB), pokazujemy CO realnie zajmuje baze - zeby nie
    // szukac po omacku (skany vs podpisy vs logo). Winne moga byc nie tylko skany.
    if (/payload|too large|\b413\b|przekracz|dozwolony rozmiar|20\s?mb|\bsize\b/i.test(String(e?.message || e)))
      console.error('AMICO chmura - co zajmuje baze (KB):', diagnozaRozmiaruBazy())
    brudne = true // NIGDY nie gubimy zmian
    if (czyBladSesji(e)) {
      wTrakcie = false
      await obsluzWygaslaSesje() // bez sensu ponawiac - trzeba sie zalogowac
      return
    }
    // OKNO LASKI: przelotne bledy (przelaczenie sieci, uspienie iPhone, chwilowy konflikt
    // przy wielu urzadzeniach) ponawiamy CICHO - status zostaje 'zapisywanie', bez
    // straszacego banera. Baner ("Nie udalo sie / brak internetu") pokazujemy DOPIERO gdy
    // problem sie UTRZYMUJE: kilka prob pod rzad LUB dluzej niz ~25 s bez udanego zapisu.
    proby = Math.min(proby + 1, 6)
    const dawnoBezSukcesu = ostatniSukces > 0 && Date.now() - ostatniSukces > 25000
    if (proby >= 4 || dawnoBezSukcesu) {
      const off =
        !navigator.onLine ||
        /failed to fetch|networkerror|network request failed|load failed|timeout/i.test(String(e?.message || e))
      C().ustaw({ status: off ? 'offline' : 'blad', blad: bladPoPolsku(e) })
    } else {
      // ciche ponawianie - nie zmieniamy statusu na bledny (zostaje 'zapisywanie')
      C().ustaw({ status: 'zapisywanie' })
    }
  } finally {
    wTrakcie = false
    if (blad && useCloud.getState().status !== 'sesja') {
      // ponawiaj z narastajacym opoznieniem (5xx/timeout NIE emituje zdarzenia 'online')
      zaplanujZapis(Math.min(30000, 1200 * 2 ** Math.min(proby, 5)))
    } else if (!blad && brudne) {
      zaplanujZapis()
    }
  }
}

// Pobierz z serwera i scal z lokalnym; wypchnij, jesli scalenie wniosło cokolwiek nowego
async function pobierzIScal(ws: string) {
  const zdalny = await pobierzStan(ws)
  if (!zdalny) {
    zaplanujZapis(0)
    return
  }
  setRev(ws, zdalny.rev)

  if (pustyStan(zdalny.data)) {
    zaplanujZapis(0) // serwer pusty - wyslij to, co mamy lokalnie
    return
  }

  const scalona = scalBaze(useStore.getState().baza, zdalny.data as Baza)
  stosujeZdalne = true
  useStore.getState().zastapBaze(scalona)
  stosujeZdalne = false

  // WAZNE: zastapBaze URUCHAMIA migruj (usuniecie firma_milena, przepiecie rekordow,
  // normalizacja tablic) i zapisuje WYNIK. Porownujemy zatem to, co REALNIE zapisano
  // (po migracji), a nie `scalona` sprzed migracji - inaczej sprzatanie migracji nie
  // zostaloby wypchniete do chmury i stan lokalny rozjezdzalby sie z serwerem.
  const zapisanyHash = stabilnyHash(bezSekretow(useStore.getState().baza))
  // Szybka sciezka: gdy stan lokalny = surowa migawka zdalna, nie ma co wysylac (typowy
  // stan ustabilizowany - unikamy drugiego migruj na duzej bazie ze skanami base64).
  let rozne = zapisanyHash !== stabilnyHash(zdalny.data)
  // Dopiero gdy sie roznia, sprawdzamy czy to NIE jest wylacznie efekt mechanicznej
  // migracji (usuniecie firma_milena, przepiecie firmaId, normalizacja tablic) - porownujac
  // ze ZNORMALIZOWANA (po migruj) migawka zdalna. Inaczej sama migracja wypychalaby CALA
  // baze w kolko (petla zapisow przy mieszanej flocie). Realne zmiany dalej sie wysylaja.
  if (rozne) rozne = zapisanyHash !== stabilnyHash(bezSekretow(migruj(zdalny.data as Baza)))
  if (rozne) zaplanujZapis(300)
  else C().ustaw({ status: 'ok', ostatniZapis: nowISO(), blad: null })
}

// Koalescencja: wznowienie PWA na iPhone odpala 'visibilitychange' + 'focus' + realtime
// SUBSCRIBED niemal jednoczesnie. Bez tego kazde z nich ciagnie i scala CALA baze osobno
// (2-4x) -> zbedne skoki CPU/pamieci i transfer. Gdy pobranie juz trwa, oddajemy te sama
// obietnice zamiast startowac kolejne.
let pobierzWTrakcie: Promise<void> | null = null
function pobierzIScalRaz(ws: string): Promise<void> {
  if (pobierzWTrakcie) return pobierzWTrakcie
  pobierzWTrakcie = pobierzIScal(ws).finally(() => {
    pobierzWTrakcie = null
  })
  return pobierzWTrakcie
}
// Pelna baze ciagniemy TYLKO gdy serwer ma nowsza wersje - inaczej tanie sprawdzenie rev.
async function dogonJesliNowszy(ws: string): Promise<void> {
  const r = await pobierzRev(ws)
  if (r != null && r > getRev(ws)) await pobierzIScalRaz(ws)
  else C().ustaw({ status: 'ok', blad: null })
}

// Dane lokalne naleza do INNEJ firmy - nie wolno ich wmieszac. Bierzemy stan zdalny.
async function zastapLokalneZdalnym(ws: string) {
  const zdalny = await pobierzStan(ws)
  const nowa = zdalny && !pustyStan(zdalny.data) ? (zdalny.data as Baza) : pustaBaza()
  setRev(ws, zdalny?.rev ?? 0)
  stosujeZdalne = true
  useStore.getState().zastapBaze(nowa)
  stosujeZdalne = false
}

// ---------- Nasluch (musi dzialac nawet gdy start padnie offline) ----------
function podlaczNasluch() {
  unsubStore?.()
  unsubStore = useStore.subscribe((s, prev) => {
    if (s.baza !== prev.baza && !stosujeZdalne) zaplanujZapis()
  })
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onWznowienie)
  window.removeEventListener('focus', onWznowienie)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
  document.addEventListener('visibilitychange', onWznowienie)
  window.addEventListener('focus', onWznowienie)
}

function onOnline() {
  if (C().workspaceId) zaplanujZapis(200)
  else void startSync() // start byl offline - bootstrap sie nie udal, ponow
}
// Zdarzenie 'offline' na iPhone bywa FALSZYWE (usypianie PWA, przelaczanie sieci), wiec
// NIE strasymy od razu banerem. Prawdziwy brak sieci pokaze OKNO LASKI, gdy zapis
// naprawde padnie kilka razy pod rzad (patrz blok catch w zapisz()).
function onOffline() {
  /* celowo nic */
}

// Powrot aplikacji na pierwszy plan. iPhone usypia PWA - gasnie kanal realtime i wiszace
// zapytania. Po wznowieniu odswiezamy realtime, dogniamy zmiany z chmury i wypychamy
// ewentualne lokalne zmiany, ktore nie zdazyly sie zapisac.
function onWznowienie() {
  if (document.visibilityState === 'hidden') return
  const ws = C().workspaceId
  if (!ws) {
    void startSync()
    return
  }
  zresetujBrakBucketaSkanow() // uzytkownik mogl w miedzyczasie uruchomic amico-skany.sql
  podlaczRealtime(ws)
  dogonJesliNowszy(ws).catch(() => {}) // tanio: pelna baza tylko gdy serwer nowszy
  zaplanujZapis(300)
  offloadSkany().catch(() => {})
}

function podlaczRealtime(ws: string) {
  kanal?.unsubscribe()
  kanal = supabase
    .channel(`amico_state_${ws}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'amico_state', filter: `workspace_id=eq.${ws}` },
      async (payload: any) => {
        const nowaRev = Number(payload?.new?.rev ?? 0)
        if (nowaRev && nowaRev <= getRev(ws)) return // to nasz wlasny zapis
        try {
          await pobierzIScalRaz(ws)
        } catch {
          /* ponowimy przy nastepnej zmianie */
        }
      },
    )
    .subscribe((status) => {
      // Po (ponownym) podlaczeniu kanalu dogniamy zmiany, ktore mogly uciec, gdy kanal
      // byl zerwany (uspienie iPhone) - ale TANIO (rev), bez bezwarunkowego ciagniecia
      // calej bazy. Ewentualne bledy kanalu lata heartbeat i wznowienie.
      if (status === 'SUBSCRIBED') dogonJesliNowszy(ws).catch(() => {})
    })
}

// Heartbeat: co ~45 s (tylko gdy apka widoczna) sprawdzamy TANIO numer wersji na serwerze.
// Jesli inne urzadzenie coś zmienilo (rev wyzszy) - dogniamy zmiany, choćby realtime padl.
// Przy okazji dopychamy lokalne zmiany, ktore z jakiegos powodu jeszcze nie poszly.
function startHeartbeat(ws: string) {
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = setInterval(() => {
    if (document.visibilityState === 'hidden' || !C().workspaceId) return
    pobierzRev(ws).then((r) => {
      if (r != null && r > getRev(ws)) pobierzIScalRaz(ws).catch(() => {})
    })
    if (brudne) zaplanujZapis(200)
    offloadSkany().catch(() => {}) // dogon skany, ktore jeszcze nie trafily do magazynu
  }, 45000)
}

// ---------- Start / stop ----------
export async function startSync(imie = '') {
  const sesja = await sesjaChmury()
  if (!sesja) {
    C().ustaw({ status: 'off' })
    return
  }
  C().ustaw({ status: 'laczenie', email: sesja.user.email || null, blad: null })
  zresetujBrakBucketaSkanow() // nowe polaczenie - sprobuj offloadu jeszcze raz (mogl powstac bucket)

  // KRYTYCZNE: nasluch podpinamy PRZED operacjami sieciowymi.
  // Gdyby bootstrap padl (brak sieci), zmiany i tak beda kolejkowane i wysla sie po powrocie online.
  podlaczNasluch()

  try {
    const { workspaceId, rola, joinCode } = await ustalWorkspace(imie)
    C().ustaw({ workspaceId, rola, joinCode })

    const poprzedniWs = getBazaWs()
    if (poprzedniWs && poprzedniWs !== workspaceId) {
      await zastapLokalneZdalnym(workspaceId) // ochrona przed wyciekiem miedzy firmami
    } else {
      await pobierzIScal(workspaceId)
    }
    setBazaWs(workspaceId)

    podlaczRealtime(workspaceId)
    startHeartbeat(workspaceId)
    await zapisz()
    // Przenies obrazy skanow do magazynu plikow (odchudza baze, zeby zapis nie wpadal na
    // limit 20 MB). Po przeniesieniu baza sie kurczy i zapis znow dziala.
    offloadSkany().catch(() => {})
  } catch (e: any) {
    if (czyBladSesji(e)) {
      await obsluzWygaslaSesje()
      return
    }
    C().ustaw({
      status: navigator.onLine ? 'blad' : 'offline',
      blad: bladPoPolsku(e),
    })
  }
}

export function stopSync() {
  if (timer) clearTimeout(timer)
  timer = null
  if (heartbeat) clearInterval(heartbeat)
  heartbeat = null
  unsubStore?.()
  unsubStore = null
  kanal?.unsubscribe()
  kanal = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
  document.removeEventListener('visibilitychange', onWznowienie)
  window.removeEventListener('focus', onWznowienie)
}

export async function wymusZapis() {
  brudne = true
  await zapisz()
}
