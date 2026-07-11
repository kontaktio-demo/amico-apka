import { create } from 'zustand'
import { supabase } from './supabase'
import { useStore } from './store'
import { scalBaze, pustyStan } from './merge'
import type { Baza, Rola, Uzytkownik } from './types'
import { hashHasla, losowaSol, zapiszOstatniego } from './auth'
import { nowISO } from './format'

// ============================================================================
// AMICO – synchronizacja z chmura (Supabase).
// Model: cala baza firmy = jeden dokument JSON + licznik wersji (rev).
// Zapis: CAS (compare-and-swap). Konflikt -> scalenie i ponowna proba.
// ============================================================================

export type SyncStatus = 'off' | 'laczenie' | 'ok' | 'zapisywanie' | 'offline' | 'blad'

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

// ---------- rev (wersja serwera) ----------
const revKey = (ws: string) => `amico-rev-${ws}`
const getRev = (ws: string): number => Number(localStorage.getItem(revKey(ws)) || 0)
const setRev = (ws: string, r: number) => localStorage.setItem(revKey(ws), String(r))

// ---------- Sesja / logowanie ----------
export async function sesjaChmury() {
  const { data } = await supabase.auth.getSession()
  return data.session
}

export async function zarejestrujChmura(email: string, haslo: string) {
  const { data, error } = await supabase.auth.signUp({ email, password: haslo })
  if (error) throw error
  // Gdy w projekcie wlaczone jest potwierdzanie e-mail, sesji nie bedzie od razu
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
  stopSync()
  await supabase.auth.signOut()
  C().ustaw({ status: 'off', email: null, workspaceId: null, joinCode: null, rola: null, blad: null })
}

// Zaklada firme (jesli user nie nalezy do zadnej) lub zwraca istniejaca
export async function bootstrapFirmy(imie: string) {
  const { data, error } = await supabase.rpc('amico_bootstrap', { p_imie: imie })
  if (error) throw error
  const r = Array.isArray(data) ? data[0] : data
  if (!r) throw new Error('Nie udało się przygotować firmy w chmurze')
  return { workspaceId: r.workspace_id as string, rola: r.rola as Rola, joinCode: r.join_code as string }
}

// Dolaczenie pracownika kodem firmy
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

// Tworzy/aktualizuje LOKALNE konto (zeby dzialalo odblokowanie PIN/haslem offline)
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

// ---------- Pobieranie / zapis stanu ----------
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
let unsubStore: (() => void) | null = null
let kanal: ReturnType<typeof supabase.channel> | null = null

function zaplanujZapis() {
  brudne = true
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => void zapisz(), 1200)
}

async function zapisz() {
  const ws = C().workspaceId
  if (!ws) return
  if (wTrakcie) {
    brudne = true
    return
  }
  if (!navigator.onLine) {
    C().ustaw({ status: 'offline' })
    return
  }
  wTrakcie = true
  brudne = false
  C().ustaw({ status: 'zapisywanie' })

  try {
    for (let i = 0; i < 4; i++) {
      const baza = useStore.getState().baza
      const rev = getRev(ws)
      const json = JSON.stringify(baza)
      C().ustaw({ rozmiarKB: Math.round(json.length / 1024) })

      const { data, error } = await supabase.rpc('amico_save_state', {
        p_workspace: ws,
        p_data: baza,
        p_rev: rev,
      })
      if (error) throw error
      const r: any = Array.isArray(data) ? data[0] : data

      if (r?.ok) {
        setRev(ws, Number(r.rev))
        C().ustaw({ status: 'ok', ostatniZapis: nowISO(), blad: null })
        break
      }

      // Konflikt – ktos zapisal w miedzyczasie. Scal i sprobuj ponownie.
      const serwer = r?.data as Baza
      setRev(ws, Number(r?.rev || 0))
      const scalona = scalBaze(useStore.getState().baza, serwer)
      stosujeZdalne = true
      useStore.getState().zastapBaze(scalona)
      stosujeZdalne = false
      if (i === 3) throw new Error('Nie udało się rozwiązać konfliktu zapisu')
    }
  } catch (e: any) {
    C().ustaw({ status: 'blad', blad: e?.message || 'Błąd zapisu do chmury' })
  } finally {
    wTrakcie = false
    if (brudne) zaplanujZapis()
  }
}

async function pobierzIScal(ws: string) {
  const zdalny = await pobierzStan(ws)
  if (!zdalny) return
  setRev(ws, zdalny.rev)
  if (pustyStan(zdalny.data)) return
  const scalona = scalBaze(useStore.getState().baza, zdalny.data as Baza)
  stosujeZdalne = true
  useStore.getState().zastapBaze(scalona)
  stosujeZdalne = false
}

// ---------- Start / stop synchronizacji ----------
export async function startSync(imie = '') {
  const sesja = await sesjaChmury()
  if (!sesja) {
    C().ustaw({ status: 'off' })
    return
  }
  C().ustaw({ status: 'laczenie', email: sesja.user.email || null, blad: null })

  try {
    const { workspaceId, rola, joinCode } = await bootstrapFirmy(imie)
    C().ustaw({ workspaceId, rola, joinCode })

    // 1) pobierz z serwera i scal z lokalnym
    await pobierzIScal(workspaceId)

    // 2) wypchnij scalony stan (albo pierwszy zapis)
    await zapisz()

    // 3) realtime – zmiany z innych urzadzen
    kanal?.unsubscribe()
    kanal = supabase
      .channel(`amico_state_${workspaceId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'amico_state', filter: `workspace_id=eq.${workspaceId}` },
        async (payload: any) => {
          const nowaRev = Number(payload?.new?.rev || 0)
          if (nowaRev <= getRev(workspaceId)) return // to nasz wlasny zapis
          try {
            await pobierzIScal(workspaceId)
            C().ustaw({ status: 'ok', ostatniZapis: nowISO() })
          } catch {
            /* ignoruj */
          }
        },
      )
      .subscribe()

    // 4) nasluchuj zmian lokalnych -> zapis (z debouncem)
    unsubStore?.()
    unsubStore = useStore.subscribe((s, prev) => {
      if (s.baza !== prev.baza && !stosujeZdalne) zaplanujZapis()
    })

    // 5) online/offline
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  } catch (e: any) {
    C().ustaw({ status: 'blad', blad: e?.message || 'Błąd połączenia z chmurą' })
  }
}

function onOnline() {
  if (C().workspaceId) zaplanujZapis()
}
function onOffline() {
  C().ustaw({ status: 'offline' })
}

export function stopSync() {
  if (timer) clearTimeout(timer)
  unsubStore?.()
  unsubStore = null
  kanal?.unsubscribe()
  kanal = null
  window.removeEventListener('online', onOnline)
  window.removeEventListener('offline', onOffline)
}

// Reczne wymuszenie zapisu (przycisk w Ustawieniach)
export async function wymusZapis() {
  await zapisz()
}
