import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { Delete, Fingerprint, LogIn, UserPlus, KeyRound } from 'lucide-react'
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
import {
  zalogujChmura,
  zarejestrujChmura,
  sesjaChmury,
  startSync,
  zsynchronizujUzytkownikaLokalnie,
  wejscieDoAmico,
  zapamietajWorkspace,
} from '../lib/cloud'
import { Logo } from './Logo'
import { Field, Input } from './ui'

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

  // Decyzja o ekranie startowym - TYLKO raz, po wczytaniu bazy.
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
      // Na zyczenie wlasciciela: po pierwszym zalogowaniu urzadzenie wchodzi PROSTO do
      // aplikacji (bez ekranu PIN), takze po restarcie. Aplikacja nie wylogowuje sie
      // sama w zaden sposob. Reczne "Zablokuj"/"Zmien uzytkownika" dalej dostepne w menu.
      setWidok('in')
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
    if (widok !== 'in' || !userId) return
    const t = setTimeout(() => {
      const st = useStore.getState().baza.uzytkownicy
      const rek = st.find((u) => u.id === userId)
      // (a) konto zniknelo (usuniete na innym urzadzeniu) LUB (b) zostalo
      // dezaktywowane (aktywny:false). W obu przypadkach wracamy na ekran logowania -
      // dzieki temu dezaktywowana osoba nie wejdzie nawet przez logowanie chmurowe.
      if (!rek || rek.aktywny === false) {
        wyczyscOstatniego()
        setUserId(null)
        setWidok(st.length ? 'login' : 'onboarding')
      }
    }, 400)
    return () => clearTimeout(t)
  }, [widok, userId, user, uzytkownicy])

  // Auto-blokada po bezczynnosci WYLACZONA na zyczenie wlasciciela (wewnetrzna
  // aplikacja firmowa, zaufane urzadzenia). Po zalogowaniu aplikacja NIE wylogowuje
  // ani nie blokuje sie sama. Reczne zablokowanie/zmiana uzytkownika dalej dziala
  // przyciskami w menu.

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
      {(widok === 'onboarding' || widok === 'login') && <LogowanieAMICO onZalogowano={zaloguj} />}
      {widok === 'lock' && user && (
        <Lock user={user} onUnlock={() => setWidok('in')} onSwitch={() => setWidok('login')} />
      )}
    </AuthShell>
  )
}

// ---------- Logowanie AMICO (proste: e-mail + haslo) ----------
// Jeden ekran dla calej firmy AMICO. Zadnych kodow, wyboru "zakladam/dolaczam",
// listy profili ani osobnego "zaloguj przez chmure". Konto zawsze jest w chmurze,
// wiec te same dane sa na kazdym urzadzeniu. "Zaloz konto" laczy sie z ta sama firma.
function LogowanieAMICO({ onZalogowano }: { onZalogowano: (id: string) => void }) {
  const [rejestracja, setRejestracja] = useState(false)
  const [imie, setImie] = useState('')
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (rejestracja) await zarejestrujChmura(email.trim(), haslo)
      else await zalogujChmura(email.trim(), haslo)

      const sesja = await sesjaChmury()
      if (!sesja) throw new Error('Brak sesji – sprawdź e-mail i hasło')

      // Wejscie do jedynej firmy AMICO (dolaczenie / utworzenie jesli to pierwsze konto).
      const wynik = await wejscieDoAmico(imie.trim())
      zapamietajWorkspace(wynik.workspaceId)
      // Kolejnosc: najpierw pobranie/scalenie stanu firmy, potem lokalne konto.
      await startSync(imie.trim())
      // Jesli na liscie jest juz rekord tej osoby po E-MAILU (np. dodany wczesniej
      // recznie z lokalnym id 'usr_...'), scalamy go z kontem chmurowym zamiast tworzyc
      // duplikat - inaczej ta sama osoba pojawilaby sie dwa razy.
      const mail = (sesja.user.email || email).trim().toLowerCase()
      const doZastapienia = useStore
        .getState()
        .baza.uzytkownicy.find((u) => (u.email || '').trim().toLowerCase() === mail && u.id !== sesja.user.id)?.id
      const userId = await zsynchronizujUzytkownikaLokalnie({
        id: sesja.user.id,
        imie: imie.trim(),
        email: sesja.user.email || email.trim(),
        rola: wynik.rola,
        haslo,
        zastapId: doZastapienia,
      })
      onZalogowano(userId)
    } catch (e: any) {
      const m: string = e?.message || ''
      const brakSieci =
        (typeof navigator !== 'undefined' && navigator.onLine === false) ||
        /failed to fetch|networkerror|network request failed|load failed/i.test(m)
      setErr(
        brakSieci
          ? 'Brak internetu. Do zalogowania potrzebny jest zasięg – spróbuj ponownie, gdy będziesz online.'
          : /Invalid login/i.test(m)
            ? 'Nieprawidłowy e-mail lub hasło.'
            : /already registered|User already/i.test(m)
              ? 'Ten e-mail ma już konto – wybierz „Zaloguj się”.'
              : m === 'POTWIERDZ_EMAIL' || /not confirmed/i.test(m)
                ? 'Potwierdź e-mail (link w wiadomości), zanim się zalogujesz.'
                : /amico_wejscie|amico_bootstrap|schema cache|PGRST202|does not exist/i.test(m)
                  ? 'Baza w chmurze nie jest jeszcze gotowa – uruchom skrypt SQL AMICO.'
                  : 'Nie udało się zalogować. Sprawdź e-mail i hasło.',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <h1 className="text-[19px] font-display font-semibold text-ink">
          {rejestracja ? 'Załóż konto AMICO' : 'Zaloguj się'}
        </h1>
        <p className="mt-1 text-[13px] leading-relaxed text-stone-400">
          {rejestracja ? 'Podaj imię, e-mail i hasło.' : 'Podaj e-mail i hasło.'}
        </p>
      </div>

      {rejestracja && (
        <Field label="Imię i nazwisko">
          <Input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="np. Jan Kowalski" autoFocus />
        </Field>
      )}
      <Field label="E-mail">
        <Input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="np. imie@amicco.pl"
          autoComplete="username"
          autoFocus={!rejestracja}
        />
      </Field>
      <Field label="Hasło">
        <Input
          type="password"
          value={haslo}
          onChange={(e) => setHaslo(e.target.value)}
          placeholder="Wpisz hasło"
          autoComplete={rejestracja ? 'new-password' : 'current-password'}
        />
      </Field>

      {err && <p className="text-[12.5px] text-red-400">{err}</p>}

      <button className="btn-primary w-full btn-lg" disabled={busy}>
        {rejestracja ? <UserPlus size={18} /> : <LogIn size={18} />}
        {busy ? 'Chwileczkę…' : rejestracja ? 'Załóż konto' : 'Zaloguj'}
      </button>

      <button
        type="button"
        className="w-full text-center text-[13px] text-stone-400 transition hover:text-white"
        onClick={() => {
          setRejestracja((v) => !v)
          setErr('')
        }}
      >
        {rejestracja ? 'Mam już konto — zaloguj się' : 'Pierwszy raz? Załóż konto'}
      </button>
    </form>
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


// ---------- Lock (szybkie odblokowanie) ----------
// Licznik bledow PIN trzymamy w localStorage (per konto), inaczej po odswiezeniu
// strony blokada "5 prob" znikala - i mozna bylo probowac PIN bez konca.
const PIN_PROBY_KEY = (id: string) => `amico-pin-proby-${id}`
const czytajProbyPin = (id: string): number => {
  const n = Number(localStorage.getItem(PIN_PROBY_KEY(id)) || '0')
  return Number.isFinite(n) && n > 0 ? n : 0
}

function Lock({ user, onUnlock, onSwitch }: { user: Uzytkownik; onUnlock: () => void; onSwitch: () => void }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')
  const [bioOk, setBioOk] = useState(false)
  const [proby, setProby] = useState(() => czytajProbyPin(user.id))
  // Po 5 bledach PIN jest zablokowany az do poprawnego logowania HASLEM.
  const zablokowanyPin = proby >= 5
  const [trybHaslo, setTrybHaslo] = useState((!user.pinHash && !user.webauthnId) || czytajProbyPin(user.id) >= 5)
  const [haslo, setHaslo] = useState('')

  const wyczyscProby = () => {
    localStorage.removeItem(PIN_PROBY_KEY(user.id))
    setProby(0)
  }
  const odblokuj = () => {
    wyczyscProby()
    onUnlock()
  }

  useEffect(() => {
    biometriaDostepna().then((d) => setBioOk(d && !!user.webauthnId))
  }, [user.webauthnId])

  // auto-weryfikacja PIN po 4 cyfrach
  useEffect(() => {
    if (pin.length === 4 && user.pinHash && user.pinSalt && !zablokowanyPin) {
      sprawdzPin(pin, user.pinSalt, user.pinHash).then((ok) => {
        if (ok) odblokuj()
        else {
          const n = proby + 1
          setProby(n)
          localStorage.setItem(PIN_PROBY_KEY(user.id), String(n))
          if (n >= 5) {
            setTrybHaslo(true)
            setErr('Za dużo prób PIN - dostęp PIN-em zablokowany. Zaloguj się hasłem.')
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
    if (ok) odblokuj()
    else setErr('Nie rozpoznano.')
  }

  const przezHaslo = async (e: React.FormEvent) => {
    e.preventDefault()
    const ok = await sprawdzHaslo(haslo, user.salt, user.hasloHash)
    // Poprawne haslo kasuje blokade PIN.
    if (ok) odblokuj()
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
        {trybHaslo && (user.pinHash || user.webauthnId) && !zablokowanyPin && (
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
