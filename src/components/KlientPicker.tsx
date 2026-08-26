import { useMemo, useState } from 'react'
import { Search, UserPlus, X, Check, Phone, Mail, MapPin, Building2, User as UserIcon } from 'lucide-react'
import { useStore } from '../lib/store'
import { Field, Input, Select } from './ui'
import { klientNazwa, klientAdres } from '../lib/helpers'
import { uid } from '../lib/id'
import { nowISO } from '../lib/format'
import type { Klient, KlientTyp } from '../lib/types'

// UWAGA (iOS): NIE owijamy listy klientow w <Field>, bo Field renderuje <label>.
// Przyciski wewnatrz <label> na iPhonie NIE odpalaja swojego onClick - tapniecie jest
// przekierowywane do pola input powiazanego z etykieta, przez co "wybor klienta nic
// nie robil" na PWA. Tutaj etykieta to zwykly <div>, bez owijania przyciskow w <label>.
function Pole({ label, children }: { label?: string; children: React.ReactNode }) {
  return (
    <div className="block">
      {label && <span className="label">{label}</span>}
      {children}
    </div>
  )
}

// ============================================================================
// KlientPicker - jedno miejsce do WYBORU KLIENTA z ZACIAGNIECIEM danych.
// - wyszukiwarka (nazwa / telefon / e-mail / miasto / NIP),
// - po wyborze pokazuje pelna karte klienta (dane same sie zaciagaja),
// - "Nowy klient" tworzy klienta w locie i od razu go wybiera.
// Uzywany w zleceniach, fakturach, umowach, protokolach, KP - spojnie wszedzie.
// ============================================================================
export function KlientPicker({
  value,
  onChange,
  label = 'Klient',
  autoFocus,
}: {
  value?: string
  onChange: (klientId: string | undefined, klient?: Klient) => void
  label?: string
  autoFocus?: boolean
}) {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const wybrany = value ? b.klienci.find((k) => k.id === value) : undefined

  const [q, setQ] = useState('')
  const [tworzenie, setTworzenie] = useState(false)

  const wyniki = useMemo(() => {
    const s = q.trim().toLowerCase()
    // Sortuj po nazwie i UKRYJ przypadkowe duplikaty (ta sama nazwa + telefon) -
    // pokazuj wtedy jeden wpis, zeby lista nie dublowala tych samych osob.
    const posortowane = b.klienci.slice().sort((a, c) => klientNazwa(a).localeCompare(klientNazwa(c), 'pl'))
    const widziane = new Set<string>()
    const unikalne = posortowane.filter((k) => {
      // Dedup TYLKO prawdziwych duplikatow: ta sama nazwa + ten sam telefon. Klient BEZ
      // telefonu jest zawsze unikalny (klucz = id) - inaczej dwoch roznych klientow o tym
      // samym nazwisku i bez telefonu znikalo z listy i nie dalo sie drugiego wybrac.
      const tel = (k.telefon || '').replace(/\s/g, '')
      const klucz = tel ? `${klientNazwa(k).trim().toLowerCase()}|${tel}` : `id:${k.id}`
      if (widziane.has(klucz)) return false
      widziane.add(klucz)
      return true
    })
    // Pokazujemy WSZYSTKICH (lista jest przewijana). Bez szukania - cala baza klientow;
    // przy szukaniu - wszyscy pasujacy.
    if (!s) return unikalne
    return unikalne.filter((k) =>
      [klientNazwa(k), k.telefon, k.email, k.miasto, k.nip, k.ulica]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(s),
    )
  }, [b.klienci, q])

  // ---- Widok: klient wybrany -> karta z danymi ----
  if (wybrany && !tworzenie) {
    const adres = klientAdres(wybrany)
    return (
      <Pole label={label}>
        <div className="rounded-xl border border-brand-300/40 bg-brand-50/40 p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[14.5px] font-semibold text-ink">
                {wybrany.typ === 'firma' ? <Building2 size={15} className="text-brand-700" /> : <UserIcon size={15} className="text-brand-700" />}
                {klientNazwa(wybrany)}
              </div>
              <div className="mt-1 space-y-0.5 text-[12.5px] text-stone-500">
                {wybrany.telefon && (
                  <div className="flex items-center gap-1.5">
                    <Phone size={12} /> {wybrany.telefon}
                  </div>
                )}
                {wybrany.email && (
                  <div className="flex items-center gap-1.5">
                    <Mail size={12} /> {wybrany.email}
                  </div>
                )}
                {adres && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} /> {adres}
                  </div>
                )}
                {wybrany.nip && <div className="text-[12px] text-stone-400">NIP: {wybrany.nip}</div>}
              </div>
            </div>
            <button
              type="button"
              className="shrink-0 rounded-lg px-2 py-1 text-[12.5px] font-medium text-stone-400 hover:bg-white/10 hover:text-white"
              onClick={() => {
                onChange(undefined)
                setQ('')
              }}
            >
              Zmień
            </button>
          </div>
        </div>
      </Pole>
    )
  }

  // ---- Widok: tworzenie nowego klienta w locie ----
  if (tworzenie) {
    return (
      <NowyKlientInline
        wstepnaNazwa={q}
        onAnuluj={() => setTworzenie(false)}
        onZapisz={(nowy) => {
          upsert('klienci', nowy)
          setTworzenie(false)
          setQ('')
          onChange(nowy.id, nowy)
        }}
      />
    )
  }

  // ---- Widok: wyszukiwarka ----
  return (
    <Pole label={label}>
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <Input
          className="!pl-9"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Szukaj klienta: nazwisko, firma, telefon, miasto..."
          autoFocus={autoFocus}
        />
      </div>
      <div className="mt-2 max-h-80 space-y-1 overflow-y-auto">
        {wyniki.map((k) => (
          <button
            key={k.id}
            type="button"
            onClick={() => onChange(k.id, k)}
            className="flex w-full items-center gap-2.5 rounded-lg border border-white/10 p-2.5 text-left transition hover:border-brand-300 hover:bg-white/[0.04]"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
              {k.typ === 'firma' ? <Building2 size={15} /> : <UserIcon size={15} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-medium text-ink">{klientNazwa(k)}</span>
              <span className="block truncate text-[12px] text-stone-500">
                {[k.telefon, k.miasto].filter(Boolean).join(' · ') || 'brak danych kontaktowych'}
              </span>
            </span>
          </button>
        ))}
        {wyniki.length === 0 && (
          <div className="rounded-lg border border-dashed border-white/10 p-3 text-center text-[12.5px] text-stone-500">
            Brak pasujących klientów.
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => setTworzenie(true)}
        className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-brand-300/50 py-2 text-[13px] font-medium text-brand-700 transition hover:bg-brand-50/40"
      >
        <UserPlus size={15} /> Nowy klient{q.trim() ? `: „${q.trim()}"` : ''}
      </button>
    </Pole>
  )
}

// ---- Kompaktowy formularz tworzenia klienta w locie ----
function NowyKlientInline({
  wstepnaNazwa,
  onZapisz,
  onAnuluj,
}: {
  wstepnaNazwa: string
  onZapisz: (k: Klient) => void
  onAnuluj: () => void
}) {
  // Zasada firmowa: NAZWISKO IMIE. Pierwsze slowo = nazwisko, reszta = imie.
  const slowa = wstepnaNazwa.trim().split(/\s+/).filter(Boolean)
  const [typ, setTyp] = useState<KlientTyp>('osoba')
  const [nazwisko, setNazwisko] = useState(slowa[0] || '')
  const [imie, setImie] = useState(slowa.slice(1).join(' ') || '')
  const [nazwaFirmy, setNazwaFirmy] = useState(typ === 'firma' ? wstepnaNazwa.trim() : '')
  const [nip, setNip] = useState('')
  const [telefon, setTelefon] = useState('')
  const [email, setEmail] = useState('')
  const [ulica, setUlica] = useState('')
  const [kod, setKod] = useState('')
  const [miasto, setMiasto] = useState('')

  const nazwaOk = typ === 'firma' ? nazwaFirmy.trim().length > 0 : (imie.trim() + nazwisko.trim()).length > 0

  const zapisz = () => {
    if (!nazwaOk) return
    const now = nowISO()
    const nowy: Klient = {
      id: uid('kli'),
      typ,
      imie: typ === 'osoba' ? imie.trim() || undefined : undefined,
      nazwisko: typ === 'osoba' ? nazwisko.trim() || undefined : undefined,
      nazwaFirmy: typ === 'firma' ? nazwaFirmy.trim() || undefined : undefined,
      nip: nip.trim() || undefined,
      telefon: telefon.trim() || undefined,
      email: email.trim() || undefined,
      ulica: ulica.trim() || undefined,
      kod: kod.trim() || undefined,
      miasto: miasto.trim() || undefined,
      etap: 'nowy',
      tagi: [],
      historia: [],
      utworzono: now,
      zaktualizowano: now,
    }
    onZapisz(nowy)
  }

  return (
    <div className="rounded-xl border border-brand-300/40 bg-brand-50/30 p-3.5">
      <div className="mb-3 flex items-center justify-between">
        <div className="text-[13.5px] font-semibold text-ink">Nowy klient</div>
        <button type="button" onClick={onAnuluj} className="rounded-lg p-1 text-stone-400 hover:bg-white/10 hover:text-white">
          <X size={16} />
        </button>
      </div>

      <div className="mb-3 inline-flex rounded-lg border border-white/10 p-0.5">
        {(['osoba', 'firma'] as KlientTyp[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTyp(t)}
            className={
              typ === t
                ? 'rounded-md bg-white/10 px-3 py-1 text-[12.5px] font-medium text-white'
                : 'rounded-md px-3 py-1 text-[12.5px] font-medium text-stone-500'
            }
          >
            {t === 'osoba' ? 'Osoba' : 'Firma'}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {typ === 'osoba' ? (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nazwisko">
              <Input value={nazwisko} onChange={(e) => setNazwisko(e.target.value)} placeholder="np. Kowalski" autoFocus />
            </Field>
            <Field label="Imię">
              <Input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="np. Jan" />
            </Field>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nazwa firmy">
              <Input value={nazwaFirmy} onChange={(e) => setNazwaFirmy(e.target.value)} placeholder="np. Studio XYZ" autoFocus />
            </Field>
            <Field label="NIP">
              <Input value={nip} onChange={(e) => setNip(e.target.value)} placeholder="123-456-32-18" />
            </Field>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Telefon">
            <Input value={telefon} onChange={(e) => setTelefon(e.target.value)} placeholder="601 234 567" inputMode="tel" />
          </Field>
          <Field label="E-mail">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jan@example.com" type="email" />
          </Field>
        </div>
        <div className="grid grid-cols-[1fr_auto_1fr] gap-3">
          <Field label="Ulica i nr">
            <Input value={ulica} onChange={(e) => setUlica(e.target.value)} placeholder="Kwiatowa 12" />
          </Field>
          <Field label="Kod">
            <Input className="w-24" value={kod} onChange={(e) => setKod(e.target.value)} placeholder="00-000" />
          </Field>
          <Field label="Miasto">
            <Input value={miasto} onChange={(e) => setMiasto(e.target.value)} placeholder="Łódź" />
          </Field>
        </div>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        <button type="button" className="btn-ghost btn-sm" onClick={onAnuluj}>
          Anuluj
        </button>
        <button type="button" className="btn-primary btn-sm" onClick={zapisz} disabled={!nazwaOk}>
          <Check size={15} /> Zapisz i wybierz
        </button>
      </div>
    </div>
  )
}
