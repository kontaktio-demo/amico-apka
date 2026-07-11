import { create } from 'zustand'
import { supabase } from './supabase'
import { useStore } from './store'
import { scalBaze, pustyStan, bezSekretow } from './merge'
import { pustaBaza } from './seed'
import type { Baza, Rola, Uzytkownik } from './types'
import { hashHasla, losowaSol, zapiszOstatniego } from './auth'
import { nowISO } from './format'

// ============================================================================
// AMICO – synchronizacja z chmura (Supabase).
// Model: cala baza firmy = jeden dokument JSON + licznik wersji (rev).
// Zapis: CAS (compare-and-swap). Konflikt -> scalenie -> ponowna proba.
// Zasada nadrzedna: ZADNA zmiana nie moze zginac ani zostac cicho nadpisana.
// ============================================================================

export type SyncStatus = 'off' | 'laczenie' | 'ok' | 'zapisywanie' | 'offline' | 'blad' | 'sesja'

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

// Sesja przestala byc wazna – przestajemy sie dobijac i prosimy o ponowne logowanie.
// Dane lokalne zostaja nietkniete.
async function obsluzWygaslaSesje() {
  stopSync()
  try {
    await supabase.auth.signOut()
  } catch {
    /* ignore */
  }
  useCloud.getState().ustaw({
    status: 'sesja',
    workspaceId: null,
    blad: 'Sesja w chmurze wygasła – zaloguj się ponownie (Ustawienia → Chmura). Twoje dane są bezpieczne na urządzeniu.',
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
  localStorage.removeItem(WS_KEY)
  await supabase.auth.signOut()
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

export async function zmienRoleWChmurze(userId: string, rola: Rola) {
  const ws = C().workspaceId
  if (!ws) return
  const { error } = await supabase.rpc('amico_set_role', { p_user: userId, p_workspace: ws, p_rola: rola })
  if (error) throw error
}

// Lokalne konto (hash hasla/PIN zostaje TYLKO na urzadzeniu – nie trafia do chmury)
export async function zsynchronizujUzytkownikaLokalnie(opts: {
  id: string
  imie: string
  email: string
  rola: Rola
  haslo: string
}): Promise<string> {
  const st = useStore.getState()
  const istniejacy = st.baza.uzytkownicy.find((u) => u.id === opts.id)
  const sol = istniejacy?.salt || losowaSol()
  const u: Uzytkownik = {
    id: opts.id,
    imie: opts.imie || istniejacy?.imie || 'Użytkownik',
    email: opts.email,
    rola: opts.rola,
    hasloHash: await hashHasla(opts.haslo, sol),
    salt: sol,
    pinHash: istniejacy?.pinHash,
    pinSalt: istniejacy?.pinSalt,
    webauthnId: istniejacy?.webauthnId,
    kolor: istniejacy?.kolor || '#3a4a7a',
    aktywny: true,
    utworzono: istniejacy?.utworzono || nowISO(),
  }
  st.upsert('uzytkownicy', u)
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

let stosujeZdalne = false
let timer: ReturnType<typeof setTimeout> | null = null
let wTrakcie = false
let brudne = false
let proby = 0
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
  if (!navigator.onLine) {
    brudne = true // zapiszemy po powrocie sieci
    C().ustaw({ status: 'offline' })
    return
  }

  wTrakcie = true
  brudne = false
  C().ustaw({ status: 'zapisywanie' })
  let blad: any = null

  try {
    for (let i = 0; i < 4; i++) {
      const doWyslania = bezSekretow(useStore.getState().baza)
      const json = JSON.stringify(doWyslania)
      C().ustaw({ rozmiarKB: Math.round(json.length / 1024) })

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
        C().ustaw({ status: 'ok', ostatniZapis: nowISO(), blad: null })
        return
      }

      // Konflikt – ktos zapisal w miedzyczasie: scal i ponow
      setRev(ws, Number(r?.rev || 0))
      const scalona = scalBaze(useStore.getState().baza, (r?.data || {}) as Baza)
      stosujeZdalne = true
      useStore.getState().zastapBaze(scalona)
      stosujeZdalne = false
    }
    throw new Error('Nie udało się rozwiązać konfliktu zapisu')
  } catch (e: any) {
    blad = e
    brudne = true // NIGDY nie gubimy zmian
    if (czyBladSesji(e)) {
      wTrakcie = false
      await obsluzWygaslaSesje() // bez sensu ponawiac – trzeba sie zalogowac
      return
    }
    C().ustaw({
      status: navigator.onLine ? 'blad' : 'offline',
      blad: e?.message || 'Błąd zapisu do chmury',
    })
  } finally {
    wTrakcie = false
    if (blad && useCloud.getState().status !== 'sesja') {
      // ponawiaj z narastajacym opoznieniem (5xx/timeout NIE emituje zdarzenia 'online')
      proby = Math.min(proby + 1, 5)
      zaplanujZapis(Math.min(30000, 1500 * 2 ** proby))
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
    zaplanujZapis(0) // serwer pusty – wyslij to, co mamy lokalnie
    return
  }

  const scalona = scalBaze(useStore.getState().baza, zdalny.data as Baza)
  stosujeZdalne = true
  useStore.getState().zastapBaze(scalona)
  stosujeZdalne = false

  // Czy scalony stan rozni sie od serwera? Jesli tak – mamy lokalne rekordy do wyslania.
  const rozne = JSON.stringify(bezSekretow(scalona)) !== JSON.stringify(zdalny.data)
  if (rozne) zaplanujZapis(300)
  else C().ustaw({ status: 'ok', ostatniZapis: nowISO(), blad: null })
}

// Dane lokalne naleza do INNEJ firmy – nie wolno ich wmieszac. Bierzemy stan zdalny.
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
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)
}

function onOnline() {
  if (C().workspaceId) zaplanujZapis(200)
  else void startSync() // start byl offline – bootstrap sie nie udal, ponow
}
function onOffline() {
  C().ustaw({ status: 'offline' })
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
          await pobierzIScal(ws)
        } catch {
          /* ponowimy przy nastepnej zmianie */
        }
      },
    )
    .subscribe()
}

// ---------- Start / stop ----------
export async function startSync(imie = '') {
  const sesja = await sesjaChmury()
  if (!sesja) {
    C().ustaw({ status: 'off' })
    return
  }
  C().ustaw({ status: 'laczenie', email: sesja.user.email || null, blad: null })

  // KRYTYCZNE: nasluch podpinamy PRZED operacjami sieciowymi.
  // Gdyby bootstrap padl (brak sieci), zmiany i tak beda kolejkowane i wysla sie po powrocie online.
  podlaczNasluch()

  try {
    const { workspaceId, rola, joinCode } = await bootstrapFirmy(imie)
    C().ustaw({ workspaceId, rola, joinCode })

    const poprzedniWs = getBazaWs()
    if (poprzedniWs && poprzedniWs !== workspaceId) {
      await zastapLokalneZdalnym(workspaceId) // ochrona przed wyciekiem miedzy firmami
    } else {
      await pobierzIScal(workspaceId)
    }
    setBazaWs(workspaceId)

    podlaczRealtime(workspaceId)
    await zapisz()
  } catch (e: any) {
    if (czyBladSesji(e)) {
      await obsluzWygaslaSesje()
      return
    }
    C().ustaw({
      status: navigator.onLine ? 'blad' : 'offline',
      blad: e?.message || 'Błąd połączenia z chmurą',
    })
  }
}

export function stopSync() {
  if (timer) clearTimeout(timer)
  timer = null
  unsubStore?.()
  unsubStore = null
  kanal?.unsubscribe()
  kanal = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
}

export async function wymusZapis() {
  brudne = true
  await zapisz()
}
