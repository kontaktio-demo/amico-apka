import React, { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Users,
  Plus,
  Phone,
  Mail,
  MapPin,
  ArrowLeft,
  Ruler,
  Calculator,
  FileSignature,
  ClipboardList,
  MessageSquare,
  FileCheck2,
  ShieldCheck,
  UserRound,
  Building2,
  Tag,
  Clock,
  StickyNote,
  ChevronRight,
  AlertTriangle,
  Trash2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  Card,
  CardBody,
  SectionCard,
  Field,
  Input,
  Textarea,
  Select,
  Toggle,
  SearchInput,
  Badge,
  EmptyState,
  Modal,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { DocSheet } from '../documents/DocShell'
import { klientNazwa, klientAdres, etapInfo, PIPELINE } from '../lib/helpers'
import { fmtDate, fmtDateTime, nowISO, validNIP, fmtNIP } from '../lib/format'
import { mailtoLink, smsLink } from '../lib/print'
import { uid } from '../lib/id'
import type {
  Klient,
  KlientTyp,
  PipelineEtap,
  WpisHistorii,
  OsobyProjektu,
  KontrahentTyp,
  Firma,
} from '../lib/types'

// ============================================================================
// KLIENCI — CRM. Lista (/klienci) + Karta klienta (/klienci/:id)
// ============================================================================

export default function Klienci() {
  const { id } = useParams()
  if (id) return <KartaKlienta id={id} />
  return <ListaKlientow />
}

// ---------- Maskowanie PESEL (RODO) ----------
function maskPesel(p?: string): string {
  if (!p) return '—'
  const c = p.replace(/\D/g, '')
  if (c.length < 2) return '•••••••••••'
  return `•••••••••${c.slice(-2)}`
}

// ---------- Osoby projektu: konfiguracja ról ----------
const OSOBY_ROLE: { key: keyof OsobyProjektu; label: string; typ?: KontrahentTyp }[] = [
  { key: 'projektantId', label: 'Projektant', typ: 'projektant' },
  { key: 'stolarzId', label: 'Stolarz', typ: 'stolarz' },
  { key: 'wykonawcaId', label: 'Wykonawca', typ: 'wykonawca' },
  { key: 'koordynatorId', label: 'Koordynator' },
]

// ============================================================================
// LISTA KLIENTÓW
// ============================================================================
function ListaKlientow() {
  const b = useStore((s) => s.baza)
  const [szukaj, setSzukaj] = useState('')
  const [etapF, setEtapF] = useState<'all' | PipelineEtap>('all')
  const [nowyOpen, setNowyOpen] = useState(false)

  const wynik = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    return b.klienci
      .filter((k) => (etapF === 'all' ? true : k.etap === etapF))
      .filter((k) => {
        if (!q) return true
        const hay = [klientNazwa(k), k.telefon, k.email, k.miasto, (k.tagi || []).join(' ')]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return hay.includes(q)
      })
      .slice()
      .sort((a, c) => c.zaktualizowano.localeCompare(a.zaktualizowano))
  }, [b.klienci, szukaj, etapF])

  return (
    <div>
      <PageHeader
        title="Klienci"
        subtitle="Baza klientów i lejek sprzedaży (CRM)"
        icon={<Users size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setNowyOpen(true)}>
            <Plus size={17} /> Nowy klient
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[240px] flex-1">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj po nazwie, telefonie, mieście…" />
        </div>
        <Select value={etapF} onChange={(e) => setEtapF(e.target.value as 'all' | PipelineEtap)} className="w-auto">
          <option value="all">Wszystkie etapy</option>
          {PIPELINE.map((p) => (
            <option key={p.klucz} value={p.klucz}>
              {p.nazwa}
            </option>
          ))}
        </Select>
      </div>

      {wynik.length === 0 ? (
        <EmptyState
          icon={<Users size={26} />}
          title="Brak klientów"
          desc={
            b.klienci.length === 0
              ? 'Dodaj pierwszego klienta, aby rozpocząć pracę z CRM.'
              : 'Żaden klient nie pasuje do wybranych filtrów.'
          }
          action={
            <button className="btn-primary" onClick={() => setNowyOpen(true)}>
              <Plus size={17} /> Nowy klient
            </button>
          }
        />
      ) : (
        <Card>
          <div className="divide-y divide-stone-100">
            {wynik.map((k) => {
              const ei = etapInfo(k.etap)
              return (
                <Link key={k.id} to={`/klienci/${k.id}`} className="row-hover flex items-center gap-3 px-4 py-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">
                    {k.typ === 'firma' ? <Building2 size={18} /> : <UserRound size={18} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14.5px] font-medium text-ink">{klientNazwa(k)}</div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-stone-400">
                      {k.telefon && (
                        <span className="inline-flex items-center gap-1">
                          <Phone size={12} /> {k.telefon}
                        </span>
                      )}
                      {k.miasto && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin size={12} /> {k.miasto}
                        </span>
                      )}
                      {k.zrodlo && <span>· {k.zrodlo}</span>}
                    </div>
                  </div>
                  <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
                  <ChevronRight size={18} className="text-stone-300" />
                </Link>
              )
            })}
          </div>
        </Card>
      )}

      <NowyKlientModal open={nowyOpen} onClose={() => setNowyOpen(false)} />
    </div>
  )
}

// ============================================================================
// MODAL: NOWY KLIENT
// ============================================================================
function pustyFormularz(): Klient {
  return {
    id: uid('kli'),
    typ: 'osoba',
    imie: '',
    nazwisko: '',
    nazwaFirmy: '',
    nip: '',
    pesel: '',
    telefon: '',
    email: '',
    ulica: '',
    kod: '',
    miasto: '',
    osobaKontaktowa: {},
    etap: 'nowy',
    zrodlo: '',
    tagi: [],
    zgodaRodo: false,
    historia: [],
    utworzono: nowISO(),
    zaktualizowano: nowISO(),
  }
}

function NowyKlientModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const upsert = useStore((s) => s.upsert)
  const { push } = useToast()
  const nav = useNavigate()
  const [f, setF] = useState<Klient>(pustyFormularz)
  const [tagiTxt, setTagiTxt] = useState('')

  React.useEffect(() => {
    if (open) {
      setF(pustyFormularz())
      setTagiTxt('')
    }
  }, [open])

  const set = <K extends keyof Klient>(k: K, v: Klient[K]) => setF((s) => ({ ...s, [k]: v }))
  const setKontakt = (patch: Partial<NonNullable<Klient['osobaKontaktowa']>>) =>
    setF((s) => ({ ...s, osobaKontaktowa: { ...s.osobaKontaktowa, ...patch } }))

  const nipZly = !!f.nip && !validNIP(f.nip)

  const nazwaOk = f.typ === 'firma' ? !!f.nazwaFirmy?.trim() : !!(f.imie?.trim() || f.nazwisko?.trim())

  const zapisz = () => {
    if (!nazwaOk) {
      push(f.typ === 'firma' ? 'Podaj nazwę firmy' : 'Podaj imię lub nazwisko', 'err')
      return
    }
    const teraz = nowISO()
    const rekord: Klient = {
      ...f,
      tagi: tagiTxt
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      zgodaRodoData: f.zgodaRodo ? teraz : undefined,
      utworzono: teraz,
      zaktualizowano: teraz,
    }
    upsert('klienci', rekord)
    push('Dodano klienta', 'ok')
    onClose()
    nav(`/klienci/${rekord.id}`)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nowy klient"
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={zapisz}>
            <Plus size={16} /> Dodaj klienta
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Typ */}
        <div className="flex gap-2">
          {(['osoba', 'firma'] as KlientTyp[]).map((t) => (
            <button
              key={t}
              onClick={() => set('typ', t)}
              className={cx(
                'flex-1 rounded-xl border px-3 py-2.5 text-[14px] font-medium transition',
                f.typ === t ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-stone-200 text-stone-500 hover:bg-stone-50',
              )}
            >
              <span className="inline-flex items-center gap-2">
                {t === 'firma' ? <Building2 size={16} /> : <UserRound size={16} />}
                {t === 'firma' ? 'Firma' : 'Osoba prywatna'}
              </span>
            </button>
          ))}
        </div>

        {f.typ === 'osoba' ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Imię">
              <Input value={f.imie || ''} onChange={(e) => set('imie', e.target.value)} placeholder="np. Jan" />
            </Field>
            <Field label="Nazwisko">
              <Input value={f.nazwisko || ''} onChange={(e) => set('nazwisko', e.target.value)} placeholder="np. Kowalski" />
            </Field>
            <Field
              label="PESEL (opcjonalnie)"
              hint="Przechowywany bezpiecznie, w widoku maskowany."
              className="sm:col-span-2"
            >
              <Input
                value={f.pesel || ''}
                onChange={(e) => set('pesel', e.target.value.replace(/\D/g, '').slice(0, 11))}
                placeholder="—"
                inputMode="numeric"
              />
            </Field>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Nazwa firmy" className="sm:col-span-2">
              <Input value={f.nazwaFirmy || ''} onChange={(e) => set('nazwaFirmy', e.target.value)} placeholder="np. Kuchnie Studio Sp. z o.o." />
            </Field>
            <Field label="NIP" error={nipZly ? 'Nieprawidłowy NIP (suma kontrolna).' : undefined}>
              <Input value={f.nip || ''} onChange={(e) => set('nip', e.target.value)} placeholder="0000000000" inputMode="numeric" />
            </Field>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Telefon">
            <Input value={f.telefon || ''} onChange={(e) => set('telefon', e.target.value)} placeholder="+48 …" inputMode="tel" />
          </Field>
          <Field label="E-mail">
            <Input value={f.email || ''} onChange={(e) => set('email', e.target.value)} placeholder="klient@example.com" inputMode="email" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Ulica i nr" className="sm:col-span-3">
            <Input value={f.ulica || ''} onChange={(e) => set('ulica', e.target.value)} placeholder="np. Kwiatowa 12" />
          </Field>
          <Field label="Kod pocztowy">
            <Input value={f.kod || ''} onChange={(e) => set('kod', e.target.value)} placeholder="00-000" />
          </Field>
          <Field label="Miasto" className="sm:col-span-2">
            <Input value={f.miasto || ''} onChange={(e) => set('miasto', e.target.value)} placeholder="np. Warszawa" />
          </Field>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Źródło">
            <Input value={f.zrodlo || ''} onChange={(e) => set('zrodlo', e.target.value)} placeholder="polecenie, Google, deweloper…" />
          </Field>
          <Field label="Etap">
            <Select value={f.etap} onChange={(e) => set('etap', e.target.value as PipelineEtap)}>
              {PIPELINE.map((p) => (
                <option key={p.klucz} value={p.klucz}>
                  {p.nazwa}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <Field label="Tagi" hint="Oddziel przecinkami, np. blat, łazienka, deweloper">
          <Input value={tagiTxt} onChange={(e) => setTagiTxt(e.target.value)} placeholder="blat, kuchnia…" />
        </Field>

        <Field label="Osoba kontaktowa (opcjonalnie)">
          <div className="grid gap-2 sm:grid-cols-3">
            <Input
              value={f.osobaKontaktowa?.imieNazwisko || ''}
              onChange={(e) => setKontakt({ imieNazwisko: e.target.value })}
              placeholder="Imię i nazwisko"
            />
            <Input
              value={f.osobaKontaktowa?.telefon || ''}
              onChange={(e) => setKontakt({ telefon: e.target.value })}
              placeholder="Telefon"
            />
            <Input
              value={f.osobaKontaktowa?.email || ''}
              onChange={(e) => setKontakt({ email: e.target.value })}
              placeholder="E-mail"
            />
          </div>
        </Field>

        <div className="rounded-xl bg-stone-50 p-3">
          <Toggle
            checked={!!f.zgodaRodo}
            onChange={(v) => set('zgodaRodo', v)}
            label="Klient wyraził zgodę na przetwarzanie danych (RODO)"
          />
        </div>
      </div>
    </Modal>
  )
}

// ============================================================================
// KARTA KLIENTA (widok szczegółowy)
// ============================================================================
function KartaKlienta({ id }: { id: string }) {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()
  const nav = useNavigate()

  const k = b.klienci.find((x) => x.id === id)
  const [peselWidoczny, setPeselWidoczny] = useState(false)
  const [nowaNotatka, setNowaNotatka] = useState('')
  const [typNotatki, setTypNotatki] = useState<WpisHistorii['typ']>('notatka')

  if (!k) {
    return (
      <div>
        <PageHeader title="Klient" icon={<Users size={22} />} />
        <EmptyState
          icon={<AlertTriangle size={26} />}
          title="Nie znaleziono klienta"
          desc="Rekord mógł zostać usunięty."
          action={
            <Link to="/klienci" className="btn-primary">
              <ArrowLeft size={16} /> Wróć do listy
            </Link>
          }
        />
      </div>
    )
  }

  const zapisz = (patch: Partial<Klient>) => {
    upsert('klienci', { ...k, ...patch, zaktualizowano: nowISO() })
  }

  const zmienEtap = (etap: PipelineEtap) => {
    if (etap === k.etap) return
    const wpis: WpisHistorii = {
      id: uid('h'),
      data: nowISO(),
      typ: 'status',
      tresc: `Zmiana etapu na: ${etapInfo(etap).nazwa}`,
    }
    zapisz({ etap, historia: [wpis, ...k.historia] })
    push(`Etap: ${etapInfo(etap).nazwa}`, 'ok')
  }

  const dodajWpis = () => {
    const tresc = nowaNotatka.trim()
    if (!tresc) return
    const wpis: WpisHistorii = { id: uid('h'), data: nowISO(), typ: typNotatki, tresc }
    zapisz({ historia: [wpis, ...k.historia] })
    setNowaNotatka('')
    setTypNotatki('notatka')
    push('Dodano wpis', 'ok')
  }

  const usunWpis = (wpisId: string) => {
    zapisz({ historia: k.historia.filter((h) => h.id !== wpisId) })
  }

  const usunKlienta = async () => {
    if (await confirm(`Usunąć klienta „${klientNazwa(k)}" wraz z historią? Operacja jest nieodwracalna.`)) {
      remove('klienci', k.id)
      push('Usunięto klienta', 'ok')
      nav('/klienci')
    }
  }

  const ei = etapInfo(k.etap)
  const adres = klientAdres(k)
  const smsTresc = `Dzień dobry, ${klientNazwa(k)}. Pisze do Pana/Pani ${firma.marka}.`
  const mailBody = `Dzień dobry,\n\n\n\nZ poważaniem\n${firma.wlasciciel}\n${firma.marka}\ntel. ${firma.telefon}`

  return (
    <div>
      {confirmNode}
      <PageHeader
        title={klientNazwa(k)}
        subtitle={`Karta klienta CRM${k.zrodlo ? ` · źródło: ${k.zrodlo}` : ''}`}
        icon={k.typ === 'firma' ? <Building2 size={22} /> : <UserRound size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/klienci" className="btn-outline">
              <ArrowLeft size={16} /> Lista
            </Link>
            <PrintSendBar
              getPrintNode={() => <KartaKlientaDoc k={k} firma={firma} logoDataUrl={b.ustawienia.logoDataUrl} />}
              share={{
                title: `Karta klienta — ${klientNazwa(k)}`,
                text: `${klientNazwa(k)}\n${k.telefon || ''}\n${k.email || ''}\n${adres}`,
                to: k.email,
                phone: k.telefon,
              }}
            />
          </div>
        }
      />

      {/* Pasek etapów (stepper) */}
      <Card className="mb-6">
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[13px] font-semibold uppercase tracking-wide text-stone-500">Status realizacji</h3>
            <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PIPELINE.filter((p) => p.klucz !== 'utracony').map((p) => {
              const aktywny = p.klucz === k.etap
              return (
                <button
                  key={p.klucz}
                  onClick={() => zmienEtap(p.klucz)}
                  className={cx(
                    'rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition',
                    aktywny
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'border border-stone-200 text-stone-500 hover:border-brand-300 hover:bg-brand-50',
                  )}
                >
                  {p.nazwa}
                </button>
              )
            })}
            <button
              onClick={() => zmienEtap('utracony')}
              className={cx(
                'ml-auto rounded-xl px-3 py-1.5 text-[12.5px] font-medium transition',
                k.etap === 'utracony' ? 'bg-red-600 text-white' : 'border border-stone-200 text-stone-400 hover:bg-red-500/15 hover:text-red-600',
              )}
            >
              Utracony
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Szybkie akcje */}
      <SectionCard title="Akcje" icon={<ChevronRight size={18} />} className="mb-6">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          <Link to="/kalendarz" className="akcja">
            <Ruler size={18} /> Zleć pomiar
          </Link>
          <Link to="/wyceny" className="akcja">
            <Calculator size={18} /> Wyślij ofertę
          </Link>
          <Link to="/umowy" className="akcja">
            <FileSignature size={18} /> Generuj umowę
          </Link>
          <Link to="/zlecenia" className="akcja">
            <ClipboardList size={18} /> Generuj zlecenie
          </Link>
          <Link to="/dokumenty" className="akcja">
            <FileCheck2 size={18} /> Protokół odbioru
          </Link>
          <a href={mailtoLink({ to: k.email, subject: `Wiadomość od ${firma.marka}`, body: mailBody })} className="akcja">
            <Mail size={18} /> Wyślij maila
          </a>
          {k.telefon ? (
            <a href={smsLink(k.telefon, smsTresc)} className="akcja">
              <MessageSquare size={18} /> Wyślij SMS
            </a>
          ) : (
            <span className="akcja pointer-events-none opacity-40">
              <MessageSquare size={18} /> Wyślij SMS
            </span>
          )}
          <button onClick={usunKlienta} className="akcja text-red-600 hover:!border-red-500/40 hover:!bg-red-500/15">
            <Trash2 size={18} /> Usuń klienta
          </button>
        </div>
        <style>{`.akcja{display:flex;align-items:center;gap:.5rem;justify-content:center;border:1px solid #e5e1d8;border-radius:.75rem;padding:.6rem .75rem;font-size:13px;font-weight:500;color:#57534e;transition:all .15s}.akcja:hover{border-color:#7bb899;background:#f0f7f2;color:#0f5c3f}`}</style>
      </SectionCard>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolumna lewa: dane */}
        <div className="space-y-6 lg:col-span-2">
          {/* Dane podstawowe */}
          <SectionCard title="Dane podstawowe" icon={<UserRound size={18} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <EdytPole label="Telefon" value={k.telefon} onSave={(v) => zapisz({ telefon: v })} icon={<Phone size={14} />} />
              <EdytPole label="E-mail" value={k.email} onSave={(v) => zapisz({ email: v })} icon={<Mail size={14} />} />
              <EdytPole label="Ulica i nr" value={k.ulica} onSave={(v) => zapisz({ ulica: v })} />
              <EdytPole label="Kod pocztowy" value={k.kod} onSave={(v) => zapisz({ kod: v })} />
              <EdytPole label="Miasto" value={k.miasto} onSave={(v) => zapisz({ miasto: v })} />
              <EdytPole label="Źródło" value={k.zrodlo} onSave={(v) => zapisz({ zrodlo: v })} />
              {k.typ === 'firma' ? (
                <div>
                  <div className="label">NIP</div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] text-ink">{k.nip ? fmtNIP(k.nip) : '—'}</span>
                    {k.nip && !validNIP(k.nip) && (
                      <span className="inline-flex items-center gap-1 text-[11.5px] text-amber-600" title="NIP nie przechodzi walidacji sumy kontrolnej">
                        <AlertTriangle size={12} /> sprawdź NIP
                      </span>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <div className="label">PESEL</div>
                  <button
                    className="text-[14px] text-ink underline decoration-dotted underline-offset-2"
                    title={peselWidoczny ? 'Kliknij, aby ukryć' : 'Dane wrażliwe — kliknij, aby pokazać'}
                    onClick={() => setPeselWidoczny((v) => !v)}
                  >
                    {k.pesel ? (peselWidoczny ? k.pesel : maskPesel(k.pesel)) : '—'}
                  </button>
                </div>
              )}
            </div>

            {/* Tagi */}
            <div className="mt-4">
              <div className="label flex items-center gap-1.5">
                <Tag size={13} /> Tagi
              </div>
              <TagiEdytor tagi={k.tagi} onChange={(tagi) => zapisz({ tagi })} />
            </div>
          </SectionCard>

          {/* Osoba kontaktowa */}
          <SectionCard title="Osoba kontaktowa" icon={<UserRound size={18} />}>
            <div className="grid gap-4 sm:grid-cols-3">
              <EdytPole
                label="Imię i nazwisko"
                value={k.osobaKontaktowa?.imieNazwisko}
                onSave={(v) => zapisz({ osobaKontaktowa: { ...k.osobaKontaktowa, imieNazwisko: v } })}
              />
              <EdytPole
                label="Telefon"
                value={k.osobaKontaktowa?.telefon}
                onSave={(v) => zapisz({ osobaKontaktowa: { ...k.osobaKontaktowa, telefon: v } })}
              />
              <EdytPole
                label="E-mail"
                value={k.osobaKontaktowa?.email}
                onSave={(v) => zapisz({ osobaKontaktowa: { ...k.osobaKontaktowa, email: v } })}
              />
            </div>
          </SectionCard>

          {/* Osoby projektu */}
          <SectionCard title="Osoby projektu" icon={<Users size={18} />} desc="Współpracownicy powiązani z realizacją">
            <div className="grid gap-4 sm:grid-cols-2">
              {OSOBY_ROLE.map((r) => {
                const opcje = b.kontrahenci.filter((kn) => (r.typ ? kn.typ === r.typ : true))
                const wartosc = k.osobyProjektu?.[r.key] || ''
                return (
                  <Field key={r.key} label={r.label}>
                    <Select
                      value={wartosc}
                      onChange={(e) =>
                        zapisz({
                          osobyProjektu: { ...k.osobyProjektu, [r.key]: e.target.value || undefined },
                        })
                      }
                    >
                      <option value="">— nie przypisano —</option>
                      {opcje.map((kn) => (
                        <option key={kn.id} value={kn.id}>
                          {kn.nazwa}
                          {kn.firma ? ` (${kn.firma})` : ''}
                        </option>
                      ))}
                    </Select>
                  </Field>
                )
              })}
            </div>
          </SectionCard>

          {/* Notatki / historia */}
          <SectionCard title="Notatki i historia" icon={<StickyNote size={18} />}>
            <div className="mb-4 flex flex-col gap-2 sm:flex-row">
              <Select
                value={typNotatki}
                onChange={(e) => setTypNotatki(e.target.value as WpisHistorii['typ'])}
                className="sm:w-40"
              >
                <option value="notatka">Notatka</option>
                <option value="telefon">Telefon</option>
                <option value="email">E-mail</option>
                <option value="sms">SMS</option>
                <option value="pomiar">Pomiar</option>
                <option value="oferta">Oferta</option>
                <option value="platnosc">Płatność</option>
              </Select>
              <Input
                value={nowaNotatka}
                onChange={(e) => setNowaNotatka(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && dodajWpis()}
                placeholder="Dodaj wpis do historii…"
                className="flex-1"
              />
              <button className="btn-primary" onClick={dodajWpis}>
                <Plus size={16} /> Dodaj
              </button>
            </div>

            {k.historia.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-stone-400">Brak wpisów. Dodaj pierwszą notatkę powyżej.</p>
            ) : (
              <div className="space-y-2">
                {k.historia.map((h) => (
                  <div key={h.id} className="group flex items-start gap-3 rounded-xl border border-stone-100 px-3 py-2.5">
                    <span className="mt-0.5 shrink-0">
                      <Badge tone="stone">{h.typ}</Badge>
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] text-stone-700">{h.tresc}</div>
                      <div className="mt-0.5 flex items-center gap-1 text-[11px] text-stone-400">
                        <Clock size={11} /> {fmtDateTime(h.data)}
                      </div>
                    </div>
                    <button
                      onClick={() => usunWpis(h.id)}
                      className="shrink-0 text-stone-300 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                      title="Usuń wpis"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        {/* Kolumna prawa: dane dokumentowe + RODO */}
        <div className="space-y-6">
          <SectionCard title="Dane do umowy / faktury" icon={<FileSignature size={18} />}>
            <div className="space-y-1 text-[13.5px] text-stone-600">
              <div className="font-semibold text-ink">{klientNazwa(k)}</div>
              {adres && <div>{adres}</div>}
              {k.typ === 'firma' && k.nip && <div>NIP: {fmtNIP(k.nip)}</div>}
              {k.typ === 'osoba' && k.pesel && <div>PESEL: {maskPesel(k.pesel)}</div>}
              {k.telefon && <div>tel. {k.telefon}</div>}
              {k.email && <div>{k.email}</div>}
            </div>
          </SectionCard>

          <SectionCard title="Dane do pomiaru" icon={<Ruler size={18} />}>
            <Textarea
              value={k.daneDoPomiaru || ''}
              onChange={(e) => zapisz({ daneDoPomiaru: e.target.value })}
              placeholder="Adres i szczegóły pomiaru, dostęp, piętro, kod do bramy…"
              rows={4}
            />
          </SectionCard>

          <SectionCard title="Dodatkowe informacje" icon={<StickyNote size={18} />}>
            <Textarea
              value={k.dodatkoweInfo || ''}
              onChange={(e) => zapisz({ dodatkoweInfo: e.target.value })}
              placeholder="Preferencje, materiał, uwagi handlowe…"
              rows={4}
            />
          </SectionCard>

          {/* RODO */}
          <SectionCard title="Zgoda RODO" icon={<ShieldCheck size={18} />}>
            <p className="mb-3 text-[12px] leading-relaxed text-stone-500">{b.ustawienia.klauzulaRodo}</p>
            <div className="rounded-xl bg-stone-50 p-3">
              <Toggle
                checked={!!k.zgodaRodo}
                onChange={(v) => zapisz({ zgodaRodo: v, zgodaRodoData: v ? nowISO() : undefined })}
                label="Klient wyraził zgodę na przetwarzanie danych"
              />
              {k.zgodaRodo && k.zgodaRodoData && (
                <div className="mt-2 text-[11.5px] text-stone-400">Udzielono: {fmtDateTime(k.zgodaRodoData)}</div>
              )}
            </div>
          </SectionCard>

          <div className="text-center text-[11.5px] text-stone-400">
            Utworzono {fmtDate(k.utworzono)} · aktualizacja {fmtDate(k.zaktualizowano)}
          </div>
        </div>
      </div>
    </div>
  )
}

// ---------- Pole edytowalne inline ----------
function EdytPole({
  label,
  value,
  onSave,
  icon,
}: {
  label: string
  value?: string
  onSave: (v: string) => void
  icon?: React.ReactNode
}) {
  const [edycja, setEdycja] = useState(false)
  const [v, setV] = useState(value || '')

  React.useEffect(() => {
    if (!edycja) setV(value || '')
  }, [value, edycja])

  const zatwierdz = () => {
    setEdycja(false)
    if (v !== (value || '')) onSave(v.trim())
  }

  return (
    <div>
      <div className="label flex items-center gap-1.5">
        {icon}
        {label}
      </div>
      {edycja ? (
        <Input
          autoFocus
          value={v}
          onChange={(e) => setV(e.target.value)}
          onBlur={zatwierdz}
          onKeyDown={(e) => {
            if (e.key === 'Enter') zatwierdz()
            if (e.key === 'Escape') {
              setV(value || '')
              setEdycja(false)
            }
          }}
        />
      ) : (
        <button
          onClick={() => setEdycja(true)}
          className="w-full rounded-lg px-1 py-1 text-left text-[14px] text-ink transition hover:bg-stone-50"
          title="Kliknij, aby edytować"
        >
          {value || <span className="text-stone-300">— dodaj —</span>}
        </button>
      )}
    </div>
  )
}

// ---------- Edytor tagów ----------
function TagiEdytor({ tagi, onChange }: { tagi: string[]; onChange: (t: string[]) => void }) {
  const [txt, setTxt] = useState('')
  const dodaj = () => {
    const t = txt.trim()
    if (t && !tagi.includes(t)) onChange([...tagi, t])
    setTxt('')
  }
  return (
    <div>
      <div className="flex flex-wrap gap-1.5">
        {tagi.map((t) => (
          <span key={t} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-2.5 py-1 text-[12px] font-medium text-brand-700">
            {t}
            <button onClick={() => onChange(tagi.filter((x) => x !== t))} className="text-brand-400 hover:text-red-500">
              ×
            </button>
          </span>
        ))}
        {tagi.length === 0 && <span className="text-[13px] text-stone-300">brak tagów</span>}
      </div>
      <div className="mt-2 flex gap-2">
        <Input
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && dodaj()}
          placeholder="Nowy tag…"
          className="max-w-[200px]"
        />
        <button className="btn-outline btn-sm" onClick={dodaj}>
          <Plus size={14} /> Dodaj
        </button>
      </div>
    </div>
  )
}

// ============================================================================
// DOKUMENT DO WYDRUKU: KARTA KLIENTA
// ============================================================================
function KartaKlientaDoc({ k, firma, logoDataUrl }: { k: Klient; firma: Firma; logoDataUrl?: string }) {
  const ei = etapInfo(k.etap)
  const adres = klientAdres(k)
  const secHead: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#0f5c3f',
    color: '#fff',
    fontSize: '8.5pt',
    fontWeight: 700,
    borderRadius: 6,
    padding: '3px 9px',
    marginBottom: 6,
  }
  const box: React.CSSProperties = { border: '1px solid #c9c4b6', borderRadius: 10, padding: '9px 11px' }

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fraunces Variable', serif", fontWeight: 600, fontSize: '17pt', color: '#0f5c3f', letterSpacing: '0.03em' }}>
          KARTA KLIENTA
        </div>
        <div style={{ fontSize: '9pt', color: '#4a463f', marginTop: 2 }}>
          Etap: <b>{ei.nazwa}</b>
          {k.zrodlo ? ` · Źródło: ${k.zrodlo}` : ''}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={box}>
          <div style={secHead}>DANE KLIENTA</div>
          <DRow l="Nazwa:" v={klientNazwa(k)} />
          <DRow l="Typ:" v={k.typ === 'firma' ? 'Firma' : 'Osoba prywatna'} />
          {k.typ === 'firma' && <DRow l="NIP:" v={k.nip ? fmtNIP(k.nip) : ''} />}
          {k.typ === 'osoba' && k.pesel && <DRow l="PESEL:" v={maskPesel(k.pesel)} />}
          <DRow l="Adres:" v={adres} />
        </div>
        <div style={box}>
          <div style={secHead}>KONTAKT</div>
          <DRow l="Telefon:" v={k.telefon} />
          <DRow l="E-mail:" v={k.email} />
          {k.osobaKontaktowa?.imieNazwisko && <DRow l="Os. kontakt.:" v={k.osobaKontaktowa.imieNazwisko} />}
          {k.osobaKontaktowa?.telefon && <DRow l="Tel. kontakt.:" v={k.osobaKontaktowa.telefon} />}
        </div>
      </div>

      {(k.daneDoPomiaru || k.dodatkoweInfo || (k.tagi && k.tagi.length > 0)) && (
        <div style={{ ...box, marginTop: 10 }}>
          <div style={secHead}>INFORMACJE DODATKOWE</div>
          {k.tagi && k.tagi.length > 0 && <DRow l="Tagi:" v={k.tagi.join(', ')} />}
          {k.daneDoPomiaru && <DRow l="Dane do pomiaru:" v={k.daneDoPomiaru} />}
          {k.dodatkoweInfo && <DRow l="Uwagi:" v={k.dodatkoweInfo} />}
        </div>
      )}

      {k.historia.length > 0 && (
        <div style={{ ...box, marginTop: 10 }}>
          <div style={secHead}>HISTORIA KONTAKTU</div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
            <tbody>
              {k.historia.slice(0, 12).map((h) => (
                <tr key={h.id}>
                  <td style={{ padding: '3px 6px', color: '#6b6459', whiteSpace: 'nowrap', verticalAlign: 'top', borderBottom: '1px solid #e6e2d8' }}>
                    {fmtDate(h.data)}
                  </td>
                  <td style={{ padding: '3px 6px', color: '#6b6459', whiteSpace: 'nowrap', verticalAlign: 'top', borderBottom: '1px solid #e6e2d8' }}>
                    {h.typ}
                  </td>
                  <td style={{ padding: '3px 6px', color: '#12130f', borderBottom: '1px solid #e6e2d8' }}>{h.tresc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: '8pt', color: '#8a8478' }}>
        Zgoda RODO: <b>{k.zgodaRodo ? 'TAK' : 'NIE'}</b>
        {k.zgodaRodo && k.zgodaRodoData ? ` (${fmtDate(k.zgodaRodoData)})` : ''} · Karta utworzona {fmtDate(k.utworzono)}
      </div>
    </DocSheet>
  )
}

function DRow({ l, v }: { l: string; v?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 3, alignItems: 'baseline' }}>
      <span style={{ color: '#4a463f', fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{l}</span>
      <span style={{ flex: 1, borderBottom: '1px dotted #b3ae9f', fontSize: '9pt', fontWeight: 500, minHeight: '1.1em' }}>{v || ' '}</span>
    </div>
  )
}
