import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Users,
  Calculator,
  FileSignature,
  ClipboardList,
  CalendarDays,
  Wallet,
  TrendingUp,
  Plus,
  Receipt,
  Store,
  Star,
  Check,
  Circle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Stat, Card, CardBody, Badge, BADGE_CLASS, cx, type BadgeTone } from '../components/ui'
import { fmtPLN, fmtDate, today, nowISO } from '../lib/format'
import { klientNazwa, etapInfo, PIPELINE } from '../lib/helpers'
import { podsumuj } from '../lib/format'
import { uid } from '../lib/id'
import { useAuth } from '../components/Auth'
import { DokumentyDoPobrania } from '../components/DokumentyDoPobrania'
import { PrzypomnienieRaportKasowy } from '../components/PrzypomnienieRaportKasowy'
import type { Zadanie } from '../lib/types'
import { ListTodo, ScanLine, MapPin, CalendarClock } from 'lucide-react'

export default function Pulpit() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const { user } = useAuth()

  const t = today()
  if (user?.rola === 'montazysta') return <PulpitTeren b={b} t={t} imie={user.imie} userId={user.id} />
  const wydarzeniaDzis = b.wydarzenia.filter((w) => w.data === t && !w.zrobione)
  const wydarzeniaNadchodzace = b.wydarzenia
    .filter((w) => w.data >= t && !w.zrobione)
    .sort((a, c) => a.data.localeCompare(c.data))
    .slice(0, 6)

  const aktywneZlecenia = b.zlecenia.filter((z) => z.etap !== 'zakonczone' && z.etap !== 'utracony')
  const doPodpisu = b.umowy.filter((u) => u.status === 'do_podpisu' || u.status === 'szkic')
  const wartoscOfert = b.wyceny
    .filter((w) => w.status !== 'odrzucona')
    .reduce((sum, w) => sum + podsumuj(w.pozycje).brutto, 0)
  const naleznosci = b.faktury
    .filter((f) => f.status !== 'oplacona')
    .reduce((s, f) => s + podsumuj(f.pozycje).brutto - (f.zaplacono || 0), 0)

  const godzina = new Date().getHours()
  const powitanie = godzina < 18 ? 'Dzień dobry' : 'Dobry wieczór'
  const imieZalogowanego = (user?.imie || firma.wlasciciel || '').split(' ')[0]

  // rozklad pipeline
  const rozklad = PIPELINE.filter((p) => p.klucz !== 'utracony').map((p) => ({
    ...p,
    n: b.klienci.filter((k) => k.etap === p.klucz).length + b.zlecenia.filter((z) => z.etap === p.klucz).length,
  }))
  const maxN = Math.max(1, ...rozklad.map((r) => r.n))

  return (
    <div>
      <PageHeader
        title={imieZalogowanego ? `${powitanie}, ${imieZalogowanego}` : powitanie}
        subtitle={`Pulpit AMICO · ${fmtDate(t)} · podmiot: ${firma.nazwa}`}
        actions={
          <Link to="/wyceny" className="btn-primary">
            <Plus size={17} /> Nowa wycena
          </Link>
        }
      />

      {/* Codzienne przypomnienie o raporcie kasowym (dni pracy) - dla wszystkich */}
      <PrzypomnienieRaportKasowy />

      {/* GLOWNA rzecz na pulpicie: zadania "kto co robi" w stylu Microsoft To Do */}
      <ZadaniaToDo />

      {/* Dokumenty do pobrania - wlascicielka wgrywa, wybiera kto widzi */}
      <DokumentyDoPobrania />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          label="Klienci"
          value={b.klienci.length}
          icon={<Users size={18} />}
          sub={`${aktywneZlecenia.length} aktywnych zleceń`}
        />
        <Stat
          label="Wartość ofert"
          value={fmtPLN(wartoscOfert)}
          tone="green"
          icon={<Calculator size={18} />}
          sub={`${b.wyceny.length} wycen`}
        />
        <Stat
          label="Umowy do podpisu"
          value={doPodpisu.length}
          icon={<FileSignature size={18} />}
          sub={`${b.umowy.length} umów łącznie`}
        />
        <Stat
          label="Należności"
          value={fmtPLN(naleznosci)}
          icon={<Receipt size={18} />}
          sub={`${b.faktury.length} faktur`}
        />
      </div>

      <WymagaDzialania b={b} />

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Lejek */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <TrendingUp size={18} className="text-brand-700" /> Lejek realizacji
              </h3>
              <Link to="/zlecenia" className="text-[13px] font-medium text-brand-700 hover:underline">
                Zlecenia →
              </Link>
            </div>
            <div className="space-y-2.5">
              {rozklad.map((r) => (
                <div key={r.klucz} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[13px] text-stone-500">{r.nazwa}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-stone-100">
                    <div
                      className="h-full rounded-lg bg-brand-600 transition-all"
                      style={{ width: `${(r.n / maxN) * 100}%`, minWidth: r.n ? 22 : 0 }}
                    />
                  </div>
                  <span className="w-6 text-right text-[13px] font-semibold text-stone-700">{r.n}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Dzis / kalendarz */}
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <CalendarDays size={18} className="text-brand-700" /> Dziś i wkrótce
              </h3>
              <Link to="/kalendarz" className="text-[13px] font-medium text-brand-700 hover:underline">
                Kalendarz →
              </Link>
            </div>
            {wydarzeniaNadchodzace.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-stone-400">Brak zaplanowanych wydarzeń.</p>
            ) : (
              <div className="space-y-2">
                {wydarzeniaNadchodzace.map((w) => (
                  <div key={w.id} className="flex items-center gap-2.5 rounded-xl border border-stone-100 px-3 py-2">
                    <div className="text-center">
                      <div className="text-[11px] font-semibold text-brand-700">{fmtDate(w.data).slice(0, 5)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{w.tytul}</div>
                      <div className="text-[11px] text-stone-400">
                        {w.godzina && `${w.godzina} · `}
                        {w.typ}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {wydarzeniaDzis.length > 0 && (
              <div className="mt-3">
                <Badge tone="amber">{wydarzeniaDzis.length} na dziś</Badge>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Ostatni klienci + szybkie akcje */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Users size={18} className="text-brand-700" /> Ostatni klienci
              </h3>
              <Link to="/klienci" className="text-[13px] font-medium text-brand-700 hover:underline">
                Wszyscy →
              </Link>
            </div>
            {b.klienci.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-stone-400">
                Brak klientów - dodaj pierwszego w zakładce Klienci CRM.
              </p>
            ) : (
              <div className="divide-y divide-stone-100">
                {b.klienci
                  .slice()
                  .sort((a, c) => c.zaktualizowano.localeCompare(a.zaktualizowano))
                  .slice(0, 5)
                  .map((k) => {
                    const ei = etapInfo(k.etap)
                    return (
                      <Link
                        key={k.id}
                        to={`/klienci/${k.id}`}
                        className="flex items-center gap-3 py-2.5 transition hover:bg-stone-50"
                      >
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">
                          {klientNazwa(k).slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-ink">{klientNazwa(k)}</div>
                          <div className="text-[12px] text-stone-400">{k.telefon || k.email || '-'}</div>
                        </div>
                        <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
                      </Link>
                    )
                  })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">Szybkie akcje</h3>
            <div className="grid grid-cols-2 gap-2">
              <Qa to="/klienci" icon={<Users size={18} />} label="Nowy klient" />
              <Qa to="/wyceny" icon={<Calculator size={18} />} label="Wycena" />
              <Qa to="/umowy" icon={<FileSignature size={18} />} label="Umowa" />
              <Qa to="/zlecenia" icon={<ClipboardList size={18} />} label="Zlecenie" />
              <Qa to="/finanse" icon={<Wallet size={18} />} label="Raport kasowy" />
              <Qa to="/ekspozycje" icon={<Store size={18} />} label="Ekspozycja" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

// ============================================================================
// Zadania na pulpicie w stylu Microsoft To Do - proste zaznaczanie + przydzial
// ============================================================================
function ZadaniaToDo() {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const { user } = useAuth()

  // Osoby do przydzialu: uzytkownicy (konta) + pracownicy (zespol). Dedup po IMIENIU
  // w calej liscie - eliminuje "Ciastki" + "Ciastki (zespol)" oraz zdublowanych pracownikow.
  const osoby = useMemo(() => {
    const wynik: { id: string; nazwa: string; kolor?: string }[] = []
    const widziane = new Set<string>()
    const dodaj = (id: string, nazwa: string, kolor?: string) => {
      const klucz = (nazwa || '').trim().toLowerCase()
      if (!klucz || widziane.has(klucz)) return
      widziane.add(klucz)
      wynik.push({ id, nazwa: nazwa.trim(), kolor })
    }
    b.uzytkownicy.filter((x) => x.aktywny !== false).forEach((x) => dodaj(x.id, x.imie, x.kolor))
    b.pracownicy.forEach((x) => dodaj(x.id, x.imie))
    return wynik
  }, [b.uzytkownicy, b.pracownicy])
  const osobaById = (id?: string) => osoby.find((o) => o.id === id)
  // Zamienia wpis (mozna KILKA osob po przecinku) na przydzial. Osoby z kont/zespolu
  // -> ich id (pierwsza = glowna, reszta = wspolni, tez widza zadanie). Jedna dowolna
  // nazwa bez konta -> przypisanyDoNazwa. Puste = nieprzypisane.
  const rozpoznaj = (
    wpis: string,
  ): { przypisanyDo?: string; przypisanyDoNazwa?: string; wspolniPrzypisani?: string[] } => {
    const czesci = wpis
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    if (!czesci.length) return { przypisanyDo: undefined, przypisanyDoNazwa: undefined, wspolniPrzypisani: undefined }
    const ids: string[] = []
    let custom: string | undefined
    for (const c of czesci) {
      const o = osoby.find((x) => x.nazwa.trim().toLowerCase() === c.toLowerCase())
      if (o) {
        if (!ids.includes(o.id)) ids.push(o.id)
      } else if (!custom) custom = c
    }
    const [glowny, ...reszta] = ids
    return {
      przypisanyDo: glowny || undefined,
      przypisanyDoNazwa: glowny ? undefined : custom,
      wspolniPrzypisani: reszta.length ? reszta : undefined,
    }
  }
  const nazwaPrzypisanego = (z: Zadanie) =>
    [z.przypisanyDoNazwa || osobaById(z.przypisanyDo)?.nazwa, ...(z.wspolniPrzypisani || []).map((id) => osobaById(id)?.nazwa)]
      .filter(Boolean)
      .join(', ')
  const kolorPrzypisanego = (z: Zadanie) => osobaById(z.przypisanyDo)?.kolor || '#6b7280'
  const inicjaly = (n: string) =>
    n
      .split(' ')
      .map((s) => s[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase()

  const [filtr, setFiltr] = useState<string>('all')
  const [tekst, setTekst] = useState('')
  const [przyp, setPrzyp] = useState<string>(user?.imie || '')
  const [termin, setTermin] = useState('')
  const [pokazZrob, setPokazZrob] = useState(false)

  const t = today()
  // Widocznosc: wlasciciel i kierownik widza WSZYSTKIE zadania (i moga filtrowac po osobie).
  // Pozostali (biuro/montazysta) widza TYLKO swoje przypisane - zadania sa prywatne.
  const widziWszystkie = user?.rola === 'wlasciciel' || user?.rola === 'kierownik'
  const moje = (z: Zadanie) => z.przypisanyDo === user?.id || (z.wspolniPrzypisani || []).includes(user?.id || '')
  const pasuje = (z: Zadanie) => {
    if (!widziWszystkie) return moje(z)
    if (filtr === 'all') return true
    if (filtr === 'moje') return moje(z)
    return z.przypisanyDo === filtr || (z.wspolniPrzypisani || []).includes(filtr)
  }

  const aktywne = b.zadania
    .filter((z) => z.status !== 'zrobione' && pasuje(z))
    .sort((a, c) => {
      const wa = a.priorytet === 'wysoki' ? 0 : 1
      const wc = c.priorytet === 'wysoki' ? 0 : 1
      if (wa !== wc) return wa - wc
      return (a.termin || '9999-99-99').localeCompare(c.termin || '9999-99-99')
    })
  const zrobione = b.zadania
    .filter((z) => z.status === 'zrobione' && pasuje(z))
    .sort((a, c) => c.zaktualizowano.localeCompare(a.zaktualizowano))

  const dodaj = () => {
    const ttl = tekst.trim()
    if (!ttl) return
    upsert('zadania', {
      id: uid('zad'),
      tytul: ttl,
      ...rozpoznaj(przyp),
      termin: termin || undefined,
      priorytet: 'sredni',
      status: 'do_zrobienia',
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    } as Zadanie)
    setTekst('')
    setTermin('')
  }
  const toggle = (z: Zadanie) =>
    upsert('zadania', {
      ...z,
      status: z.status === 'zrobione' ? 'do_zrobienia' : 'zrobione',
      zaktualizowano: nowISO(),
    })
  const gwiazdka = (z: Zadanie) =>
    upsert('zadania', { ...z, priorytet: z.priorytet === 'wysoki' ? 'sredni' : 'wysoki', zaktualizowano: nowISO() })
  const przypiszNazwa = (z: Zadanie, nazwa: string) =>
    upsert('zadania', { ...z, ...rozpoznaj(nazwa), zaktualizowano: nowISO() })

  return (
    <Card className="mt-6">
      <CardBody>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <ListTodo size={18} className="text-brand-700" /> Zadania — kto co robi
          </h3>
          {widziWszystkie && (
            <div className="flex flex-wrap gap-1.5">
              <FiltrPill active={filtr === 'all'} onClick={() => setFiltr('all')}>
                Wszystkie
              </FiltrPill>
              <FiltrPill active={filtr === 'moje'} onClick={() => setFiltr('moje')}>
                Moje
              </FiltrPill>
              {osoby.map((o) => (
                <FiltrPill key={o.id} active={filtr === o.id} onClick={() => setFiltr(o.id)}>
                  {o.nazwa.split(' ')[0]}
                </FiltrPill>
              ))}
            </div>
          )}
        </div>

        {/* Podpowiedzi osob (konta + zespol) - mozna tez wpisac dowolne imie */}
        <datalist id="pulpit-osoby">
          {osoby.map((o) => (
            <option key={o.id} value={o.nazwa} />
          ))}
        </datalist>

        {/* Szybkie dodawanie (jak "Dodaj zadanie" w To Do) */}
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] p-2">
          <Plus size={18} className="ml-1 shrink-0 text-brand-700" />
          <input
            value={tekst}
            onChange={(e) => setTekst(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dodaj()
            }}
            placeholder="Dodaj zadanie…"
            className="min-w-[140px] flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-stone-500"
          />
          <input
            list="pulpit-osoby"
            value={przyp}
            onChange={(e) => setPrzyp(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') dodaj()
            }}
            placeholder="Dla kogo (kilka po przecinku)"
            className="w-44 rounded-lg border border-white/10 bg-transparent px-2 py-1 text-[12.5px] text-stone-600"
            title="Przydziel osobie/osobom – kilka oddziel przecinkiem, można też wpisać dowolne imię"
          />
          <input
            type="date"
            value={termin}
            onChange={(e) => setTermin(e.target.value)}
            className="rounded-lg border border-white/10 bg-transparent px-2 py-1 text-[12.5px] text-stone-600"
            title="Termin"
          />
          <button className="btn-primary btn-sm" onClick={dodaj} disabled={!tekst.trim()}>
            Dodaj
          </button>
        </div>

        {/* Lista aktywnych */}
        {aktywne.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-stone-400">
            Brak zadań{filtr !== 'all' ? ' w tym widoku' : ''}. Dodaj pierwsze powyżej.
          </p>
        ) : (
          <div className="space-y-0.5">
            {aktywne.map((z) => (
              <div
                key={z.id}
                className="group flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]"
              >
                <button
                  onClick={() => toggle(z)}
                  className="shrink-0 text-stone-400 transition hover:text-brand-700"
                  title="Oznacz jako zrobione"
                >
                  <Circle size={20} />
                </button>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14px] text-ink">{z.tytul}</div>
                  {z.termin && (
                    <div className={cx('text-[11.5px]', z.termin < t ? 'text-red-400' : 'text-stone-400')}>
                      {fmtDate(z.termin)}
                      {z.godzina ? `, ${z.godzina}` : ''}
                    </div>
                  )}
                </div>
                {nazwaPrzypisanego(z) && (
                  <span className="hidden shrink-0 sm:block" title={nazwaPrzypisanego(z)}>
                    <span
                      className="grid h-6 w-6 place-items-center rounded-full text-[9.5px] font-bold text-white"
                      style={{ background: kolorPrzypisanego(z) }}
                    >
                      {inicjaly(nazwaPrzypisanego(z))}
                    </span>
                  </span>
                )}
                <input
                  list="pulpit-osoby"
                  key={nazwaPrzypisanego(z) || z.id}
                  defaultValue={nazwaPrzypisanego(z)}
                  onBlur={(e) => {
                    if (e.target.value.trim() !== nazwaPrzypisanego(z)) przypiszNazwa(z, e.target.value)
                  }}
                  placeholder="przydziel"
                  className="max-w-[110px] shrink-0 rounded-lg border border-transparent bg-transparent px-1 py-0.5 text-[12px] text-stone-500 transition hover:border-white/10"
                  title="Przydziel osobie (dowolne imię)"
                />
                <button
                  onClick={() => gwiazdka(z)}
                  className={cx(
                    'shrink-0 transition',
                    z.priorytet === 'wysoki' ? 'text-amber-400' : 'text-stone-500 hover:text-amber-400',
                  )}
                  title="Ważne"
                >
                  <Star size={17} fill={z.priorytet === 'wysoki' ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Zrobione - zwijane */}
        {zrobione.length > 0 && (
          <div className="mt-3 border-t border-white/[0.06] pt-2">
            <button
              onClick={() => setPokazZrob((v) => !v)}
              className="flex items-center gap-1.5 text-[13px] font-medium text-stone-500 transition hover:text-white"
            >
              {pokazZrob ? <ChevronDown size={15} /> : <ChevronRight size={15} />} Zrobione ({zrobione.length})
            </button>
            {pokazZrob && (
              <div className="mt-1 space-y-0.5">
                {zrobione.map((z) => (
                  <div key={z.id} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
                    <button
                      onClick={() => toggle(z)}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-brand-600 text-white"
                      title="Cofnij"
                    >
                      <Check size={13} strokeWidth={3} />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[13.5px] text-stone-400 line-through">{z.tytul}</span>
                    <span className="shrink-0 text-[11px] text-stone-500">
                      {nazwaPrzypisanego(z).split(' ')[0] || ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

function FiltrPill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-white/10 px-3 py-1 text-[12.5px] font-medium text-white'
          : 'rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[12.5px] font-medium text-stone-500 hover:border-brand-300'
      }
    >
      {children}
    </button>
  )
}

function Qa({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-3.5 text-center transition hover:border-brand-300 hover:bg-brand-50"
    >
      <span className="text-brand-700">{icon}</span>
      <span className="text-[12.5px] font-medium text-stone-600">{label}</span>
    </Link>
  )
}

// ---------- Widget "Wymaga działania" (biuro / właściciel) ----------
function WymagaDzialania({ b }: { b: ReturnType<typeof useStore.getState>['baza'] }) {
  const t = today()
  const chips = [
    { n: b.wyceny.filter((w) => w.status === 'szkic').length, label: 'ofert do wysłania', to: '/wyceny', tone: 'blue' },
    {
      n: b.umowy.filter((u) => u.status === 'szkic' || u.status === 'do_podpisu').length,
      label: 'umów do podpisu',
      to: '/umowy',
      tone: 'amber',
    },
    {
      n: b.zadania.filter((z) => z.status !== 'zrobione' && z.termin && z.termin <= t).length,
      label: 'zadań na dziś / zaległych',
      to: '/zadania',
      tone: 'amber',
    },
    {
      n: b.faktury.filter((f) => f.status !== 'oplacona' && f.terminPlatnosci && f.terminPlatnosci < t).length,
      label: 'faktur po terminie',
      to: '/faktury',
      tone: 'red',
    },
  ].filter((c) => c.n > 0)
  if (!chips.length) return null
  return (
    <Card className="mt-6">
      <CardBody>
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
          <CalendarClock size={18} className="text-amber-400" /> Wymaga działania
        </h3>
        <div className="flex flex-wrap gap-2">
          {chips.map((c) => (
            <Link
              key={c.label}
              to={c.to}
              className={`${BADGE_CLASS[c.tone as BadgeTone]} !text-[13px] !px-3 !py-1.5 hover:opacity-80`}
            >
              <b className="mr-1">{c.n}</b> {c.label}
            </Link>
          ))}
        </div>
      </CardBody>
    </Card>
  )
}

// ---------- Pulpit terenowy (montażysta) ----------
function PulpitTeren({
  b,
  t,
  imie,
  userId,
}: {
  b: ReturnType<typeof useStore.getState>['baza']
  t: string
  imie: string
  userId: string
}) {
  const wydarzeniaDzis = b.wydarzenia.filter((w) => w.data === t && !w.zrobione)
  const moje = b.zadania
    .filter((z) => z.przypisanyDo === userId && z.status !== 'zrobione')
    .sort((a, c) => (a.termin || '').localeCompare(c.termin || ''))
  const naDzis = moje.filter((z) => z.termin && z.termin <= t)
  const powitanie = new Date().getHours() < 18 ? 'Dzień dobry' : 'Dobry wieczór'

  return (
    <div>
      <PageHeader title={`${powitanie}, ${imie.split(' ')[0]}`} subtitle={`Twój plan · ${fmtDate(t)}`} />

      <PrzypomnienieRaportKasowy />

      <Card className="mb-5">
        <CardBody>
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold text-ink">
            <CalendarClock size={18} className="text-brand-400" /> Plan dnia
          </h3>
          {wydarzeniaDzis.length === 0 && naDzis.length === 0 ? (
            <p className="py-4 text-center text-[13.5px] text-stone-400">Brak zaplanowanych zadań na dziś.</p>
          ) : (
            <div className="space-y-2">
              {wydarzeniaDzis.map((w) => (
                <div key={w.id} className="flex items-center gap-3 rounded-xl border border-white/10 p-3">
                  <span className="rounded-lg bg-white/[0.06] px-2.5 py-1 text-[13px] font-semibold text-white">
                    {w.godzina || '-'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{w.tytul}</div>
                    <div className="truncate text-[12px] text-stone-400">
                      {w.typ}
                      {w.adres ? ` · ${w.adres}` : ''}
                    </div>
                  </div>
                  {w.adres && (
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(w.adres)}`}
                      target="_blank"
                      rel="noreferrer"
                      className="grid h-9 w-9 place-items-center rounded-lg bg-white/[0.06] text-stone-400 hover:text-white"
                    >
                      <MapPin size={16} />
                    </a>
                  )}
                </div>
              ))}
              {naDzis.map((z) => (
                <Link
                  key={z.id}
                  to="/zadania"
                  className="flex items-center gap-3 rounded-xl border border-white/10 p-3 hover:bg-white/[0.03]"
                >
                  <ListTodo size={17} className="text-amber-400" />
                  <span className="flex-1 text-[14px] text-ink">{z.tytul}</span>
                  <Badge tone="amber">na dziś</Badge>
                </Link>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <TerenTile to="/zadania" icon={<ListTodo size={26} />} label="Moje zadania" n={moje.length} />
        <TerenTile to="/zlecenia" icon={<ClipboardList size={26} />} label="Zlecenia" />
        <TerenTile to="/kalendarz" icon={<CalendarDays size={26} />} label="Kalendarz" />
        <TerenTile to="/skany" icon={<ScanLine size={26} />} label="Skanuj / Archiwum" />
      </div>

      <DokumentyDoPobrania />
    </div>
  )
}

function TerenTile({ to, icon, label, n }: { to: string; icon: React.ReactNode; label: string; n?: number }) {
  return (
    <Link
      to={to}
      className="card relative flex flex-col items-center justify-center gap-2 py-7 text-center transition hover:border-white/20"
    >
      <span className="text-brand-400">{icon}</span>
      <span className="text-[13.5px] font-medium text-stone-700">{label}</span>
      {n !== undefined && n > 0 && (
        <span className="absolute right-3 top-3 rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-semibold text-white">
          {n}
        </span>
      )}
    </Link>
  )
}
