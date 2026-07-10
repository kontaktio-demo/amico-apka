import { useState, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
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
import { fmtPLN, fmtDate, parseNum, nowISO, today } from '../lib/format'
import { klientNazwa, PIPELINE, etapInfo, domyslneEtapyZlecenia } from '../lib/helpers'
import { uid } from '../lib/id'
import type { Zlecenie, Firma, Klient, PipelineEtap } from '../lib/types'
import { DocSheet, DocTitle, DocSection, DocLine } from '../documents/DocShell'

// ============================================================================
// Modul ZLECENIA – lista realizacji + widok szczegolowy z checklista etapow
// ============================================================================

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
  const [szukaj, setSzukaj] = useState('')
  const [filtr, setFiltr] = useState<PipelineEtap | 'all'>('all')
  const [openNowe, setOpenNowe] = useState(false)

  const klientMap = useMemo(() => {
    const m = new Map<string, Klient>()
    b.klienci.forEach((k) => m.set(k.id, k))
    return m
  }, [b.klienci])

  const widoczne = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    return b.zlecenia
      .filter((z) => (filtr === 'all' ? true : z.etap === filtr))
      .filter((z) => {
        if (!q) return true
        const kl = z.klientId ? klientNazwa(klientMap.get(z.klientId)) : ''
        return [z.tytul, z.numer, kl].filter(Boolean).some((s) => s.toLowerCase().includes(q))
      })
      .slice()
      .sort((a, c) => c.utworzono.localeCompare(a.utworzono))
  }, [b.zlecenia, filtr, szukaj, klientMap])

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

      <div className="mb-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj po tytule, numerze lub kliencie…" />
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
                        <div className="truncate text-[15px] font-semibold text-ink">{z.tytul}</div>
                        <div className="text-[12px] text-stone-400">{z.numer}</div>
                      </div>
                      <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
                    </div>
                    <div className="space-y-1 text-[13px] text-stone-500">
                      <div className="flex items-center gap-1.5">
                        <Users size={14} className="text-stone-400" /> {kl ? klientNazwa(kl) : '— brak klienta'}
                      </div>
                      {z.adres && (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={14} className="text-stone-400" /> <span className="truncate">{z.adres}</span>
                        </div>
                      )}
                      {(z.wartoscBrutto || z.wartoscNetto) && (
                        <div className="flex items-center gap-1.5">
                          <Wallet size={14} className="text-stone-400" />{' '}
                          {fmtPLN(z.wartoscBrutto || z.wartoscNetto)}
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
          ? 'rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white'
          : 'rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-stone-600 hover:border-brand-300'
      }
    >
      {label} <span className={active ? 'text-white/70' : 'text-stone-400'}>{n}</span>
    </button>
  )
}

// ---------- NOWE ZLECENIE ----------
interface FormState {
  tytul: string
  klientId: string
  adres: string
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
  tytul: '',
  klientId: '',
  adres: '',
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
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const { push } = useToast()
  const navigate = useNavigate()
  const [f, setF] = useState<FormState>(pustyForm)

  const set = (patch: Partial<FormState>) => setF((prev) => ({ ...prev, ...patch }))

  const projektanci = b.kontrahenci.filter((k) => k.typ === 'projektant')
  const stolarze = b.kontrahenci.filter((k) => k.typ === 'stolarz' || k.typ === 'studio_kuchenne')
  const wykonawcy = b.kontrahenci.filter((k) => k.typ === 'wykonawca')

  const zapisz = () => {
    if (!f.tytul.trim()) {
      push('Podaj tytuł zlecenia', 'err')
      return
    }
    const kl = f.klientId ? b.klienci.find((k) => k.id === f.klientId) : undefined
    const adres = f.adres.trim() || (kl ? [kl.ulica, [kl.kod, kl.miasto].filter(Boolean).join(' ')].filter(Boolean).join(', ') : '')
    const nowe: Zlecenie = {
      id: uid('zl'),
      numer: kolejnyNumer('ZL'),
      firmaId: firma.id,
      klientId: f.klientId || undefined,
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
    setF(pustyForm)
    onClose()
    navigate(`/zlecenia/${nowe.id}`)
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
          <button className="btn-primary" onClick={zapisz}>
            <Check size={16} /> Utwórz zlecenie
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tytuł zlecenia" required>
          <Input value={f.tytul} onChange={(e) => set({ tytul: e.target.value })} placeholder="np. Blaty kuchenne – granit Steel Grey" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klient">
            <Select value={f.klientId} onChange={(e) => set({ klientId: e.target.value })}>
              <option value="">— bez klienta —</option>
              {b.klienci.map((k) => (
                <option key={k.id} value={k.id}>
                  {klientNazwa(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Adres realizacji" hint="Domyślnie z danych klienta">
            <Input value={f.adres} onChange={(e) => set({ adres: e.target.value })} placeholder="ul., kod, miasto" />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Projektant">
            <Select value={f.projektantId} onChange={(e) => set({ projektantId: e.target.value })}>
              <option value="">—</option>
              {projektanci.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Stolarz / studio">
            <Select value={f.stolarzId} onChange={(e) => set({ stolarzId: e.target.value })}>
              <option value="">—</option>
              {stolarze.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Wykonawca">
            <Select value={f.wykonawcaId} onChange={(e) => set({ wykonawcaId: e.target.value })}>
              <option value="">—</option>
              {wykonawcy.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Koordynator">
            <Select value={f.koordynatorId} onChange={(e) => set({ koordynatorId: e.target.value })}>
              <option value="">—</option>
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
            <Input value={f.wartoscNetto} onChange={(e) => set({ wartoscNetto: e.target.value })} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Wartość brutto">
            <Input value={f.wartoscBrutto} onChange={(e) => set({ wartoscBrutto: e.target.value })} placeholder="0,00" inputMode="decimal" />
          </Field>
          <Field label="Data pomiaru">
            <Input type="date" value={f.dataPomiaru} onChange={(e) => set({ dataPomiaru: e.target.value })} />
          </Field>
          <Field label="Data montażu">
            <Input type="date" value={f.dataMontazu} onChange={(e) => set({ dataMontazu: e.target.value })} />
          </Field>
        </div>

        <Field label="Notatki">
          <Textarea value={f.notatki} onChange={(e) => set({ notatki: e.target.value })} placeholder="Dodatkowe informacje o realizacji…" />
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

  const klient = z.klientId ? b.klienci.find((k) => k.id === z.klientId) : undefined
  const ei = etapInfo(z.etap)

  const update = (patch: Partial<Zlecenie>) => upsert('zlecenia', { ...z, ...patch, zaktualizowano: nowISO() })

  const toggleEtap = (idx: number) => {
    const etapy = z.etapy.map((e, i) =>
      i === idx ? { ...e, zrobione: !e.zrobione, data: !e.zrobione ? today() : undefined } : e,
    )
    update({ etapy })
  }

  const usun = async () => {
    if (await confirm(`Usunąć zlecenie „${z.tytul}"? Tej operacji nie można cofnąć.`)) {
      remove('zlecenia', z.id)
      push('Zlecenie usunięte', 'ok')
      navigate('/zlecenia')
    }
  }

  const kontrahentNazwa = (id?: string) => (id ? b.kontrahenci.find((k) => k.id === id)?.nazwa : undefined)
  const pracownikNazwa = (id?: string) => (id ? b.pracownicy.find((p) => p.id === id)?.imie : undefined)

  const osoby = [
    { label: 'Projektant', v: kontrahentNazwa(z.osoby.projektantId) },
    { label: 'Stolarz / studio', v: kontrahentNazwa(z.osoby.stolarzId) },
    { label: 'Wykonawca', v: kontrahentNazwa(z.osoby.wykonawcaId) },
    { label: 'Koordynator', v: pracownikNazwa(z.osoby.koordynatorId) },
  ].filter((o) => o.v)

  const shareText = [
    `Zlecenie ${z.numer}: ${z.tytul}`,
    klient ? `Klient: ${klientNazwa(klient)}` : '',
    z.adres ? `Adres: ${z.adres}` : '',
    `Etap: ${ei.nazwa}`,
    z.dataPomiaru ? `Pomiar: ${fmtDate(z.dataPomiaru)}` : '',
    z.dataMontazu ? `Montaż: ${fmtDate(z.dataMontazu)}` : '',
    z.wartoscBrutto ? `Wartość brutto: ${fmtPLN(z.wartoscBrutto)}` : z.wartoscNetto ? `Wartość netto: ${fmtPLN(z.wartoscNetto)}` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div>
      {confirmNode}
      <PageHeader
        title={z.tytul}
        subtitle={`${z.numer} · ${klient ? klientNazwa(klient) : 'bez klienta'}`}
        icon={<ClipboardList size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/zlecenia" className="btn-outline">
              <ArrowLeft size={16} /> Lista
            </Link>
            <PrintSendBar
              getPrintNode={() => <ZlecenieDoc z={z} firma={firma} klient={klient} logoDataUrl={b.ustawienia.logoDataUrl} />}
              share={{ title: `Zlecenie ${z.numer}`, text: shareText, to: klient?.email, phone: klient?.telefon }}
            />
            <button className="btn-danger" onClick={usun}>
              <Trash2 size={16} /> Usuń
            </button>
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Lewa kolumna – checklista + etap */}
        <div className="space-y-6 lg:col-span-2">
          <SectionCard title="Etap główny" icon={<ClipboardList size={17} />}>
            <div className="flex flex-wrap gap-2">
              {PIPELINE.map((p) => (
                <button
                  key={p.klucz}
                  onClick={() => update({ etap: p.klucz })}
                  className={
                    z.etap === p.klucz
                      ? 'rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium text-white'
                      : 'rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-1.5 text-[13px] font-medium text-stone-600 hover:border-brand-300'
                  }
                >
                  {p.nazwa}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Checklista etapów" icon={<Check size={17} />} desc="Kliknij, aby oznaczyć etap jako zrobiony">
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
                        ? 'grid h-6 w-6 shrink-0 place-items-center rounded-md border border-brand-700 bg-white/10 text-white'
                        : 'grid h-6 w-6 shrink-0 place-items-center rounded-md border border-white/20 bg-transparent'
                    }
                  >
                    {e.zrobione && <Check size={15} strokeWidth={3} />}
                  </span>
                  <span className={e.zrobione ? 'flex-1 text-[14px] text-stone-400 line-through' : 'flex-1 text-[14px] text-stone-700'}>
                    {e.nazwa}
                  </span>
                  {e.zrobione && e.data && <span className="text-[12px] text-stone-400">{fmtDate(e.data)}</span>}
                </button>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Notatki" icon={<StickyNote size={17} />}>
            <Textarea
              value={z.notatki || ''}
              onChange={(e) => update({ notatki: e.target.value || undefined })}
              placeholder="Notatki dotyczące realizacji…"
              rows={4}
            />
          </SectionCard>
        </div>

        {/* Prawa kolumna – dane, daty, wartosci, powiazania */}
        <div className="space-y-6">
          <SectionCard title="Szczegóły" icon={<MapPin size={17} />}>
            <div className="space-y-3">
              <div>
                <span className="label">Etap</span>
                <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
              </div>
              <Field label="Adres realizacji">
                <Input value={z.adres || ''} onChange={(e) => update({ adres: e.target.value || undefined })} placeholder="ul., kod, miasto" />
              </Field>
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
            </div>
          </SectionCard>

          <SectionCard title="Terminy" icon={<CalendarDays size={17} />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Data pomiaru">
                <Input type="date" value={z.dataPomiaru || ''} onChange={(e) => update({ dataPomiaru: e.target.value || undefined })} />
              </Field>
              <Field label="Data montażu">
                <Input type="date" value={z.dataMontazu || ''} onChange={(e) => update({ dataMontazu: e.target.value || undefined })} />
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
          <option value="">— brak —</option>
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
// DOKUMENT – karta zlecenia (wydruk / PDF)
// ============================================================================
export function ZlecenieDoc({
  z,
  firma,
  klient,
  logoDataUrl,
}: {
  z: Zlecenie
  firma: Firma
  klient?: Klient
  logoDataUrl?: string
}) {
  const ei = etapInfo(z.etap)
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <DocTitle sub="Realizacja prac kamieniarskich" numer={z.numer}>
        KARTA ZLECENIA
      </DocTitle>

      <DocSection n={1} title="Dane podstawowe">
        <DocLine label="Tytuł:" value={z.tytul} />
        <DocLine label="Klient:" value={klient ? klientNazwa(klient) : '—'} />
        <DocLine label="Adres realizacji:" value={z.adres} />
        <DocLine label="Etap główny:" value={ei.nazwa} />
      </DocSection>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <DocSection n={2} title="Terminy">
          <DocLine label="Pomiar:" value={fmtDate(z.dataPomiaru)} />
          <DocLine label="Montaż:" value={fmtDate(z.dataMontazu)} />
        </DocSection>
        <DocSection n={3} title="Wartość">
          <DocLine label="Netto:" value={z.wartoscNetto != null ? fmtPLN(z.wartoscNetto) : '—'} />
          <DocLine label="Brutto:" value={z.wartoscBrutto != null ? fmtPLN(z.wartoscBrutto) : '—'} />
        </DocSection>
      </div>

      <DocSection n={4} title="Etapy realizacji">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#f0ede6' }}>
              <th style={{ border: '1px solid #d3cfc2', padding: '4px 6px', width: 34, fontSize: '7.6pt' }}>✓</th>
              <th style={{ border: '1px solid #d3cfc2', padding: '4px 6px', textAlign: 'left', fontSize: '7.6pt' }}>ETAP</th>
              <th style={{ border: '1px solid #d3cfc2', padding: '4px 6px', width: 90, fontSize: '7.6pt' }}>DATA</th>
            </tr>
          </thead>
          <tbody>
            {z.etapy.map((e, i) => (
              <tr key={e.klucz + i}>
                <td style={{ border: '1px solid #d3cfc2', padding: '4px 6px', textAlign: 'center' }}>{e.zrobione ? '✓' : ''}</td>
                <td style={{ border: '1px solid #d3cfc2', padding: '4px 6px' }}>{e.nazwa}</td>
                <td style={{ border: '1px solid #d3cfc2', padding: '4px 6px', textAlign: 'center' }}>{fmtDate(e.data)}</td>
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
