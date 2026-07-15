import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Delete, Fingerprint, LogIn, UserPlus, KeyRound, ArrowLeft, Cloud, Users } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Uzytkownik, Rola } from '../lib/types'
import { initials } from '../lib/format'
import {
  sprawdzHaslo,
  hashPin,
  sprawdzPin,
  losowaSol,
  zapiszOstatniego,
  ostatniUzytkownik,
  wyczyscOstatniego,
  biometriaDostepna,
  zarejestrujBiometrie,
  odblokujBiometria,
  nazwaRoli,
} from '../lib/auth'
import { Logo } from './Logo'
import { Field, Input } from './ui'
import { CloudPanel, type Tryb } from './CloudPanel'

interface AuthCtx {
  user: Uzytkownik | null
  lock: () => void
  logout: () => void
  // Przelacza zalogowanego uzytkownika na inne konto (np. gdy po polaczeniu z chmura
  // lokalne konto dostaje nowy identyfikator z chmury).
  przelogujNa: (id: string) => void
}
const Ctx = createContext<AuthCtx>({ user: null, lock: () => {}, logout: () => {}, przelogujNa: () => {} })
export const useAuth = () => useContext(Ctx)

type Widok = 'loading' | 'onboarding' | 'login' | 'lock' | 'in'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const uzytkownicy = useStore((s) => s.baza.uzytkownicy)
  const hydrated = useStore((s) => s.hydrated)
  const [widok, setWidok] = useState<Widok>('loading')
  const [userId, setUserId] = useState<string | null>(null)
  const zdecydowano = useRef(false)

  // Decyzja o ekranie startowym – TYLKO raz, po wczytaniu bazy.
  useEffect(() => {
    if (!hydrated || zdecydowano.current) return
    zdecydowano.current = true
    if (uzytkownicy.length === 0) {
      setWidok('onboarding')
      return
    }
    const last = ostatniUzytkownik()
    // Nieaktywne konto (wylaczone przez wlasciciela) nie moze wejsc nawet PIN-em.
    if (last && uzytkownicy.some((u) => u.id === last && u.aktywny !== false)) {
      setUserId(last)
      setWidok('lock')
    } else {
      setWidok('login')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated])

  const user = useMemo(() => uzytkownicy.find((u) => u.id === userId) || null, [uzytkownicy, userId])

  // Konto moglo zniknac w trakcie pracy (usuniete na innym urzadzeniu i przyszlo
  // przez synchronizacje). Bez tego zostawalby pusty ekran, z ktorego nie dalo sie
  // wyjsc bez odswiezenia. Wracamy na ekran logowania/zakladania konta.
  // UWAGA: dajemy krotka chwile, bo przy laczeniu konta z chmura lokalne id na moment
  // znika, zanim przelogujNa ustawi nowe (chmurowe) id - bez opoznienia wyrzucaloby
  // uzytkownika na login dokladnie w chwili laczenia z chmura.
  useEffect(() => {
    if (!(widok === 'in' && userId && !user)) return
    const t = setTimeout(() => {
      const st = useStore.getState().baza.uzytkownicy
      if (!st.some((u) => u.id === userId)) {
        wyczyscOstatniego()
        setUserId(null)
        setWidok(st.length ? 'login' : 'onboarding')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [widok, userId, user, uzytkownicy.length])

  // Auto-blokada po bezczynnosci (5 min) – ochrona przy zgubieniu urzadzenia
  useEffect(() => {
    if (widok !== 'in') return
    let t: ReturnType<typeof setTimeout>
    const reset = () => {
      clearTimeout(t)
      t = setTimeout(() => setWidok('lock'), 5 * 60 * 1000)
    }
    const evs: (keyof WindowEventMap)[] = ['pointerdown', 'keydown', 'pointermove', 'touchstart', 'wheel']
    evs.forEach((e) => window.addEventListener(e, reset, { passive: true }))
    reset()
    return () => {
      clearTimeout(t)
      evs.forEach((e) => window.removeEventListener(e, reset))
    }
  }, [widok])

  const zaloguj = (id: string) => {
    setUserId(id)
    zapiszOstatniego(id)
    setWidok('in')
  }
  // Zmiana biezacego konta bez wychodzenia z aplikacji (np. lokalne id -> chmurowe id
  // po polaczeniu z chmura). Zostajemy zalogowani.
  const przelogujNa = (id: string) => {
    setUserId(id)
    zapiszOstatniego(id)
    setWidok('in')
  }
  const lock = () => setWidok(user ? 'lock' : 'login')
  const logout = () => {
    wyczyscOstatniego()
    setUserId(null)
    setWidok(uzytkownicy.length ? 'login' : 'onboarding')
  }

  const ctx: AuthCtx = { user, lock, logout, przelogujNa }

  if (widok === 'loading') return null
  if (widok === 'in' && user) return <Ctx.Provider value={ctx}>{children}</Ctx.Provider>

  return (
    <AuthShell>
      {widok === 'onboarding' && <PierwszeUruchomienie onDone={zaloguj} />}
      {widok === 'login' && (
        <>
          <Login onLogin={zaloguj} />
          <ChmuraLogowanie onZalogowano={zaloguj} />
        </>
      )}
      {widok === 'lock' && user && (
        <Lock user={user} onUnlock={() => setWidok('in')} onSwitch={() => setWidok('login')} />
      )}
    </AuthShell>
  )
}

// ---------- Pierwsze uruchomienie ----------
// AMICO to wewnetrzny system firmy - KAZDE konto jest kontem w chmurze, zeby te same
// dane byly na wszystkich urzadzeniach (tablet, komputer) i w bazie. Nie ma trybu
// "tylko na tym urzadzeniu" - dane firmy nie moga siedziec w wyspach na jednym sprzecie.
type Wybor = 'menu' | Tryb

function PierwszeUruchomienie({ onDone }: { onDone: (id: string) => void }) {
  const [wybor, setWybor] = useState<Wybor>('menu')

  if (wybor !== 'menu') {
    return (
      <div>
        <button
          className="mb-3 inline-flex items-center gap-1.5 text-[13px] font-medium text-stone-400 hover:text-white"
          onClick={() => setWybor('menu')}
        >
          <ArrowLeft size={14} /> Wróć
        </button>
        <CloudPanel bezRamki onZalogowano={onDone} trybStartowy={wybor} />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[19px] font-display font-semibold text-ink">Witaj w AMICO</h1>
        <p className="mt-1 text-[13px] leading-relaxed text-stone-400">
          Jeśli masz już konto, zaloguj się – zobaczysz te same dane co na pozostałych urządzeniach.
        </p>
      </div>

      <button className="btn-primary w-full btn-lg" onClick={() => setWybor('logowanie')}>
        <Cloud size={18} /> Mam już konto – zaloguj się
      </button>

      <button className="btn-outline w-full" onClick={() => setWybor('rejestracja')}>
        <UserPlus size={17} /> Zakładam AMICO pierwszy raz
      </button>

      <button className="btn-outline w-full" onClick={() => setWybor('dolacz')}>
        <Users size={17} /> Dołączam do firmy (mam kod)
      </button>

      <p className="border-t border-white/10 pt-3 text-center text-[12px] leading-relaxed text-stone-500">
        Do pierwszego logowania potrzebny jest internet. Później aplikacja działa też offline i sama synchronizuje
        zmiany, gdy wróci zasięg.
      </p>
    </div>
  )
}

// Logowanie przez chmure (synchronizacja miedzy urzadzeniami)
function ChmuraLogowanie({ onZalogowano }: { onZalogowano: (id: string) => void }) {
  const [otwarte, setOtwarte] = useState(false)
  if (!otwarte) {
    return (
      <div className="mt-5 border-t border-white/10 pt-4 text-center">
        <button
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-700 transition hover:text-white"
          onClick={() => setOtwarte(true)}
        >
          <Cloud size={14} /> Zaloguj przez chmurę (te same dane na innych urządzeniach)
        </button>
      </div>
    )
  }
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <CloudPanel bezRamki onZalogowano={onZalogowano} />
    </div>
  )
}

function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-full place-items-center px-4 py-10">
      <div className="w-full max-w-sm animate-fade-in">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo tone="light" />
        </div>
        <div className="card card-pad">{children}</div>
        <p className="mt-6 text-center text-[11.5px] text-stone-500">
          Dane firmy są w chmurze i synchronizują się między urządzeniami. Logowanie chroni dostęp do aplikacji.
        </p>
      </div>
    </div>
  )
}

function Avatar({ u, size = 44 }: { u: { imie: string; kolor?: string }; size?: number }) {
  return (
    <span
      className="grid shrink-0 place-items-center rounded-2xl font-semibold text-white"
      style={{ width: size, height: size, background: u.kolor || '#3a4a7a', fontSize: size * 0.36 }}
    >
      {initials(u.imie)}
    </span>
  )
}

// ---------- Login (email + haslo) ----------
function Login({ onLogin }: { onLogin: (id: string) => void }) {
  const wszyscy = useStore((s) => s.baza.uzytkownicy)
  // Tylko konta, ktore mozna odblokowac NA TYM urzadzeniu (maja lokalne haslo)
  // i nie zostaly wylaczone (aktywny !== false). Konta wspolpracownikow przychodza
  // z chmury bez sekretow - te loguja sie przez panel chmury, a nie z tej listy.
  const uzytkownicy = wszyscy.filter((u) => u.hasloHash && u.salt && u.aktywny !== false)
  const [sel, setSel] = useState<string | null>(uzytkownicy.length === 1 ? uzytkownicy[0].id : null)
  const [haslo, setHaslo] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const user = uzytkownicy.find((u) => u.id === sel)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return
    setErr('')
    setBusy(true)
    try {
      const ok = await sprawdzHaslo(haslo, user.salt, user.hasloHash)
      if (ok) onLogin(user.id)
      else setErr('Nieprawidłowe hasło.')
    } catch {
      setErr('Nie udało się zweryfikować hasła. Spróbuj ponownie.')
    } finally {
      setBusy(false)
    }
  }

  if (!user) {
    if (uzytkownicy.length === 0) {
      return (
        <div className="space-y-2">
          <h1 className="text-[18px] font-display font-semibold text-ink">Zaloguj się</h1>
          <p className="text-[13px] leading-relaxed text-stone-400">
            Na tym urządzeniu nie ma jeszcze zapisanego hasła. Zaloguj się przez chmurę tym samym e-mailem i hasłem co
            na pozostałych urządzeniach.
          </p>
        </div>
      )
    }
    return (
      <div className="space-y-3">
        <h1 className="text-[18px] font-display font-semibold text-ink">Wybierz użytkownika</h1>
        <div className="space-y-2">
          {uzytkownicy.map((u) => (
            <button
              key={u.id}
              onClick={() => setSel(u.id)}
              className="flex w-full items-center gap-3 rounded-xl border border-white/10 p-3 text-left transition hover:bg-white/[0.04]"
            >
              <Avatar u={u} />
              <span className="flex-1">
                <span className="block text-[14.5px] font-semibold text-ink">{u.imie}</span>
                <span className="block text-[12px] text-stone-500">{nazwaRoli(u.rola)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <button
        type="button"
        onClick={() => setSel(null)}
        className="flex items-center gap-1.5 text-[12.5px] text-stone-500 hover:text-white"
      >
        <ArrowLeft size={14} /> Zmień użytkownika
      </button>
      <div className="flex items-center gap-3">
        <Avatar u={user} />
        <div>
          <div className="text-[15px] font-semibold text-ink">{user.imie}</div>
          <div className="text-[12px] text-stone-500">{user.email}</div>
        </div>
      </div>
      <Field label="Hasło">
        <Input
          type="password"
          value={haslo}
          onChange={(e) => setHaslo(e.target.value)}
          placeholder="Wpisz hasło"
          autoFocus
        />
      </Field>
      {err && <p className="text-[12.5px] text-red-400">{err}</p>}
      <button className="btn-primary w-full btn-lg" disabled={busy}>
        <LogIn size={18} /> Zaloguj
      </button>
    </form>
  )
}

// ---------- Lock (szybkie odblokowanie) ----------
function Lock({ user, onUnlock, onSwitch }: { user: Uzytkownik; onUnlock: () => void; onSwitch: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [bioOk, setBioOk] = useState(false)
  const [trybHaslo, setTrybHaslo] = useState(!user.pinHash && !user.webauthnId)
  const [haslo, setHaslo] = useState('')
  const [proby, setProby] = useState(0)

  useEffect(() => {
    biometriaDostepna().then((d) => setBioOk(d && !!user.webauthnId))
  }, [user.webauthnId])

  // auto-weryfikacja PIN po 4 cyfrach
  useEffect(() => {
    if (pin.length === 4 && user.pinHash && user.pinSalt) {
      sprawdzPin(pin, user.pinSalt, user.pinHash).then((ok) => {
        if (ok) onUnlock()
        else {
          const n = proby + 1
          setProby(n)
          if (n >= 5) {
            setTrybHaslo(true)
            setErr('Za dużo prób PIN – zaloguj się hasłem')
            setPin('')
          } else {
            setErr(`Błędny PIN (próba ${n}/5)`)
            setTimeout(() => {
              setPin('')
              setErr('')
            }, 700)
          }
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pin])

  const biometria = async () => {
    if (!user.webauthnId) return
    const ok = await odblokujBiometria(user.webauthnId)
    if (ok) onUnlock()
    else setErr('Nie rozpoznano.')
  }

  const przezHaslo = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await sprawdzHaslo(haslo, user.salt, user.hasloHash)
    if (ok) onUnlock()
    else setErr('Nieprawidłowe hasło.')
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col items-center gap-2 text-center">
        <Avatar u={user} size={56} />
        <div>
          <div className="text-[16px] font-semibold text-ink">{user.imie}</div>
          <div className="text-[12px] text-stone-500">{nazwaRoli(user.rola)}</div>
        </div>
      </div>

      {!trybHaslo && user.pinHash && (
        <>
          <div className="flex items-center justify-center gap-3">
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                className={
                  'h-3.5 w-3.5 rounded-full border transition ' +
                  (i < pin.length ? 'border-white bg-white' : 'border-white/25')
                }
              />
            ))}
          </div>
          {err && <p className="text-center text-[12.5px] text-red-400">{err}</p>}
          <PinPad
            onDigit={(d) => setPin((p) => (p.length < 4 ? p + d : p))}
            onBack={() => setPin((p) => p.slice(0, -1))}
          />
        </>
      )}

      {!trybHaslo && bioOk && (
        <button onClick={biometria} className="btn-outline w-full">
          <Fingerprint size={18} /> Odblokuj biometrią
        </button>
      )}

      {trybHaslo && (
        <form onSubmit={przezHaslo} className="space-y-3">
          <Field label="Hasło">
            <Input
              type="password"
              value={haslo}
              onChange={(e) => setHaslo(e.target.value)}
              placeholder="Wpisz hasło"
              autoFocus
            />
          </Field>
          {err && <p className="text-[12.5px] text-red-400">{err}</p>}
          <button className="btn-primary w-full">
            <LogIn size={16} /> Zaloguj
          </button>
        </form>
      )}

      <div className="flex items-center justify-center gap-4 text-[12.5px]">
        {!trybHaslo && (
          <button
            onClick={() => setTrybHaslo(true)}
            className="flex items-center gap-1 text-stone-500 hover:text-white"
          >
            <KeyRound size={13} /> Zaloguj hasłem
          </button>
        )}
        {trybHaslo && (user.pinHash || user.webauthnId) && (
          <button onClick={() => setTrybHaslo(false)} className="text-stone-500 hover:text-white">
            Szybkie odblokowanie
          </button>
        )}
        <button onClick={onSwitch} className="text-stone-500 hover:text-white">
          Zmień użytkownika
        </button>
      </div>
    </div>
  )
}

function PinPad({ onDigit, onBack }: { onDigit: (d: string) => void; onBack: () => void }) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del']
  return (
    <div className="mx-auto grid max-w-[240px] grid-cols-3 gap-2.5">
      {keys.map((k, i) =>
        k === '' ? (
          <span key={i} />
        ) : k === 'del' ? (
          <button
            key={i}
            onClick={onBack}
            className="grid h-14 place-items-center rounded-xl border border-white/10 text-stone-400 hover:bg-white/[0.05]"
          >
            <Delete size={20} />
          </button>
        ) : (
          <button
            key={i}
            onClick={() => onDigit(k)}
            className="grid h-14 place-items-center rounded-xl border border-white/10 text-[20px] font-semibold text-ink transition hover:bg-white/[0.06] active:scale-95"
          >
            {k}
          </button>
        ),
      )}
    </div>
  )
}

// ---------- Pomocnicze do zakladania PIN/biometrii (uzywane w Ustawieniach) ----------
export async function ustawPinDlaUzytkownika(pin: string): Promise<{ pinHash: string; pinSalt: string }> {
  const sol = losowaSol()
  return { pinHash: await hashPin(pin, sol), pinSalt: sol }
}
export { zarejestrujBiometrie }
export type { Rola }
