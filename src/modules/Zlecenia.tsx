import { useState, useMemo, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom'
import { skanyDlaZlecenia, subskrybujSkany } from '../lib/skanyDb'
import { useCloud } from '../lib/cloud'
import {
  ClipboardList,
  Plus,
  ArrowLeft,
  MapPin,
  CalendarDays,
  Wallet,
  Users,
  Check,
  Trash2,
  Calculator,
  FileSignature,
  ClipboardCheck,
  Receipt,
  StickyNote,
  ScanLine,
  FileText,
  ArrowDownUp,
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
  Badge,
  Modal,
  SearchInput,
  EmptyState,
  useToast,
  useConfirm,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { KlientPicker } from '../components/KlientPicker'
import { SkanImg } from '../components/SkanImg'
import { Skaner } from '../components/Skaner'
import { useAuth } from '../components/Auth'
import { fmtPLN, fmtDate, parseNum, nowISO, today } from '../lib/format'
import { klientNazwa, klientAdres, PIPELINE, etapInfo, domyslneEtapyZlecenia } from '../lib/helpers'
import { uid } from '../lib/id'
import type { Zlecenie, Firma, Klient, PipelineEtap, Skan } from '../lib/types'
import { DocSheet, DocTitle, DocSection, DocLine } from '../documents/DocShell'

// ============================================================================
// Modul ZLECENIA - lista realizacji + widok szczegolowy z checklista etapow
// ============================================================================

// Data zlecenia do sortowania/segregacji (z.data, a jak brak - dzien utworzenia).
const dataZlecenia = (z: Zlecenie) => z.data || (z.utworzono ? z.utworzono.slice(0, 10) : '')
// Klucz sortowania po numerze "ZL 12/2026" -> rok*100000 + numer (rosnaco).
const numerSortKey = (n: string) => {
  const m = /(\d+)\s*\/\s*(\d{4})/.exec(n || '')
  return m ? Number(m[2]) * 100000 + Number(m[1]) : 0
}
const MIESIACE: [string, string][] = [
  ['01', 'Styczeń'],
  ['02', 'Luty'],
  ['03', 'Marzec'],
  ['04', 'Kwiecień'],
  ['05', 'Maj'],
  ['06', 'Czerwiec'],
  ['07', 'Lipiec'],
  ['08', 'Sierpień'],
  ['09', 'Wrzesień'],
  ['10', 'Październik'],
  ['11', 'Listopad'],
  ['12', 'Grudzień'],
]

export default function Zlecenia() {
  const { id } = useParams<{ id: string }>()
  const b = useStore((s) => s.baza)

  if (id) {
    const z = b.zlecenia.find((x) => x.id === id)
    if (!z) return <NieZnaleziono />
    return <Szczegoly z={z} />
  }
  return <Lista />
}

// ---------- LISTA ----------
function Lista() {
  const b = useStore((s) => s.baza)
  const { user } = useAuth()
  const ukryjKwoty = user?.rola === 'montazysta'
  const [szukaj, setSzukaj] = useState('')
  const [filtr, setFiltr] = useState<PipelineEtap | 'all'>('all')
  const [rok, setRok] = useState<string>('all')
  const [miesiac, setMiesiac] = useState<string>('all')
  const [sortuj, setSortuj] = useState<'data-desc' | 'data-asc' | 'numer'>('data-desc')
  const [openNowe, setOpenNowe] = useState(false)

  const klientMap = useMemo(() => {
    const m = new Map<string, Klient>()
    b.klienci.forEach((k) => m.set(k.id, k))
    return m
  }, [b.klienci])

  const lata = useMemo(() => {
    const s = new Set<string>()
    b.zlecenia.forEach((z) => {
      const d = dataZlecenia(z)
      if (d) s.add(d.slice(0, 4))
    })
    return [...s].sort((a, c) => c.localeCompare(a))
  }, [b.zlecenia])

  const widoczne = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    const lista = b.zlecenia
      .filter((z) => (filtr === 'all' ? true : z.etap === filtr))
      .filter((z) => (rok === 'all' ? true : dataZlecenia(z).slice(0, 4) === rok))
      .filter((z) => (miesiac === 'all' ? true : dataZlecenia(z).slice(5, 7) === miesiac))
      .filter((z) => {
        if (!q) return true
        const kl = z.klientId ? klientNazwa(klientMap.get(z.klientId)) : ''
        return [z.tytul, z.numer, kl].filter(Boolean).some((s) => s.toLowerCase().includes(q))
      })
      .slice()
    lista.sort((a, c) => {
      if (sortuj === 'numer') return numerSortKey(c.numer) - numerSortKey(a.numer)
      const da = dataZlecenia(a)
      const dc = dataZlecenia(c)
      return sortuj === 'data-asc' ? da.localeCompare(dc) : dc.localeCompare(da)
    })
    return lista
  }, [b.zlecenia, filtr, rok, miesiac, sortuj, szukaj, klientMap])

  const licznik = (e: PipelineEtap | 'all') =>
    e === 'all' ? b.zlecenia.length : b.zlecenia.filter((z) => z.etap === e).length

  return (
    <div>
      <PageHeader
        title="Zlecenia"
        subtitle="Realizacje i projekty od zapytania po odbiór"
        icon={<ClipboardList size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setOpenNowe(true)}>
            <Plus size={17} /> Nowe zlecenie
          </button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj po numerze, kliencie lub opisie..." />
        </div>
        <div className="flex items-center gap-1.5">
          <ArrowDownUp size={15} className="text-stone-400" />
          <Select className="w-auto" value={sortuj} onChange={(e) => setSortuj(e.target.value as typeof sortuj)}>
            <option value="data-desc">Data: najnowsze</option>
            <option value="data-asc">Data: najstarsze</option>
            <option value="numer">Numer zlecenia</option>
          </Select>
        </div>
        {lata.length > 0 && (
          <div className="flex items-center gap-1.5">
            <CalendarDays size={15} className="text-stone-400" />
            <Select className="w-auto" value={rok} onChange={(e) => setRok(e.target.value)}>
              <option value="all">Wszystkie lata</option>
              {lata.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </Select>
          </div>
        )}
        <Select className="w-auto" value={miesiac} onChange={(e) => setMiesiac(e.target.value)}>
          <option value="all">Wszystkie miesiące</option>
          {MIESIACE.map(([nr, nazwa]) => (
            <option key={nr} value={nr}>
              {nazwa}
            </option>
          ))}
        </Select>
      </div>

      <div className="no-print mb-4 flex flex-wrap gap-2">
        <FiltrChip active={filtr === 'all'} onClick={() => setFiltr('all')} label="Wszystkie" n={licznik('all')} />
        {PIPELINE.map((p) => (
          <FiltrChip
            key={p.klucz}
            active={filtr === p.klucz}
            onClick={() => setFiltr(p.klucz)}
            label={p.nazwa}
            n={licznik(p.klucz)}
          />
        ))}
      </div>

      {widoczne.length === 0 ? (
        b.zlecenia.length === 0 ? (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="Brak zleceń"
            desc="Dodaj pierwsze zlecenie, aby prowadzić realizację przez kolejne etapy."
            action={
              <button className="btn-primary" onClick={() => setOpenNowe(true)}>
                <Plus size={17} /> Nowe zlecenie
              </button>
            }
          />
        ) : (
          <EmptyState
            icon={<ClipboardList size={26} />}
            title="Brak wyników"
            desc="Żadne zlecenie nie pasuje do wyszukiwania lub filtrów. Zmień kryteria powyżej."
          />
        )
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {widoczne.map((z) => {
            const ei = etapInfo(z.etap)
            const kl = z.klientId ? klientMap.get(z.klientId) : undefined
            const zrobione = z.etapy.filter((e) => e.zrobione).length
            return (
              <Link key={z.id} to={`/zlecenia/${z.id}`}>
                <Card className="h-full transition hover:border-brand-300 hover:shadow-pop">
                  <CardBody>
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-[15px] font-semibold text-ink">{z.numer}</div>
                        <div className="flex items-center gap-1.5 text-[12px] text-stone-400">
                          <CalendarDays size={12} /> {fmtDate(dataZlecenia(z)) || '—'}
                        </div>
                      </div>
                      <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
                    </div>
                    {z.tytul && <div className="mb-2 line-clamp-2 text-[13px] text-stone-500">{z.tytul}</div>}
                    <div className="space-y-1 text-[13px] text-stone-500">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-stone-400" /> {kl ? klientNazwa(kl) : '- brak klienta'}
                      </div>
                      {z.adres && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-stone-400" /> <span className="truncate">{z.adres}</span>
                        </div>
                      )}
                      {!ukryjKwoty && !!(z.wartoscBrutto || z.wartoscNetto) && (
                        <div className="flex items-center gap-1.5">
                          <Wallet size={14} className="text-stone-400" /> {fmtPLN(z.wartoscBrutto || z.wartoscNetto)}
                          {z.wartoscBrutto ? ' brutto' : ' netto'}
                        </div>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-stone-100">
                        <div
                          className="h-full rounded-full bg-brand-600"
                          style={{ width: `${(zrobione / Math.max(1, z.etapy.length)) * 100}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-medium text-stone-400">
                        {zrobione}/{z.etapy.length}
                      </span>
                    </div>
                  </CardBody>
                </Card>
              </Link>
            )
          })}
        </div>
      )}

      <NoweZlecenieModal open={openNowe} onClose={() => setOpenNowe(false)} />
    </div>
  )
}

function FiltrChip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      onClick={onClick}
      className={
        active
          ? 'rounded-full bg-brand-700 px-3.5 py-1.5 text-[13px] font-medium text-white'
          : 'rounded-full border border-black/10 bg-black/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-stone-600 hover:border-brand-300'
      }
    >
      {label} <span className={active ? 'text-white/70' : 'text-stone-400'}>{n}</span>
    </button>
  )
}

// Sugerowany kolejny numer w formacie "N/RRRR" wg NAJWYZSZEGO numeru zlecenia firmy
// w danym roku (parsuje dowolny format zawierajacy N/RRRR). Numer i tak jest edytowalny -
// wpisuje sie numer z papierowego dokumentu firmy.
function sugerowanyNumerZlecenia(zlecenia: Zlecenie[], firmaId: string, rok: string): string {
  let max = 0
  for (const z of zlecenia) {
    if (z.firmaId !== firmaId) continue
    const m = /(\d+)\s*\/\s*(\d{4})/.exec(z.numer || '')
    if (m && m[2] === rok) max = Math.max(max, Number(m[1]))
  }
  return `${max + 1}/${rok}`
}

// ---------- NOWE ZLECENIE ----------
interface FormState {
  numer: string
  data: string
  klientId: string
  adres: string
  tytul: string // opcjonalny opis
  projektantId: string
  stolarzId: string
  wykonawcaId: string
  koordynatorId: string
  wartoscNetto: string
  wartoscBrutto: string
  dataPomiaru: string
  dataMontazu: string
  notatki: string
}
const pustyForm: FormState = {
  numer: '',
  data: '',
  klientId: '',
  adres: '',
  tytul: '',
  projektantId: '',
  stolarzId: '',
  wykonawcaId: '',
  koordynatorId: '',
  wartoscNetto: '',
  wartoscBrutto: '',
  dataPomiaru: '',
  dataMontazu: '',
  notatki: '',
}

function NoweZlecenieModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const { push } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>(() => ({ ...pustyForm, data: today() }))

  const set = (patch: Partial<FormState>) => setF((prev) => ({ ...prev, ...patch }))

  // Swiezy formularz przy kazdym otwarciu. Numeru NIE narzucamy - wpisuje sie numer
  // z papierowego dokumentu firmy (jedyny wazny). Data ustawiona na dzis, do zmiany.
  useEffect(() => {
    if (open) setF({ ...pustyForm, data: today() })
  }, [open])

  const projektanci = b.kontrahenci.filter((k) => k.typ === 'projektant')
  const stolarze = b.kontrahenci.filter((k) => k.typ === 'stolarz' || k.typ === 'studio_kuchenne')
  const wykonawcy = b.kontrahenci.filter((k) => k.typ === 'wykonawca')

  // Wybor klienta -> automatycznie zaciaga jego adres do zlecenia (mozna nadpisac).
  const wybierzKlienta = (klientId: string | undefined, klient?: Klient) => {
    setF((prev) => ({
      ...prev,
      klientId: klientId || '',
      adres: klient ? klientAdres(klient) || prev.adres : prev.adres,
    }))
  }

  const zapisz = (skanuj: boolean) => {
    const kl = f.klientId ? b.klienci.find((k) => k.id === f.klientId) : undefined
    const adres = f.adres.trim() || (kl ? klientAdres(kl) : '')
    const nowe: Zlecenie = {
      id: uid('zl'),
      // Numer wpisany z dokumentu; gdy pusty - podpowiedz kolejny wg najwyzszego (nie od 1).
      numer: f.numer.trim() || sugerowanyNumerZlecenia(b.zlecenia, firma.id, (f.data || today()).slice(0, 4)),
      firmaId: firma.id,
      klientId: f.klientId || undefined,
      data: f.data || today(),
      tytul: f.tytul.trim(),
      adres: adres || undefined,
      osoby: {
        projektantId: f.projektantId || undefined,
        stolarzId: f.stolarzId || undefined,
        wykonawcaId: f.wykonawcaId || undefined,
        koordynatorId: f.koordynatorId || undefined,
      },
      etap: 'nowy',
      etapy: domyslneEtapyZlecenia(),
      wartoscNetto: f.wartoscNetto ? parseNum(f.wartoscNetto) : undefined,
      wartoscBrutto: f.wartoscBrutto ? parseNum(f.wartoscBrutto) : undefined,
      dataPomiaru: f.dataPomiaru || undefined,
      dataMontazu: f.dataMontazu || undefined,
      notatki: f.notatki.trim() || undefined,
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    }
    upsert('zlecenia', nowe)
    push('Zlecenie utworzone', 'ok')
    setF({ ...pustyForm, data: today() })
    onClose()
    navigate(`/zlecenia/${nowe.id}`, skanuj ? { state: { skanuj: true } } : undefined)
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Nowe zlecenie"
      size="lg"
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-outline" onClick={() => zapisz(true)}>
            <ScanLine size={16} /> Utwórz i skanuj
          </button>
          <button className="btn-primary" onClick={() => zapisz(false)}>
            <Check size={16} /> Utwórz zlecenie
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Numer nadawany automatycznie + data zlecenia */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numer zlecenia" hint="Numer z Waszego dokumentu – wpisz własny (np. 111/2026)">
            <Input value={f.numer} onChange={(e) => set({ numer: e.target.value })} placeholder="np. 111/2026" />
          </Field>
          <Field label="Data zlecenia">
            <Input type="date" value={f.data} onChange={(e) => set({ data: e.target.value })} />
          </Field>
        </div>

        {/* Klient - wyszukiwarka z automatycznym zaciaganiem danych + tworzenie w locie */}
        <KlientPicker value={f.klientId || undefined} onChange={wybierzKlienta} autoFocus />

        <Field label="Adres realizacji" hint="Zaciągany z klienta – można zmienić">
          <Input value={f.adres} onChange={(e) => set({ adres: e.target.value })} placeholder="ul., kod, miasto" />
        </Field>

        <Field label="Opis / nazwa (opcjonalnie)">
          <Input
            value={f.tytul}
            onChange={(e) => set({ tytul: e.target.value })}
            placeholder="np. Blaty kuchenne – granit Steel Grey"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Projektant">
            <Select value={f.projektantId} onChange={(e) => set({ projektantId: e.target.value })}>
              <option value="">-</option>
              {projektanci.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stolarz / studio">
            <Select value={f.stolarzId} onChange={(e) => set({ stolarzId: e.target.value })}>
              <option value="">-</option>
              {stolarze.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Wykonawca">
            <Select value={f.wykonawcaId} onChange={(e) => set({ wykonawcaId: e.target.value })}>
              <option value="">-</option>
              {wykonawcy.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Koordynator">
            <Select value={f.koordynatorId} onChange={(e) => set({ koordynatorId: e.target.value })}>
              <option value="">-</option>
              {b.pracownicy.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.imie}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Wartość netto">
            <Input
              value={f.wartoscNetto}
              onChange={(e) => set({ wartoscNetto: e.target.value })}
              placeholder="0,00"
              inputMode="decimal"
            />
          </Field>
          <Field label="Wartość brutto">
            <Input
              value={f.wartoscBrutto}
              onChange={(e) => set({ wartoscBrutto: e.target.value })}
              placeholder="0,00"
              inputMode="decimal"
            />
          </Field>
          <Field label="Data pomiaru">
            <Input type="date" value={f.dataPomiaru} onChange={(e) => set({ dataPomiaru: e.target.value })} />
          </Field>
          <Field label="Data montażu">
            <Input type="date" value={f.dataMontazu} onChange={(e) => set({ dataMontazu: e.target.value })} />
          </Field>
        </div>

        <Field label="Notatki">
          <Textarea
            value={f.notatki}
            onChange={(e) => set({ notatki: e.target.value })}
            placeholder="Dodatkowe informacje o realizacji..."
          />
        </Field>
      </div>
    </Modal>
  )
}

// ---------- SZCZEGOLY ----------
function Szczegoly({ z }: { z: Zlecenie }) {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()
  const navigate = useNavigate()
  const { user } = useAuth()
  const ukryjKwoty = user?.rola === 'montazysta'

  const location = useLocation()
  const [skanerOpen, setSkanerOpen] = useState(false)
  const [podglad, setPodglad] = useState<Skan | null>(null)
  // Skany zlecenia ladujemy z tabeli (nie z blobu) - skaluje sie i widac je od razu na innych urzadzeniach.
  const skanyWs = useCloud((s) => s.workspaceId) // gdy chmura sie polaczy -> zaladuj i subskrybuj ponownie
  const [skany, setSkany] = useState<Skan[] | null>(null) // null = jeszcze nie wczytano (nie myl z "brak")
  const odswiezSkany = useCallback(() => {
    skanyDlaZlecenia(z.id)
      .then(setSkany)
      .catch(() => setSkany([]))
  }, [z.id])
  useEffect(() => {
    odswiezSkany()
    let t: ReturnType<typeof setTimeout> | undefined
    const off = subskrybujSkany(() => {
      clearTimeout(t)
      t = setTimeout(odswiezSkany, 400) // debounce: seria zmian (offload) -> jedno przeladowanie
    })
    return () => {
      clearTimeout(t)
      off()
    }
  }, [odswiezSkany, skanyWs])

  const klient = z.klientId ? b.klienci.find((k) => k.id === z.klientId) : undefined
  const ei = etapInfo(z.etap)

  // Po "Utworz i skanuj" otwieramy skaner od razu (raz).
  useEffect(() => {
    if ((location.state as { skanuj?: boolean } | null)?.skanuj) {
      setSkanerOpen(true)
      window.history.replaceState({}, '')
    }
  }, [location.state])

  const update = (patch: Partial<Zlecenie>) => upsert('zlecenia', { ...z, ...patch, zaktualizowano: nowISO() })

  const toggleEtap = (idx: number) => {
    const etapy = z.etapy.map((e, i) =>
      i === idx ? { ...e, zrobione: !e.zrobione, data: !e.zrobione ? today() : undefined } : e,
    )
    update({ etapy })
  }

  const usun = async () => {
    if (await confirm(`Usunąć zlecenie ${z.numer}? Tej operacji nie można cofnąć.`)) {
      remove('zlecenia', z.id)
      push('Zlecenie usunięte', 'ok')
      navigate('/zlecenia')
    }
  }

  const kontrahentNazwa = (id?: string) => (id ? b.kontrahenci.find((k) => k.id === id)?.nazwa : undefined)
  const pracownikNazwa = (id?: string) => (id ? b.pracownicy.find((p) => p.id === id)?.imie : undefined)

  const os = z.osoby || {}
  const osoby = [
    { label: 'Projektant', v: kontrahentNazwa(os.projektantId) },
    { label: 'Stolarz / studio', v: kontrahentNazwa(os.stolarzId) },
    { label: 'Wykonawca', v: kontrahentNazwa(os.wykonawcaId) },
    { label: 'Koordynator', v: pracownikNazwa(os.koordynatorId) },
  ].filter((o) => o.v)

  const shareText = [
    `Zlecenie ${z.numer}${z.tytul ? ': ' + z.tytul : ''}`,
    `Data: ${fmtDate(dataZlecenia(z))}`,
    klient ? `Klient: ${klientNazwa(klient)}` : '',
    klient?.telefon ? `Tel. klienta: ${klient.telefon}` : '',
    z.adres ? `Adres: ${z.adres}` : '',
    `Etap: ${ei.nazwa}`,
    z.dataPomiaru ? `Pomiar: ${fmtDate(z.dataPomiaru)}` : '',
    z.dataMontazu ? `Montaż: ${fmtDate(z.dataMontazu)}` : '',
    ...osoby.map((o) => `${o.label}: ${o.v}`),
    ukryjKwoty
      ? ''
      : z.wartoscBrutto
        ? `Wartość brutto: ${fmtPLN(z.wartoscBrutto)}`
        : z.wartoscNetto
          ? `Wartość netto: ${fmtPLN(z.wartoscNetto)}`
          : '',
    z.notatki ? `Uwagi: ${z.notatki}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div>
      {confirmNode}
      <PageHeader
        title={z.numer}
        subtitle={[fmtDate(dataZlecenia(z)), klient ? klientNazwa(klient) : 'bez klienta', z.tytul]
          .filter(Boolean)
          .join(' · ')}
        icon={<ClipboardList size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/zlecenia" className="btn-outline">
              <ArrowLeft size={16} /> Lista
            </Link>
            <PrintSendBar
              getPrintNode={() => (
                <ZlecenieDoc
                  z={z}
                  firma={firma}
                  klient={klient}
                  logoDataUrl={b.ustawienia.logoDataUrl}
                  ukryjKwoty={ukryjKwoty}
                />
              )}
              share={{ title: `Zlecenie ${z.numer}`, text: shareText, to: klient?.email, phone: klient?.telefon }}
            />
            <button className="btn-danger" onClick={usun}>
              <Trash2 size={16} /> Usuń
            </button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Lewa kolumna - checklista + etap */}
        <div className="space-y-6 xl:col-span-2">
          <SectionCard title="Etap główny" icon={<ClipboardList size={17} />}>
            <div className="flex flex-wrap gap-2">
              {PIPELINE.map((p) => (
                <button
                  key={p.klucz}
                  onClick={() => update({ etap: p.klucz })}
                  className={
                    z.etap === p.klucz
                      ? 'rounded-full bg-brand-700 px-3.5 py-1.5 text-[13px] font-medium text-white'
                      : 'rounded-full border border-black/10 bg-black/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-stone-600 hover:border-brand-300'
                  }
                >
                  {p.nazwa}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title="Checklista etapów"
            icon={<Check size={17} />}
            desc="Kliknij, aby oznaczyć etap jako zrobiony"
          >
            <div className="divide-y divide-stone-100">
              {z.etapy.map((e, i) => (
                <button
                  key={e.klucz + i}
                  onClick={() => toggleEtap(i)}
                  className="row-hover flex w-full items-center gap-3 py-3 text-left"
                >
                  <span
                    className={
                      e.zrobione
                        ? 'grid h-6 w-6 shrink-0 place-items-center rounded-md border border-brand-700 bg-brand-700 text-white'
                        : 'grid h-6 w-6 shrink-0 place-items-center rounded-md border border-black/10 bg-transparent'
                    }
                  >
                    {e.zrobione && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span
                    className={
                      e.zrobione
                        ? 'flex-1 text-[14px] text-stone-400 line-through'
                        : 'flex-1 text-[14px] text-stone-700'
                    }
                  >
                    {e.nazwa}
                  </span>
                  {e.zrobione && e.data && <span className="text-[12px] text-stone-400">{fmtDate(e.data)}</span>}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard
            title={`Dokumenty i skany${skany && skany.length ? ` (${skany.length})` : ''}`}
            icon={<ScanLine size={17} />}
            desc="Umowy, pomiary, projekty – wszystko podpięte pod to zlecenie"
            actions={
              skany && skany.length > 0 ? (
                <button className="btn-primary btn-sm" onClick={() => setSkanerOpen(true)}>
                  <ScanLine size={15} /> Skanuj
                </button>
              ) : undefined
            }
          >
            {skany === null ? (
              <div className="flex items-center justify-center py-8 text-[13px] text-stone-400">Wczytywanie skanów...</div>
            ) : skany.length === 0 ? (
              <button
                onClick={() => setSkanerOpen(true)}
                className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-black/10 py-8 text-stone-400 transition hover:border-brand-300 hover:text-brand-700"
              >
                <ScanLine size={28} />
                <span className="text-[13.5px] font-medium">Zeskanuj dokumenty zlecenia</span>
                <span className="text-[12px]">Aparatem lub z pliku – wiele stron i wiele dokumentów</span>
              </button>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
                {skany.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setPodglad(s)}
                    className="group overflow-hidden rounded-lg border border-black/10 bg-black/[0.02] text-left transition hover:border-brand-300"
                  >
                    <div className="aspect-[3/4] overflow-hidden bg-stone-100">
                      {s.strony[0] ? (
                        <SkanImg strona={s.strony[0]} alt={s.nazwa} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <div className="grid h-full place-items-center text-stone-400">
                          <FileText size={22} />
                        </div>
                      )}
                    </div>
                    <div className="p-1.5">
                      <div className="truncate text-[11.5px] font-medium text-stone-700">{s.nazwa || 'Skan'}</div>
                      <div className="text-[10.5px] text-stone-400">
                        {s.strony.length} {s.strony.length === 1 ? 'strona' : 'str.'}
                      </div>
                    </div>
                  </button>
                ))}
                <button
                  onClick={() => setSkanerOpen(true)}
                  className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-black/10 text-stone-400 transition hover:border-brand-300 hover:text-brand-700"
                >
                  <Plus size={20} />
                  <span className="text-[11px] font-medium">Dodaj</span>
                </button>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Notatki" icon={<StickyNote size={17} />}>
            <Textarea
              value={z.notatki || ''}
              onChange={(e) => update({ notatki: e.target.value || undefined })}
              placeholder="Notatki dotyczące realizacji..."
              rows={4}
            />
          </SectionCard>
        </div>

        {/* Prawa kolumna - dane, daty, wartosci, powiazania */}
        <div className="space-y-6">
          <SectionCard title="Szczegóły" icon={<MapPin size={17} />}>
            <div className="space-y-3">
              <div>
                <span className="label">Etap</span>
                <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
              </div>
              <Field label="Numer zlecenia" hint="Numer z Waszego dokumentu">
                <Input
                  value={z.numer}
                  onChange={(e) => update({ numer: e.target.value })}
                  onBlur={(e) => {
                    // Numer nie moze zostac pusty - po wyczyszczeniu przywracamy podpowiedziany.
                    if (!e.target.value.trim())
                      update({ numer: sugerowanyNumerZlecenia(b.zlecenia, z.firmaId, dataZlecenia(z).slice(0, 4)) })
                  }}
                  placeholder="np. 111/2026"
                />
              </Field>
              <Field label="Data zlecenia">
                <Input
                  type="date"
                  value={dataZlecenia(z)}
                  onChange={(e) => update({ data: e.target.value || undefined })}
                />
              </Field>
              <Field label="Adres realizacji">
                <Input
                  value={z.adres || ''}
                  onChange={(e) => update({ adres: e.target.value || undefined })}
                  placeholder="ul., kod, miasto"
                />
              </Field>
              {!ukryjKwoty && (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Wartość netto">
                    <Input
                      defaultValue={z.wartoscNetto != null ? String(z.wartoscNetto) : ''}
                      onBlur={(e) => update({ wartoscNetto: e.target.value ? parseNum(e.target.value) : undefined })}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </Field>
                  <Field label="Wartość brutto">
                    <Input
                      defaultValue={z.wartoscBrutto != null ? String(z.wartoscBrutto) : ''}
                      onBlur={(e) => update({ wartoscBrutto: e.target.value ? parseNum(e.target.value) : undefined })}
                      placeholder="0,00"
                      inputMode="decimal"
                    />
                  </Field>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Terminy" icon={<CalendarDays size={17} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data pomiaru">
                <Input
                  type="date"
                  value={z.dataPomiaru || ''}
                  onChange={(e) => update({ dataPomiaru: e.target.value || undefined })}
                />
              </Field>
              <Field label="Data montażu">
                <Input
                  type="date"
                  value={z.dataMontazu || ''}
                  onChange={(e) => update({ dataMontazu: e.target.value || undefined })}
                />
              </Field>
            </div>
          </SectionCard>

          {osoby.length > 0 && (
            <SectionCard title="Osoby projektu" icon={<Users size={17} />}>
              <div className="space-y-1.5">
                {osoby.map((o) => (
                  <div key={o.label} className="flex items-center justify-between text-[13.5px]">
                    <span className="text-stone-500">{o.label}</span>
                    <span className="font-medium text-ink">{o.v}</span>
                  </div>
                ))}
              </div>
            </SectionCard>
          )}

          <SectionCard title="Powiązane dokumenty" icon={<FileSignature size={17} />}>
            <div className="space-y-3">
              <Powiazanie
                label="Wycena"
                icon={<Calculator size={15} />}
                value={z.wycenaId}
                opcje={b.wyceny.map((w) => ({ id: w.id, label: w.numer }))}
                onChange={(v) => update({ wycenaId: v })}
                link={z.wycenaId ? `/wyceny/${z.wycenaId}` : undefined}
              />
              <Powiazanie
                label="Umowa"
                icon={<FileSignature size={15} />}
                value={z.umowaId}
                opcje={b.umowy.map((u) => ({ id: u.id, label: u.numer }))}
                onChange={(v) => update({ umowaId: v })}
                link={z.umowaId ? `/umowy/${z.umowaId}` : undefined}
              />
              <Powiazanie
                label="Protokół odbioru"
                icon={<ClipboardCheck size={15} />}
                value={z.protokolId}
                opcje={b.protokoly.map((p) => ({ id: p.id, label: p.numer }))}
                onChange={(v) => update({ protokolId: v })}
              />
              <Powiazanie
                label="Faktura"
                icon={<Receipt size={15} />}
                value={z.fakturaId}
                opcje={b.faktury.map((fk) => ({ id: fk.id, label: fk.numer }))}
                onChange={(v) => update({ fakturaId: v })}
                link={z.fakturaId ? `/faktury/${z.fakturaId}` : undefined}
              />
            </div>
          </SectionCard>
        </div>
      </div>

      <Skaner
        open={skanerOpen}
        onClose={() => setSkanerOpen(false)}
        zlecenieId={z.id}
        klientId={z.klientId}
        onZapisano={odswiezSkany}
      />

      <Modal open={!!podglad} onClose={() => setPodglad(null)} title={podglad?.nazwa || 'Skan'} size="lg">
        {podglad && (
          <div className="space-y-3">
            {podglad.strony.map((str, i) => (
              <SkanImg key={i} strona={str} alt={'Strona ' + (i + 1)} className="w-full rounded-lg border border-black/10" />
            ))}
            <div className="flex justify-end">
              <Link to="/skany" className="btn-outline btn-sm">
                Otwórz w archiwum skanów
              </Link>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

function Powiazanie({
  label,
  icon,
  value,
  opcje,
  onChange,
  link,
}: {
  label: string
  icon: React.ReactNode
  value?: string
  opcje: { id: string; label: string }[]
  onChange: (v: string | undefined) => void
  link?: string
}) {
  return (
    <div>
      <span className="label flex items-center gap-1.5">
        <span className="text-brand-700">{icon}</span> {label}
      </span>
      <div className="flex items-center gap-2">
        <Select value={value || ''} onChange={(e) => onChange(e.target.value || undefined)} className="flex-1">
          <option value="">- brak -</option>
          {opcje.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </Select>
        {value && link && (
          <Link to={link} className="btn-outline btn-sm shrink-0">
            Otwórz
          </Link>
        )}
      </div>
    </div>
  )
}

function NieZnaleziono() {
  return (
    <div>
      <PageHeader title="Zlecenie" icon={<ClipboardList size={22} />} />
      <EmptyState
        icon={<ClipboardList size={26} />}
        title="Nie znaleziono zlecenia"
        desc="Zlecenie mogło zostać usunięte."
        action={
          <Link to="/zlecenia" className="btn-primary">
            <ArrowLeft size={16} /> Wróć do listy
          </Link>
        }
      />
    </div>
  )
}

// ============================================================================
// DOKUMENT - karta zlecenia (wydruk / PDF)
// ============================================================================
export function ZlecenieDoc({
  z,
  firma,
  klient,
  logoDataUrl,
  ukryjKwoty,
}: {
  z: Zlecenie
  firma: Firma
  klient?: Klient
  logoDataUrl?: string
  ukryjKwoty?: boolean
}) {
  const ei = etapInfo(z.etap)
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <DocTitle sub="Realizacja prac kamieniarskich" numer={z.numer}>
        KARTA ZLECENIA
      </DocTitle>

      <DocSection n={1} title="Dane podstawowe">
        <DocLine label="Data:" value={fmtDate(dataZlecenia(z))} />
        <DocLine label="Klient:" value={klient ? klientNazwa(klient) : '-'} />
        <DocLine label="Adres realizacji:" value={z.adres} />
        {z.tytul ? <DocLine label="Opis:" value={z.tytul} /> : null}
        <DocLine label="Etap główny:" value={ei.nazwa} />
      </DocSection>

      <div style={{ display: 'grid', gridTemplateColumns: ukryjKwoty ? '1fr' : '1fr 1fr', gap: 16 }}>
        <DocSection n={2} title="Terminy">
          <DocLine label="Pomiar:" value={fmtDate(z.dataPomiaru)} />
          <DocLine label="Montaż:" value={fmtDate(z.dataMontazu)} />
        </DocSection>
        {!ukryjKwoty && (
          <DocSection n={3} title="Wartość">
            <DocLine label="Netto:" value={z.wartoscNetto != null ? fmtPLN(z.wartoscNetto) : '-'} />
            <DocLine label="Brutto:" value={z.wartoscBrutto != null ? fmtPLN(z.wartoscBrutto) : '-'} />
          </DocSection>
        )}
      </div>

      <DocSection n={4} title="Etapy realizacji">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#f3f4f6' }}>
              <th style={{ border: '1px solid #dbdee3', padding: '4px 6px', width: 34, fontSize: '7.6pt' }}>✓</th>
              <th style={{ border: '1px solid #dbdee3', padding: '4px 6px', textAlign: 'left', fontSize: '7.6pt' }}>
                ETAP
              </th>
              <th style={{ border: '1px solid #dbdee3', padding: '4px 6px', width: 90, fontSize: '7.6pt' }}>DATA</th>
            </tr>
          </thead>
          <tbody>
            {z.etapy.map((e, i) => (
              <tr key={e.klucz + i}>
                <td style={{ border: '1px solid #dbdee3', padding: '4px 6px', textAlign: 'center' }}>
                  {e.zrobione ? '✓' : ''}
                </td>
                <td style={{ border: '1px solid #dbdee3', padding: '4px 6px' }}>{e.nazwa}</td>
                <td style={{ border: '1px solid #dbdee3', padding: '4px 6px', textAlign: 'center' }}>
                  {fmtDate(e.data)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </DocSection>

      {z.notatki && (
        <DocSection n={5} title="Notatki">
          <div style={{ fontSize: '9pt', color: '#3a372f', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{z.notatki}</div>
        </DocSection>
      )}
    </DocSheet>
  )
}
