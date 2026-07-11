import { useEffect, useState } from 'react'
import { Cloud, CloudOff, RefreshCw, LogOut, Copy, Check, LogIn, UserPlus, Users, AlertTriangle } from 'lucide-react'
import { SectionCard, Field, Input, Select, Badge, useToast, cx, BADGE_CLASS, type BadgeTone } from './ui'
import {
  useCloud,
  zalogujChmura,
  zarejestrujChmura,
  dolaczDoFirmy,
  bootstrapFirmy,
  zsynchronizujUzytkownikaLokalnie,
  startSync,
  wylogujChmura,
  wymusZapis,
  sesjaChmury,
  zapamietajWorkspace,
} from '../lib/cloud'
import { fmtDateTime } from '../lib/format'

type Tryb = 'logowanie' | 'rejestracja' | 'dolacz'

export function CloudPanel({
  onZalogowano,
  bezRamki,
}: {
  onZalogowano?: (userId: string) => void
  bezRamki?: boolean
}) {
  const c = useCloud()
  const { push } = useToast()
  const [maSesje, setMaSesje] = useState<boolean | null>(null)

  const [tryb, setTryb] = useState<Tryb>('logowanie')
  const [imie, setImie] = useState('')
  const [email, setEmail] = useState('')
  const [haslo, setHaslo] = useState('')
  const [kod, setKod] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [skopiowano, setSkopiowano] = useState(false)

  useEffect(() => {
    sesjaChmury().then((s) => setMaSesje(!!s))
  }, [c.status])

  async function wykonaj(e: React.FormEvent) {
    e.preventDefault()
    setErr('')
    setBusy(true)
    try {
      if (tryb === 'rejestracja') await zarejestrujChmura(email.trim(), haslo)
      else await zalogujChmura(email.trim(), haslo)

      const sesja = await sesjaChmury()
      if (!sesja) throw new Error('Brak sesji – sprawdź e-mail lub hasło')

      const wynik = tryb === 'dolacz' ? await dolaczDoFirmy(kod.trim(), imie.trim()) : await bootstrapFirmy(imie.trim())
      // Zapamietujemy SWIADOMIE wybrana firme. Bez tego startSync moglby przy nastepnym
      // uruchomieniu trafic na inne czlonkostwo tego samego konta i podmienic dane.
      zapamietajWorkspace(wynik.workspaceId)

      // KOLEJNOSC MA ZNACZENIE: najpierw pobranie/scalenie stanu firmy z chmury
      // (moze podmienic lokalna baze), dopiero potem zakladamy lokalne konto,
      // zeby nie zostalo skasowane przez dane przychodzace z serwera.
      await startSync(imie.trim())

      const userId = await zsynchronizujUzytkownikaLokalnie({
        id: sesja.user.id,
        imie: imie.trim() || sesja.user.email || 'Użytkownik',
        email: sesja.user.email || email.trim(),
        rola: wynik.rola,
        haslo,
      })

      push('Połączono z chmurą – dane będą synchronizowane')
      onZalogowano?.(userId)
    } catch (e: any) {
      const m: string = e?.message || 'Nie udało się połączyć'
      setErr(
        m === 'POTWIERDZ_EMAIL' || /not confirmed/i.test(m)
          ? 'Konto utworzone. Potwierdź e-mail (link w wiadomości), a potem zaloguj się. Aby zespół nie musiał tego robić: Supabase → Authentication → Sign In / Providers → Email → wyłącz „Confirm email”.'
          : /Invalid login/i.test(m)
            ? 'Nieprawidłowy e-mail lub hasło'
            : /already registered|User already/i.test(m)
              ? 'Ten e-mail ma już konto – wybierz „Zaloguj się”'
              : /Wymagane logowanie/i.test(m)
                ? 'Sesja wygasła – zaloguj się ponownie'
                : /amico_bootstrap|amico_join|does not exist|schema cache|PGRST202/i.test(m)
                  ? 'Baza w chmurze nie jest przygotowana – uruchom skrypt SQL (supabase/amico-schema.sql)'
                  : m,
      )
    } finally {
      setBusy(false)
    }
  }

  // ---------- Widok: zalogowany ----------
  const tresc = maSesje ? (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <StatusChip />
        <span className="text-[13px] text-stone-400">{c.email}</span>
        {c.rola && <Badge tone="stone">{c.rola}</Badge>}
      </div>

      {c.blad && (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2.5 text-[13px] text-red-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{c.blad}</span>
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 p-3">
          <div className="text-[11.5px] uppercase tracking-wide text-stone-500">Ostatni zapis</div>
          <div className="mt-1 text-[14px] font-semibold text-ink">
            {c.ostatniZapis ? fmtDateTime(c.ostatniZapis) : '–'}
          </div>
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <div className="text-[11.5px] uppercase tracking-wide text-stone-500">Rozmiar bazy</div>
          <div className="mt-1 text-[14px] font-semibold text-ink">{c.rozmiarKB ? `${c.rozmiarKB} KB` : '–'}</div>
        </div>
        <div className="rounded-xl border border-white/10 p-3">
          <div className="text-[11.5px] uppercase tracking-wide text-stone-500">Kod firmy (dla zespołu)</div>
          <button
            className="mt-1 flex items-center gap-2 text-[14px] font-semibold text-ink hover:text-brand-700"
            onClick={async () => {
              if (!c.joinCode) return
              await navigator.clipboard.writeText(c.joinCode).catch(() => {})
              setSkopiowano(true)
              setTimeout(() => setSkopiowano(false), 1500)
            }}
          >
            {c.joinCode || '–'}{' '}
            {skopiowano ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={13} className="text-stone-500" />
            )}
          </button>
        </div>
      </div>

      {c.rozmiarKB > 4000 && (
        <p className="text-[12px] text-amber-300">
          Baza jest duża ({c.rozmiarKB} KB) – głównie przez skany. Rozważ archiwizowanie starych skanów.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button className="btn-outline" onClick={() => void wymusZapis()}>
          <RefreshCw size={16} /> Zapisz teraz
        </button>
        <button
          className="btn-ghost text-red-400"
          onClick={async () => {
            await wylogujChmura()
            setMaSesje(false)
            push('Wylogowano z chmury (dane zostają na urządzeniu)', 'info')
          }}
        >
          <LogOut size={16} /> Wyloguj z chmury
        </button>
      </div>

      <p className="text-[12px] text-stone-500">
        Dane zapisują się automatycznie w chmurze i lokalnie. Zaloguj się tym samym e-mailem na innym urządzeniu, aby
        zobaczyć te same dane. Pracownik dołącza do firmy <b>kodem</b> powyżej.
      </p>
    </div>
  ) : (
    // ---------- Widok: logowanie ----------
    <form onSubmit={wykonaj} className="space-y-4">
      {c.status === 'sesja' && c.blad && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-200">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" />
          <span>{c.blad}</span>
        </div>
      )}
      <div className="flex gap-1.5">
        {(
          [
            ['logowanie', 'Zaloguj się'],
            ['rejestracja', 'Załóż konto'],
            ['dolacz', 'Dołącz do firmy'],
          ] as [Tryb, string][]
        ).map(([k, l]) => (
          <button
            key={k}
            type="button"
            onClick={() => setTryb(k)}
            className={cx(
              'rounded-lg px-3 py-1.5 text-[13px] font-medium transition',
              tryb === k ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5',
            )}
          >
            {l}
          </button>
        ))}
      </div>

      {(tryb === 'rejestracja' || tryb === 'dolacz') && (
        <Field label="Imię i nazwisko">
          <Input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="np. Andrzej Fiks" />
        </Field>
      )}
      {tryb === 'dolacz' && (
        <Field label="Kod firmy (od właściciela)">
          <Input value={kod} onChange={(e) => setKod(e.target.value.toUpperCase())} placeholder="np. A1B2C3D4" />
        </Field>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="E-mail">
          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="biuro@amicco.pl" />
        </Field>
        <Field label="Hasło">
          <Input type="password" value={haslo} onChange={(e) => setHaslo(e.target.value)} placeholder="min. 6 znaków" />
        </Field>
      </div>

      {err && <p className="text-[12.5px] text-red-400">{err}</p>}

      <button className="btn-primary w-full" disabled={busy}>
        {tryb === 'rejestracja' ? (
          <UserPlus size={16} />
        ) : tryb === 'dolacz' ? (
          <Users size={16} />
        ) : (
          <LogIn size={16} />
        )}
        {busy
          ? 'Łączenie…'
          : tryb === 'rejestracja'
            ? 'Załóż konto i połącz'
            : tryb === 'dolacz'
              ? 'Dołącz do firmy'
              : 'Zaloguj i synchronizuj'}
      </button>
      <p className="text-[12px] text-stone-500">
        Logowanie w chmurze pozwala korzystać z <b>tego samego konta na wielu urządzeniach</b>. Aplikacja nadal działa
        offline – zmiany dosynchronizują się po odzyskaniu internetu.
      </p>
    </form>
  )

  if (bezRamki) return tresc
  return (
    <SectionCard
      title="Chmura i synchronizacja"
      icon={<Cloud size={18} />}
      desc="Te same dane na tablecie i komputerze + kopia na serwerze."
    >
      {tresc}
    </SectionCard>
  )
}

export function StatusChip() {
  const { status } = useCloud()
  const map: Record<string, { l: string; tone: BadgeTone; ikona: React.ReactNode }> = {
    off: { l: 'Tylko lokalnie', tone: 'stone', ikona: <CloudOff size={13} /> },
    laczenie: { l: 'Łączenie…', tone: 'blue', ikona: <RefreshCw size={13} className="animate-spin" /> },
    zapisywanie: { l: 'Zapisywanie…', tone: 'blue', ikona: <RefreshCw size={13} className="animate-spin" /> },
    ok: { l: 'Zsynchronizowano', tone: 'green', ikona: <Cloud size={13} /> },
    offline: { l: 'Offline – zapisze się później', tone: 'amber', ikona: <CloudOff size={13} /> },
    blad: { l: 'Błąd zapisu', tone: 'red', ikona: <AlertTriangle size={13} /> },
    sesja: { l: 'Zaloguj ponownie do chmury', tone: 'amber', ikona: <AlertTriangle size={13} /> },
  }
  const s = map[status] || map.off
  return (
    <span className={BADGE_CLASS[s.tone]}>
      {s.ikona} {s.l}
    </span>
  )
}
