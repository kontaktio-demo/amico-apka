import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Receipt, Plus, Trash2, ArrowLeft, Save, Building2, User, Eye } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
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
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { FakturaDoc } from '../documents/Faktura'
import { klientNazwa, klientAdres } from '../lib/helpers'
import { fmtPLN, fmtDate, today, nowISO, podsumuj, pozycjaNetto, kwotaSlownie, parseNum } from '../lib/format'
import { uid } from '../lib/id'
import type { Faktura, FakturaTyp, FakturaStatus, Pozycja, Unit, VatRate } from '../lib/types'

// ----------------------------------------------------------------------------
// Slowniki
// ----------------------------------------------------------------------------
const TYPY: { typ: FakturaTyp; nazwa: string }[] = [
  { typ: 'vat', nazwa: 'Faktura VAT' },
  { typ: 'zaliczkowa', nazwa: 'Faktura zaliczkowa' },
  { typ: 'koncowa', nazwa: 'Faktura końcowa' },
  { typ: 'proforma', nazwa: 'Faktura proforma' },
]

const STATUS_INFO: Record<FakturaStatus, { label: string; tone: 'green' | 'stone' | 'amber' | 'blue' | 'red' }> = {
  szkic: { label: 'Szkic', tone: 'stone' },
  wystawiona: { label: 'Wystawiona', tone: 'blue' },
  oplacona: { label: 'Opłacona', tone: 'green' },
  zaległa: { label: 'Zaległa', tone: 'red' },
}
const STATUSY = Object.keys(STATUS_INFO) as FakturaStatus[]

const SPOSOBY: { v: NonNullable<Faktura['sposobPlatnosci']>; nazwa: string }[] = [
  { v: 'przelew', nazwa: 'Przelew' },
  { v: 'gotowka', nazwa: 'Gotówka' },
  { v: 'karta', nazwa: 'Karta' },
]

const JEDNOSTKI: Unit[] = ['m²', 'mb', 'szt', 'kpl', 'usł', 'h', 'godz']
const STAWKI: VatRate[] = [23, 8, 5, 0]

// ============================================================================
// Ekran gorny – lista lub edytor wg trasy
// ============================================================================
export default function Faktury() {
  const { id } = useParams()
  if (id) return <Edytor id={id} />
  return <Lista />
}

// ----------------------------------------------------------------------------
// Lista faktur
// ----------------------------------------------------------------------------
function Lista() {
  const b = useStore((s) => s.baza)
  const navigate = useNavigate()
  const [q, setQ] = useState('')

  const filtr = q.trim().toLowerCase()
  const faktury = b.faktury
    .slice()
    .sort((a, c) => c.utworzono.localeCompare(a.utworzono))
    .filter((f) => {
      if (!filtr) return true
      return `${f.numer} ${f.nabywcaNazwa || ''}`.toLowerCase().includes(filtr)
    })

  return (
    <div>
      <PageHeader
        title="Faktury"
        subtitle="Faktury VAT, zaliczkowe, końcowe i proforma"
        icon={<Receipt size={22} />}
        actions={
          <button className="btn-primary" onClick={() => navigate('/faktury/nowa')}>
            <Plus size={17} /> Nowa faktura
          </button>
        }
      />

      <div className="mb-4 max-w-sm">
        <SearchInput value={q} onChange={setQ} placeholder="Szukaj po numerze lub nabywcy…" />
      </div>

      {faktury.length === 0 ? (
        <EmptyState
          icon={<Receipt size={26} />}
          title="Brak faktur"
          desc="Wystaw pierwszą fakturę – VAT, zaliczkową, końcową lub proforma."
          action={
            <button className="btn-primary" onClick={() => navigate('/faktury/nowa')}>
              <Plus size={17} /> Nowa faktura
            </button>
          }
        />
      ) : (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-stone-200">
                <th className="th">Numer</th>
                <th className="th">Nabywca</th>
                <th className="th">Wystawiona</th>
                <th className="th text-right">Brutto</th>
                <th className="th">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {faktury.map((f) => {
                const sum = podsumuj(f.pozycje)
                const si = STATUS_INFO[f.status]
                return (
                  <tr key={f.id} className="row-hover cursor-pointer" onClick={() => navigate(`/faktury/${f.id}`)}>
                    <td className="td font-semibold text-ink">{f.numer || '–'}</td>
                    <td className="td">{f.nabywcaNazwa || '–'}</td>
                    <td className="td">{fmtDate(f.dataWystawienia)}</td>
                    <td className="td text-right font-semibold tabular-nums">{fmtPLN(sum.brutto)}</td>
                    <td className="td">
                      <Badge tone={si.tone}>{si.label}</Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Edytor faktury
// ----------------------------------------------------------------------------
function nowaFaktura(firmaId: string, konto: string | undefined, domyslnyVat: VatRate): Faktura {
  return {
    id: uid('fv'),
    numer: '',
    typ: 'vat',
    firmaId,
    dataWystawienia: today(),
    dataSprzedazy: today(),
    terminPlatnosci: '',
    sposobPlatnosci: 'przelew',
    konto: konto || '',
    splitPayment: false,
    pozycje: [nowaPozycja(domyslnyVat)],
    status: 'szkic',
    utworzono: nowISO(),
  }
}
function nowaPozycja(vat: VatRate): Pozycja {
  return { id: uid('poz'), lp: 1, nazwa: '', jednostka: 'szt', ilosc: 1, cenaNetto: 0, vat }
}

function Edytor({ id }: { id: string }) {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const navigate = useNavigate()
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const isNew = id === 'nowa'
  const existing = b.faktury.find((f) => f.id === id)

  const [f, setF] = useState<Faktura>(() => existing ?? nowaFaktura(firma.id, firma.konto, firma.domyslnyVat))
  const [podglad, setPodglad] = useState(false)
  const numerRef = useRef(false)

  // przy nowej – jednorazowo nadaj kolejny numer FV
  useEffect(() => {
    if (isNew && !numerRef.current) {
      numerRef.current = true
      setF((prev) => ({ ...prev, numer: kolejnyNumer('FV') }))
    }
  }, [isNew, kolejnyNumer])

  // istniejaca, ale nie znaleziona – wroc do listy
  useEffect(() => {
    if (!isNew && !existing) navigate('/faktury', { replace: true })
  }, [isNew, existing, navigate])

  const set = <K extends keyof Faktura>(k: K, v: Faktura[K]) => setF((prev) => ({ ...prev, [k]: v }))

  const setPoz = (pid: string, patch: Partial<Pozycja>) =>
    setF((prev) => ({ ...prev, pozycje: prev.pozycje.map((p) => (p.id === pid ? { ...p, ...patch } : p)) }))
  const dodajPoz = () => setF((prev) => ({ ...prev, pozycje: [...prev.pozycje, nowaPozycja(firma.domyslnyVat)] }))
  const usunPoz = (pid: string) => setF((prev) => ({ ...prev, pozycje: prev.pozycje.filter((p) => p.id !== pid) }))

  const wybierzKlienta = (klientId: string) => {
    if (!klientId) {
      set('klientId', undefined)
      return
    }
    const k = b.klienci.find((x) => x.id === klientId)
    if (!k) return
    setF((prev) => ({
      ...prev,
      klientId: k.id,
      nabywcaNazwa: klientNazwa(k),
      nabywcaNip: k.typ === 'firma' ? k.nip || '' : '',
      nabywcaAdres: klientAdres(k),
    }))
  }

  const sum = podsumuj(f.pozycje)
  const stawki = Object.keys(sum.wgStawek)
    .map((k) => ({ stawka: Number(k), ...sum.wgStawek[k] }))
    .sort((a, c) => a.stawka - c.stawka)
  const b2b = !!(f.nabywcaNip && f.nabywcaNip.trim())
  const splitSugerowany = sum.brutto > 15000

  const zapisz = () => {
    const doZapisu: Faktura = { ...f, pozycje: f.pozycje.map((p, i) => ({ ...p, lp: i + 1 })) }
    upsert('faktury', doZapisu)
    push('Faktura zapisana', 'ok')
    navigate('/faktury')
  }

  const usun = async () => {
    if (await confirm('Usunąć tę fakturę? Operacji nie można cofnąć.')) {
      remove('faktury', f.id)
      push('Faktura usunięta', 'info')
      navigate('/faktury')
    }
  }

  const klient = f.klientId ? b.klienci.find((k) => k.id === f.klientId) : undefined
  const docNode = (
    <FakturaDoc
      f={{ ...f, pozycje: f.pozycje.map((p, i) => ({ ...p, lp: i + 1 })) }}
      firma={firma}
      logoDataUrl={b.ustawienia.logoDataUrl}
    />
  )

  return (
    <div>
      <PageHeader
        title={isNew ? 'Nowa faktura' : `Faktura ${f.numer}`}
        subtitle={f.nabywcaNazwa || 'Uzupełnij dane nabywcy i pozycje'}
        icon={<Receipt size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => navigate('/faktury')}>
              <ArrowLeft size={17} /> Lista
            </button>
            <button className="btn-outline" onClick={() => setPodglad(true)}>
              <Eye size={17} /> Podgląd
            </button>
            <PrintSendBar
              getPrintNode={() => docNode}
              share={{
                title: `Faktura ${f.numer}`,
                text: `Faktura ${f.numer} dla ${f.nabywcaNazwa || 'nabywcy'} na kwotę ${fmtPLN(sum.brutto)}. Termin płatności: ${fmtDate(f.terminPlatnosci) || 'wg ustaleń'}.`,
                to: klient?.email,
                phone: klient?.telefon,
              }}
            />
            <button className="btn-primary" onClick={zapisz}>
              <Save size={17} /> Zapisz
            </button>
          </div>
        }
      />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {/* Dane podstawowe */}
          <SectionCard title="Dane faktury" icon={<Receipt size={18} />}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Typ dokumentu">
                <Select value={f.typ} onChange={(e) => set('typ', e.target.value as FakturaTyp)}>
                  {TYPY.map((t) => (
                    <option key={t.typ} value={t.typ}>
                      {t.nazwa}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Numer">
                <Input value={f.numer} onChange={(e) => set('numer', e.target.value)} placeholder="FV 1/2026" />
              </Field>
              <Field label="Status">
                <Select value={f.status} onChange={(e) => set('status', e.target.value as FakturaStatus)}>
                  {STATUSY.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_INFO[s].label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Sposób płatności">
                <Select
                  value={f.sposobPlatnosci || 'przelew'}
                  onChange={(e) => set('sposobPlatnosci', e.target.value as NonNullable<Faktura['sposobPlatnosci']>)}
                >
                  {SPOSOBY.map((s) => (
                    <option key={s.v} value={s.v}>
                      {s.nazwa}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Data wystawienia">
                <Input type="date" value={f.dataWystawienia} onChange={(e) => set('dataWystawienia', e.target.value)} />
              </Field>
              <Field label="Data sprzedaży">
                <Input
                  type="date"
                  value={f.dataSprzedazy || ''}
                  onChange={(e) => set('dataSprzedazy', e.target.value)}
                />
              </Field>
              <Field label="Termin płatności">
                <Input
                  type="date"
                  value={f.terminPlatnosci || ''}
                  onChange={(e) => set('terminPlatnosci', e.target.value)}
                />
              </Field>
              <Field label="Numer konta">
                <Input
                  value={f.konto || ''}
                  onChange={(e) => set('konto', e.target.value)}
                  placeholder="NRB do przelewu"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Nabywca */}
          <SectionCard
            title="Nabywca"
            icon={b2b ? <Building2 size={18} /> : <User size={18} />}
            actions={<Badge tone={b2b ? 'blue' : 'stone'}>{b2b ? 'B2B (firma / NIP)' : 'B2C (os. fizyczna)'}</Badge>}
          >
            <div className="grid gap-4">
              <Field label="Wybierz z bazy klientów" hint="Uzupełni nazwę, NIP i adres – możesz je edytować poniżej.">
                <Select value={f.klientId || ''} onChange={(e) => wybierzKlienta(e.target.value)}>
                  <option value="">– wpisz ręcznie –</option>
                  {b.klienci.map((k) => (
                    <option key={k.id} value={k.id}>
                      {klientNazwa(k)}
                    </option>
                  ))}
                </Select>
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Nazwa nabywcy">
                  <Input value={f.nabywcaNazwa || ''} onChange={(e) => set('nabywcaNazwa', e.target.value)} />
                </Field>
                <Field label="NIP" hint="Puste = faktura dla osoby fizycznej (B2C).">
                  <Input
                    value={f.nabywcaNip || ''}
                    onChange={(e) => set('nabywcaNip', e.target.value)}
                    placeholder="np. 123-456-32-18"
                  />
                </Field>
              </div>
              <Field label="Adres">
                <Textarea value={f.nabywcaAdres || ''} onChange={(e) => set('nabywcaAdres', e.target.value)} rows={2} />
              </Field>
            </div>
          </SectionCard>

          {/* Pozycje */}
          <SectionCard
            title="Pozycje"
            icon={<Plus size={18} />}
            actions={
              <button className="btn-outline btn-sm" onClick={dodajPoz}>
                <Plus size={15} /> Dodaj pozycję
              </button>
            }
          >
            {f.pozycje.length === 0 ? (
              <p className="py-4 text-center text-[13.5px] text-stone-400">Brak pozycji – dodaj pierwszą.</p>
            ) : (
              <div className="space-y-3">
                {f.pozycje.map((p, i) => (
                  <div key={p.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[12px] font-semibold uppercase tracking-wide text-stone-400">
                        Poz. {i + 1}
                      </span>
                      <button
                        className="btn-ghost btn-sm !px-2 text-red-600"
                        onClick={() => usunPoz(p.id)}
                        aria-label="Usuń pozycję"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-12">
                      <Field label="Nazwa towaru / usługi" className="sm:col-span-12">
                        <Input value={p.nazwa} onChange={(e) => setPoz(p.id, { nazwa: e.target.value })} />
                      </Field>
                      <Field label="Ilość" className="sm:col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={p.ilosc}
                          onChange={(e) => setPoz(p.id, { ilosc: parseNum(e.target.value) })}
                        />
                      </Field>
                      <Field label="Jedn." className="sm:col-span-3">
                        <Select
                          value={p.jednostka}
                          onChange={(e) => setPoz(p.id, { jednostka: e.target.value as Unit })}
                        >
                          {JEDNOSTKI.map((j) => (
                            <option key={j} value={j}>
                              {j}
                            </option>
                          ))}
                        </Select>
                      </Field>
                      <Field label="Cena netto" className="sm:col-span-3">
                        <Input
                          type="number"
                          step="0.01"
                          value={p.cenaNetto}
                          onChange={(e) => setPoz(p.id, { cenaNetto: parseNum(e.target.value) })}
                        />
                      </Field>
                      <Field label="VAT" className="sm:col-span-3">
                        <Select
                          value={p.vat}
                          onChange={(e) => setPoz(p.id, { vat: Number(e.target.value) as VatRate })}
                        >
                          {STAWKI.map((s) => (
                            <option key={s} value={s}>
                              {s}%
                            </option>
                          ))}
                        </Select>
                      </Field>
                    </div>
                    <div className="mt-2 text-right text-[13px] text-stone-500">
                      Wartość netto: <span className="font-semibold text-ink">{fmtPLN(pozycjaNetto(p))}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Uwagi">
            <Textarea
              value={f.uwagi || ''}
              onChange={(e) => set('uwagi', e.target.value)}
              placeholder="Dodatkowe informacje na fakturze…"
            />
          </SectionCard>
        </div>

        {/* Panel boczny – podsumowanie */}
        <div className="space-y-6">
          <SectionCard title="Podsumowanie">
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr className="border-b border-stone-200 text-stone-500">
                    <th className="th !px-2">Stawka</th>
                    <th className="th !px-2 text-right">Netto</th>
                    <th className="th !px-2 text-right">VAT</th>
                    <th className="th !px-2 text-right">Brutto</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 tabular-nums">
                  {stawki.map((s) => (
                    <tr key={s.stawka}>
                      <td className="td !px-2">{s.stawka}%</td>
                      <td className="td !px-2 text-right">{fmtPLN(s.netto, { symbol: false })}</td>
                      <td className="td !px-2 text-right">{fmtPLN(s.vat, { symbol: false })}</td>
                      <td className="td !px-2 text-right">{fmtPLN(s.brutto, { symbol: false })}</td>
                    </tr>
                  ))}
                  {stawki.length === 0 && (
                    <tr>
                      <td className="td !px-2 text-stone-400" colSpan={4}>
                        Brak pozycji
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="mt-3 space-y-1.5 border-t border-stone-200 pt-3 text-[14px]">
              <div className="flex justify-between text-stone-600">
                <span>Razem netto</span>
                <span className="tabular-nums">{fmtPLN(sum.netto)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Razem VAT</span>
                <span className="tabular-nums">{fmtPLN(sum.vat)}</span>
              </div>
              <div className="flex justify-between text-[16px] font-semibold text-ink">
                <span>Do zapłaty</span>
                <span className="tabular-nums">{fmtPLN(sum.brutto)}</span>
              </div>
            </div>
            <p className="mt-3 rounded-lg bg-stone-50 px-3 py-2 text-[12.5px] text-stone-500">
              Słownie: <span className="font-medium text-stone-700">{kwotaSlownie(sum.brutto)}</span>
            </p>
          </SectionCard>

          <SectionCard title="Mechanizm podzielonej płatności">
            <Toggle checked={!!f.splitPayment} onChange={(v) => set('splitPayment', v)} label="Split payment" />
            {splitSugerowany && (
              <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-[12.5px] text-amber-300">
                Kwota brutto przekracza 15 000 zł – dla transakcji B2B rozważ obowiązkowy mechanizm podzielonej
                płatności.
              </p>
            )}
          </SectionCard>

          {!isNew && (
            <button className="btn-danger w-full" onClick={usun}>
              <Trash2 size={16} /> Usuń fakturę
            </button>
          )}
        </div>
      </div>

      <Modal open={podglad} onClose={() => setPodglad(false)} title={`Podgląd – Faktura ${f.numer}`} size="xl">
        <div className="flex flex-col items-center gap-4">
          <div className="w-full overflow-x-auto">
            <div className="mx-auto origin-top scale-[0.82] sm:scale-100">{docNode}</div>
          </div>
          <div className="w-full border-t border-stone-200 pt-4">
            <PrintSendBar
              getPrintNode={() => docNode}
              share={{
                title: `Faktura ${f.numer}`,
                text: `Faktura ${f.numer} dla ${f.nabywcaNazwa || 'nabywcy'} na kwotę ${fmtPLN(sum.brutto)}.`,
                to: klient?.email,
                phone: klient?.telefon,
              }}
            />
          </div>
        </div>
      </Modal>
      {confirmNode}
    </div>
  )
}
