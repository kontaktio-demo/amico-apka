import React, { useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  Plus,
  Trash2,
  Save,
  Banknote,
  ArrowRightLeft,
  Coins,
  AlertTriangle,
  PenLine,
  ScrollText,
  Landmark,
} from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  Card,
  CardBody,
  SectionCard,
  Field,
  Input,
  Toggle,
  Checkbox,
  Badge,
  Stat,
  EmptyState,
  Modal,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { SignatureModal, SignatureView } from '../components/SignaturePad'
import { RaportKasowyDoc } from '../documents/RaportKasowyDoc'
import { DocSheet } from '../documents/DocShell'
import { fmtPLN, fmtDate, fmtKonto, validNRB, parseNum, today, nowISO } from '../lib/format'
import { uid } from '../lib/id'
import type { Firma, RaportKasowy, RaportKasowyRow, Przelew, ObrotPozycja, Signature } from '../lib/types'

type Tab = 'raport' | 'przelewy' | 'obrot'

// ---------------------------------------------------------------------------
// Pomocnicze pole liczbowe (przyjmuje przecinek, zapisuje number)
// ---------------------------------------------------------------------------
function NumInput({
  value,
  onChange,
  className,
  placeholder,
}: {
  value: number | undefined
  onChange: (n: number) => void
  className?: string
  placeholder?: string
}) {
  const [txt, setTxt] = useState(value ? String(value).replace('.', ',') : '')
  useEffect(() => {
    if (parseNum(txt) !== (value || 0)) setTxt(value ? String(value).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <input
      className={cx('input', className)}
      inputMode="decimal"
      placeholder={placeholder ?? '0,00'}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value)
        onChange(parseNum(e.target.value))
      }}
    />
  )
}

// ===========================================================================
// MODUL FINANSE
// ===========================================================================
export default function Finanse() {
  const firma = useStore((s) => s.aktywnaFirma)()
  const [tab, setTab] = useState<Tab>('raport')

  const zakladki: { klucz: Tab; nazwa: string; icon: React.ReactNode }[] = [
    { klucz: 'raport', nazwa: 'Raport kasowy', icon: <ScrollText size={16} /> },
    { klucz: 'przelewy', nazwa: 'Przelewy', icon: <ArrowRightLeft size={16} /> },
    { klucz: 'obrot', nazwa: 'Obrót pieniężny', icon: <Coins size={16} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Finanse"
        subtitle={`Raporty kasowe, przelewy i obrót pieniężny · ${firma.nazwa}`}
        icon={<Wallet size={22} />}
      />

      <div className="mb-5 flex flex-wrap gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-1.5 shadow-card">
        {zakladki.map((z) => (
          <button
            key={z.klucz}
            onClick={() => setTab(z.klucz)}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2 text-[14px] font-semibold transition',
              tab === z.klucz ? 'bg-white/10 text-white shadow-sm' : 'text-stone-600 hover:bg-stone-100',
            )}
          >
            {z.icon}
            {z.nazwa}
          </button>
        ))}
      </div>

      {tab === 'raport' && <RaportyTab firma={firma} />}
      {tab === 'przelewy' && <PrzelewyTab firma={firma} />}
      {tab === 'obrot' && <ObrotTab firma={firma} />}
    </div>
  )
}

// ===========================================================================
// 1) RAPORT KASOWY
// ===========================================================================
function obrotyRaportu(r: RaportKasowy) {
  const przychod = r.wiersze.reduce((a, w) => a + (w.przychod || 0), 0)
  const rozchod = r.wiersze.reduce((a, w) => a + (w.rozchod || 0), 0)
  const saldo = (r.saldoPoczatkowe || 0) + przychod - rozchod
  return { przychod, rozchod, saldo }
}

function RaportyTab({ firma }: { firma: Firma }) {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const podgladNumeru = useStore((s) => s.podgladNumeru)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [edytowany, setEdytowany] = useState<RaportKasowy | null>(null)

  const raporty = useMemo(
    () =>
      b.raportyKasowe
        .filter((r) => r.firmaId === firma.id)
        .slice()
        .sort((a, c) => (c.od || c.utworzono).localeCompare(a.od || a.utworzono)),
    [b.raportyKasowe, firma.id],
  )

  // Numer to podglad; nadajemy go dopiero przy zapisie (patrz onSave nizej).
  const nowy = () => {
    const r: RaportKasowy = {
      id: uid('rk'),
      numer: podgladNumeru('RK'),
      firmaId: firma.id,
      od: today(),
      do: today(),
      saldoPoczatkowe: 0,
      wiersze: [],
      data: today(),
      utworzono: nowISO(),
    }
    setEdytowany(r)
  }

  const usun = async (r: RaportKasowy) => {
    if (await confirm(`Usunąć raport kasowy ${r.numer}?`)) {
      remove('raportyKasowe', r.id)
      push('Raport usunięty', 'info')
    }
  }

  return (
    <div className="space-y-5">
      {confirmNode}
      <div className="flex justify-end">
        <button className="btn-primary" onClick={nowy}>
          <Plus size={17} /> Nowy raport kasowy
        </button>
      </div>

      {raporty.length === 0 ? (
        <EmptyState
          icon={<ScrollText size={26} />}
          title="Brak raportów kasowych"
          desc="Utwórz raport kasowy, aby rozliczyć przychody i rozchody w wybranym okresie."
          action={
            <button className="btn-primary" onClick={nowy}>
              <Plus size={17} /> Nowy raport kasowy
            </button>
          }
        />
      ) : (
        <div className="space-y-3">
          {raporty.map((r) => {
            const o = obrotyRaportu(r)
            return (
              <Card key={r.id}>
                <CardBody className="flex flex-wrap items-center gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[15px] font-semibold text-ink">{r.numer}</span>
                      <Badge tone="stone">
                        {fmtDate(r.od)} – {fmtDate(r.do)}
                      </Badge>
                      {r.podpis && <Badge tone="green">Podpisany</Badge>}
                    </div>
                    <div className="mt-1 text-[13px] text-stone-500">
                      Przychody {fmtPLN(o.przychod)} · Rozchody {fmtPLN(o.rozchod)} ·{' '}
                      <span className="font-semibold text-brand-700">Saldo {fmtPLN(o.saldo)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <PrintSendBar
                      size="sm"
                      getPrintNode={() => (
                        <RaportKasowyDoc r={r} firma={firma} logoDataUrl={b.ustawienia.logoDataUrl} />
                      )}
                      share={{
                        title: `Raport kasowy ${r.numer}`,
                        text: `Raport kasowy ${r.numer} (${fmtDate(r.od)}–${fmtDate(r.do)})\nPrzychody: ${fmtPLN(
                          o.przychod,
                        )}\nRozchody: ${fmtPLN(o.rozchod)}\nSaldo: ${fmtPLN(o.saldo)}`,
                      }}
                    />
                    <button className="btn-outline btn-sm" onClick={() => setEdytowany(r)}>
                      <PenLine size={15} /> Edytuj
                    </button>
                    <button className="btn-ghost btn-sm !px-2 text-red-600" onClick={() => usun(r)}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      {edytowany && (
        <RaportEditor
          firma={firma}
          raport={edytowany}
          logoDataUrl={b.ustawienia.logoDataUrl}
          onClose={() => setEdytowany(null)}
          onSave={(r) => {
            const nowyRaport = !b.raportyKasowe.some((x) => x.id === r.id)
            upsert('raportyKasowe', { ...r, numer: nowyRaport ? kolejnyNumer('RK') : r.numer })
            setEdytowany(null)
            push('Raport kasowy zapisany')
          }}
        />
      )}
    </div>
  )
}

function RaportEditor({
  firma,
  raport,
  logoDataUrl,
  onClose,
  onSave,
}: {
  firma: Firma
  raport: RaportKasowy
  logoDataUrl?: string
  onClose: () => void
  onSave: (r: RaportKasowy) => void
}) {
  const [draft, setDraft] = useState<RaportKasowy>(raport)
  const [podpisOpen, setPodpisOpen] = useState(false)
  const o = obrotyRaportu(draft)

  const set = (p: Partial<RaportKasowy>) => setDraft((d) => ({ ...d, ...p }))

  const setWiersz = (id: string, p: Partial<RaportKasowyRow>) =>
    setDraft((d) => ({ ...d, wiersze: d.wiersze.map((w) => (w.id === id ? { ...w, ...p } : w)) }))

  const dodajWiersz = () => setDraft((d) => ({ ...d, wiersze: [...d.wiersze, { id: uid('rkw') }] }))

  const usunWiersz = (id: string) => setDraft((d) => ({ ...d, wiersze: d.wiersze.filter((w) => w.id !== id) }))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Raport kasowy · ${draft.numer}`}
      size="xl"
      footer={
        <>
          <PrintSendBar
            getPrintNode={() => <RaportKasowyDoc r={draft} firma={firma} logoDataUrl={logoDataUrl} />}
            share={{
              title: `Raport kasowy ${draft.numer}`,
              text: `Raport kasowy ${draft.numer} (${fmtDate(draft.od)}–${fmtDate(draft.do)}) · Saldo ${fmtPLN(o.saldo)}`,
            }}
          />
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)}>
            <Save size={16} /> Zapisz raport
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Okres od">
            <Input type="date" value={draft.od} onChange={(e) => set({ od: e.target.value })} />
          </Field>
          <Field label="Okres do">
            <Input type="date" value={draft.do} onChange={(e) => set({ do: e.target.value })} />
          </Field>
          <Field label="Saldo początkowe">
            <NumInput value={draft.saldoPoczatkowe} onChange={(n) => set({ saldoPoczatkowe: n })} />
          </Field>
          <Field label="Data raportu">
            <Input type="date" value={draft.data || ''} onChange={(e) => set({ data: e.target.value })} />
          </Field>
        </div>

        {/* Tabela wierszy */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="section-title">Obroty kasowe</span>
            <button className="btn-outline btn-sm" onClick={dodajWiersz}>
              <Plus size={15} /> Dodaj wiersz
            </button>
          </div>
          <div className="overflow-x-auto rounded-2xl border border-stone-200">
            <table className="w-full min-w-[720px]">
              <thead className="bg-stone-50">
                <tr>
                  <th className="th">Nazwisko</th>
                  <th className="th w-24">Zlec.</th>
                  <th className="th">Treść</th>
                  <th className="th w-32 text-right">Przychód</th>
                  <th className="th w-32 text-right">Rozchód</th>
                  <th className="th w-10" />
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {draft.wiersze.length === 0 && (
                  <tr>
                    <td className="td text-center text-stone-400" colSpan={6}>
                      Brak wierszy – dodaj pierwszy obrót.
                    </td>
                  </tr>
                )}
                {draft.wiersze.map((w) => (
                  <tr key={w.id} className="row-hover">
                    <td className="td">
                      <Input value={w.nazwisko || ''} onChange={(e) => setWiersz(w.id, { nazwisko: e.target.value })} />
                    </td>
                    <td className="td">
                      <Input value={w.zlec || ''} onChange={(e) => setWiersz(w.id, { zlec: e.target.value })} />
                    </td>
                    <td className="td">
                      <Input value={w.tresc || ''} onChange={(e) => setWiersz(w.id, { tresc: e.target.value })} />
                    </td>
                    <td className="td">
                      <NumInput
                        value={w.przychod}
                        onChange={(n) => setWiersz(w.id, { przychod: n })}
                        className="text-right"
                      />
                    </td>
                    <td className="td">
                      <NumInput
                        value={w.rozchod}
                        onChange={(n) => setWiersz(w.id, { rozchod: n })}
                        className="text-right"
                      />
                    </td>
                    <td className="td">
                      <button className="btn-ghost !px-2 text-red-600" onClick={() => usunWiersz(w.id)}>
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-stone-50 font-semibold text-ink">
                  <td className="td text-right" colSpan={3}>
                    OBROTY
                  </td>
                  <td className="td text-right">{fmtPLN(o.przychod)}</td>
                  <td className="td text-right">{fmtPLN(o.rozchod)}</td>
                  <td className="td" />
                </tr>
                <tr className="bg-white/10 font-semibold text-white">
                  <td className="td text-right text-white" colSpan={5}>
                    SALDO
                  </td>
                  <td className="td text-right text-white">{fmtPLN(o.saldo)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="mt-1.5 text-[12px] text-stone-400">
            SALDO = saldo początkowe {fmtPLN(draft.saldoPoczatkowe)} + przychody {fmtPLN(o.przychod)} − rozchody{' '}
            {fmtPLN(o.rozchod)}
          </p>
        </div>

        {/* Podpis */}
        <SectionCard title="Podpis osoby sporządzającej">
          {draft.podpis ? (
            <div className="flex items-center gap-4">
              <div className="w-56">
                <SignatureView sig={draft.podpis} />
              </div>
              <button className="btn-outline btn-sm" onClick={() => setPodpisOpen(true)}>
                <PenLine size={15} /> Zmień podpis
              </button>
              <button className="btn-ghost btn-sm text-red-600" onClick={() => set({ podpis: undefined })}>
                Usuń podpis
              </button>
            </div>
          ) : (
            <button className="btn-outline" onClick={() => setPodpisOpen(true)}>
              <PenLine size={16} /> Podpisz raport
            </button>
          )}
        </SectionCard>
      </div>

      <SignatureModal
        open={podpisOpen}
        onClose={() => setPodpisOpen(false)}
        onSave={(sig: Signature) => set({ podpis: sig })}
        domyslnyPodpisujacy={firma.wlasciciel}
        rola="Sporządzający"
        dokumentId={draft.id}
      />
    </Modal>
  )
}

// ===========================================================================
// 2) PRZELEWY
// ===========================================================================
function PrzelewyTab({ firma }: { firma: Firma }) {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const przelewy = useMemo(
    () =>
      b.przelewy
        .filter((p) => p.firmaId === firma.id)
        .slice()
        .sort((a, c) => c.data.localeCompare(a.data)),
    [b.przelewy, firma.id],
  )

  const sumaDoZaplaty = przelewy.filter((p) => p.status === 'do_zaplaty').reduce((a, p) => a + (p.kwota || 0), 0)
  const sumaZaplacone = przelewy.filter((p) => p.status === 'zaplacony').reduce((a, p) => a + (p.kwota || 0), 0)

  // formularz nowego przelewu
  const pusty = (): Przelew => ({
    id: uid('prz'),
    firmaId: firma.id,
    odbiorca: '',
    konto: '',
    tytul: '',
    kwota: 0,
    data: today(),
    status: 'do_zaplaty',
    splitPayment: false,
  })
  const [form, setForm] = useState<Przelew>(pusty)
  const setF = (p: Partial<Przelew>) => setForm((f) => ({ ...f, ...p }))
  const kontoBlad = form.konto.trim().length > 0 && !validNRB(form.konto)

  const dodaj = () => {
    if (!form.odbiorca.trim()) {
      push('Podaj odbiorcę przelewu', 'err')
      return
    }
    upsert('przelewy', form)
    setForm(pusty())
    push('Przelew dodany')
  }

  const usun = async (p: Przelew) => {
    if (await confirm(`Usunąć przelew dla „${p.odbiorca}”?`)) {
      remove('przelewy', p.id)
      push('Przelew usunięty', 'info')
    }
  }

  return (
    <div className="space-y-5">
      {confirmNode}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Do zapłaty"
          value={fmtPLN(sumaDoZaplaty)}
          icon={<Banknote size={18} />}
          sub={`${przelewy.filter((p) => p.status === 'do_zaplaty').length} przelewów`}
        />
        <Stat label="Zapłacone" value={fmtPLN(sumaZaplacone)} tone="green" icon={<Landmark size={18} />} />
        <Stat label="Razem" value={przelewy.length} sub="wszystkich przelewów" />
      </div>

      <SectionCard title="Nowy przelew" icon={<Plus size={16} />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Odbiorca">
            <Input
              value={form.odbiorca}
              onChange={(e) => setF({ odbiorca: e.target.value })}
              placeholder="Nazwa odbiorcy"
            />
          </Field>
          <Field label="Numer konta (NRB)" error={kontoBlad ? 'Nieprawidłowy numer rachunku (NRB)' : undefined}>
            <Input value={form.konto} onChange={(e) => setF({ konto: e.target.value })} placeholder="26 cyfr" />
          </Field>
          <Field label="Tytuł przelewu">
            <Input
              value={form.tytul}
              onChange={(e) => setF({ tytul: e.target.value })}
              placeholder="np. Faktura FV 12/2026"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kwota">
              <NumInput value={form.kwota} onChange={(n) => setF({ kwota: n })} />
            </Field>
            <Field label="Data">
              <Input type="date" value={form.data} onChange={(e) => setF({ data: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center gap-6 pt-1">
            <Checkbox
              label="Split payment (MPP)"
              checked={form.splitPayment}
              onChange={(v) => setF({ splitPayment: v })}
            />
          </div>
          <div className="flex items-end justify-end">
            <button className="btn-primary" onClick={dodaj}>
              <Plus size={17} /> Dodaj przelew
            </button>
          </div>
        </div>
        {kontoBlad && (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-amber-700">
            <AlertTriangle size={14} /> Numer rachunku nie przechodzi walidacji NRB – sprawdź przed wysłaniem.
          </p>
        )}
      </SectionCard>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Lista przelewów</h3>
            <PrintSendBar
              size="sm"
              getPrintNode={() => (
                <PrzelewyDoc firma={firma} przelewy={przelewy} logoDataUrl={b.ustawienia.logoDataUrl} />
              )}
              share={{
                title: 'Zestawienie przelewów',
                text: `Zestawienie przelewów (${przelewy.length}) · Do zapłaty: ${fmtPLN(sumaDoZaplaty)}`,
              }}
            />
          </div>
          {przelewy.length === 0 ? (
            <EmptyState
              icon={<ArrowRightLeft size={26} />}
              title="Brak przelewów"
              desc="Dodaj pierwszy przelew powyżej."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px]">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="th">Odbiorca</th>
                    <th className="th">Numer konta</th>
                    <th className="th">Tytuł</th>
                    <th className="th text-right">Kwota</th>
                    <th className="th">Data</th>
                    <th className="th text-center">Status</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {przelewy.map((p) => (
                    <tr key={p.id} className="row-hover">
                      <td className="td font-medium text-ink">
                        {p.odbiorca}
                        {p.splitPayment && (
                          <span className="ml-2 align-middle">
                            <Badge tone="blue">MPP</Badge>
                          </span>
                        )}
                      </td>
                      <td className="td font-mono text-[13px] text-stone-500">{p.konto ? fmtKonto(p.konto) : '–'}</td>
                      <td className="td">{p.tytul || '–'}</td>
                      <td className="td text-right font-semibold">{fmtPLN(p.kwota)}</td>
                      <td className="td">{fmtDate(p.data)}</td>
                      <td className="td">
                        <div className="flex items-center justify-center gap-2">
                          <Toggle
                            checked={p.status === 'zaplacony'}
                            onChange={(v) => upsert('przelewy', { ...p, status: v ? 'zaplacony' : 'do_zaplaty' })}
                          />
                          <Badge tone={p.status === 'zaplacony' ? 'green' : 'amber'}>
                            {p.status === 'zaplacony' ? 'Zapłacony' : 'Do zapłaty'}
                          </Badge>
                        </div>
                      </td>
                      <td className="td">
                        <button className="btn-ghost !px-2 text-red-600" onClick={() => usun(p)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-stone-200 font-semibold text-ink">
                    <td className="td text-right" colSpan={3}>
                      Razem do zapłaty
                    </td>
                    <td className="td text-right text-brand-700">{fmtPLN(sumaDoZaplaty)}</td>
                    <td className="td" colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// Dokument do druku – zestawienie przelewow
function PrzelewyDoc({ firma, przelewy, logoDataUrl }: { firma: Firma; przelewy: Przelew[]; logoDataUrl?: string }) {
  const doZaplaty = przelewy.filter((p) => p.status === 'do_zaplaty').reduce((a, p) => a + (p.kwota || 0), 0)
  const razem = przelewy.reduce((a, p) => a + (p.kwota || 0), 0)
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#12233a',
            letterSpacing: '0.05em',
          }}
        >
          ZESTAWIENIE PRZELEWÓW
        </div>
        <div style={{ fontSize: '8.5pt', color: '#6b6459', marginTop: 3 }}>Data zestawienia: {fmtDate(today())}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <th style={{ ...zth(), textAlign: 'left' }}>ODBIORCA</th>
            <th style={{ ...zth(), textAlign: 'left' }}>NUMER KONTA</th>
            <th style={{ ...zth(), textAlign: 'left' }}>TYTUŁ</th>
            <th style={zth(90)}>KWOTA</th>
            <th style={zth(70)}>DATA</th>
            <th style={zth(80)}>STATUS</th>
          </tr>
        </thead>
        <tbody>
          {przelewy.length === 0 && (
            <tr>
              <td style={ztd()} colSpan={6}>
                &nbsp;
              </td>
            </tr>
          )}
          {przelewy.map((p) => (
            <tr key={p.id}>
              <td style={ztd()}>
                {p.odbiorca}
                {p.splitPayment ? ' (MPP)' : ''}
              </td>
              <td style={{ ...ztd(), fontVariantNumeric: 'tabular-nums' }}>{p.konto ? fmtKonto(p.konto) : ''}</td>
              <td style={ztd()}>{p.tytul || ''}</td>
              <td style={{ ...ztd(), textAlign: 'right' }}>{fmtPLN(p.kwota)}</td>
              <td style={{ ...ztd(), textAlign: 'center' }}>{fmtDate(p.data)}</td>
              <td style={{ ...ztd(), textAlign: 'center' }}>{p.status === 'zaplacony' ? 'Zapłacony' : 'Do zapłaty'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0ede6' }}>
            <td style={{ ...ztd(), fontWeight: 700, textAlign: 'right' }} colSpan={3}>
              DO ZAPŁATY
            </td>
            <td style={{ ...ztd(), textAlign: 'right', fontWeight: 700 }}>{fmtPLN(doZaplaty)}</td>
            <td style={ztd()} colSpan={2} />
          </tr>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <td style={{ ...ztd(), fontWeight: 700, textAlign: 'right', color: '#fff' }} colSpan={3}>
              RAZEM
            </td>
            <td style={{ ...ztd(), textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmtPLN(razem)}</td>
            <td style={{ ...ztd(), color: '#fff' }} colSpan={2} />
          </tr>
        </tfoot>
      </table>
    </DocSheet>
  )
}

// ===========================================================================
// 3) OBRÓT PIENIĘŻNY
// ===========================================================================
function ObrotTab({ firma }: { firma: Firma }) {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const pozycje = useMemo(
    () =>
      b.obrot
        .filter((p) => p.firmaId === firma.id)
        .slice()
        .sort((a, c) => c.data.localeCompare(a.data)),
    [b.obrot, firma.id],
  )

  const sumaPrzychod = pozycje.reduce((a, p) => a + (p.przychod || 0), 0)
  const sumaRozchod = pozycje.reduce((a, p) => a + (p.rozchod || 0), 0)
  const saldo = sumaPrzychod - sumaRozchod

  const pusty = (): ObrotPozycja => ({
    id: uid('obr'),
    firmaId: firma.id,
    data: today(),
    zaCo: '',
    kto: '',
    przychod: 0,
    rozchod: 0,
  })
  const [form, setForm] = useState<ObrotPozycja>(pusty)
  const setF = (p: Partial<ObrotPozycja>) => setForm((f) => ({ ...f, ...p }))

  const dodaj = () => {
    if (!form.zaCo.trim()) {
      push('Podaj opis („za co”)', 'err')
      return
    }
    upsert('obrot', form)
    setForm(pusty())
    push('Pozycja dodana')
  }

  const usun = async (p: ObrotPozycja) => {
    if (await confirm('Usunąć tę pozycję obrotu?')) {
      remove('obrot', p.id)
      push('Pozycja usunięta', 'info')
    }
  }

  return (
    <div className="space-y-5">
      {confirmNode}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat label="Przychody" value={fmtPLN(sumaPrzychod)} tone="green" icon={<Coins size={18} />} />
        <Stat label="Rozchody" value={fmtPLN(sumaRozchod)} icon={<Banknote size={18} />} />
        <Stat label="Saldo bieżące" value={fmtPLN(saldo)} tone={saldo >= 0 ? 'green' : 'stone'} />
      </div>

      <SectionCard title="Nowa pozycja obrotu" icon={<Plus size={16} />}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <Field label="Data" className="lg:col-span-1">
            <Input type="date" value={form.data} onChange={(e) => setF({ data: e.target.value })} />
          </Field>
          <Field label="Za co" className="sm:col-span-2 lg:col-span-2">
            <Input value={form.zaCo} onChange={(e) => setF({ zaCo: e.target.value })} placeholder="Opis operacji" />
          </Field>
          <Field label="Kto">
            <Input value={form.kto || ''} onChange={(e) => setF({ kto: e.target.value })} placeholder="Osoba / firma" />
          </Field>
          <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1">
            <Field label="Przychód">
              <NumInput value={form.przychod} onChange={(n) => setF({ przychod: n })} />
            </Field>
            <Field label="Rozchód">
              <NumInput value={form.rozchod} onChange={(n) => setF({ rozchod: n })} />
            </Field>
          </div>
        </div>
        <div className="mt-3 flex justify-end">
          <button className="btn-primary" onClick={dodaj}>
            <Plus size={17} /> Dodaj pozycję
          </button>
        </div>
      </SectionCard>

      <Card>
        <CardBody>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[15px] font-semibold text-ink">Obrót pieniężny</h3>
            <PrintSendBar
              size="sm"
              getPrintNode={() => <ObrotDoc firma={firma} pozycje={pozycje} logoDataUrl={b.ustawienia.logoDataUrl} />}
              share={{
                title: 'Zestawienie obrotu pieniężnego',
                text: `Obrót pieniężny · Przychody ${fmtPLN(sumaPrzychod)} · Rozchody ${fmtPLN(
                  sumaRozchod,
                )} · Saldo ${fmtPLN(saldo)}`,
              }}
            />
          </div>
          {pozycje.length === 0 ? (
            <EmptyState icon={<Coins size={26} />} title="Brak pozycji obrotu" desc="Dodaj pierwszą pozycję powyżej." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px]">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="th text-right">Przychód</th>
                    <th className="th text-right">Rozchód</th>
                    <th className="th">Za co</th>
                    <th className="th">Kto</th>
                    <th className="th">Data</th>
                    <th className="th w-10" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {pozycje.map((p) => (
                    <tr key={p.id} className="row-hover">
                      <td className="td text-right font-semibold text-brand-700">
                        {p.przychod ? fmtPLN(p.przychod) : '–'}
                      </td>
                      <td className="td text-right font-semibold text-red-600">
                        {p.rozchod ? fmtPLN(p.rozchod) : '–'}
                      </td>
                      <td className="td">{p.zaCo || '–'}</td>
                      <td className="td">{p.kto || '–'}</td>
                      <td className="td">{fmtDate(p.data)}</td>
                      <td className="td">
                        <button className="btn-ghost !px-2 text-red-600" onClick={() => usun(p)}>
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-stone-200 font-semibold text-ink">
                    <td className="td text-right text-brand-700">{fmtPLN(sumaPrzychod)}</td>
                    <td className="td text-right text-red-600">{fmtPLN(sumaRozchod)}</td>
                    <td className="td" colSpan={4}>
                      Saldo bieżące: <span className="text-brand-700">{fmtPLN(saldo)}</span>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// Dokument do druku – zestawienie obrotu pienieznego
function ObrotDoc({ firma, pozycje, logoDataUrl }: { firma: Firma; pozycje: ObrotPozycja[]; logoDataUrl?: string }) {
  const sumaPrzychod = pozycje.reduce((a, p) => a + (p.przychod || 0), 0)
  const sumaRozchod = pozycje.reduce((a, p) => a + (p.rozchod || 0), 0)
  const saldo = sumaPrzychod - sumaRozchod
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#12233a',
            letterSpacing: '0.05em',
          }}
        >
          OBRÓT PIENIĘŻNY
        </div>
        <div style={{ fontSize: '8.5pt', color: '#6b6459', marginTop: 3 }}>Data zestawienia: {fmtDate(today())}</div>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <th style={zth(110)}>PRZYCHÓD</th>
            <th style={zth(110)}>ROZCHÓD</th>
            <th style={{ ...zth(), textAlign: 'left' }}>ZA CO</th>
            <th style={{ ...zth(), textAlign: 'left' }}>KTO</th>
            <th style={zth(80)}>DATA</th>
          </tr>
        </thead>
        <tbody>
          {pozycje.length === 0 && (
            <tr>
              <td style={ztd()} colSpan={5}>
                &nbsp;
              </td>
            </tr>
          )}
          {pozycje.map((p) => (
            <tr key={p.id}>
              <td style={{ ...ztd(), textAlign: 'right' }}>{p.przychod ? fmtPLN(p.przychod) : ''}</td>
              <td style={{ ...ztd(), textAlign: 'right' }}>{p.rozchod ? fmtPLN(p.rozchod) : ''}</td>
              <td style={ztd()}>{p.zaCo || ''}</td>
              <td style={ztd()}>{p.kto || ''}</td>
              <td style={{ ...ztd(), textAlign: 'center' }}>{fmtDate(p.data)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0ede6' }}>
            <td style={{ ...ztd(), textAlign: 'right', fontWeight: 700 }}>{fmtPLN(sumaPrzychod)}</td>
            <td style={{ ...ztd(), textAlign: 'right', fontWeight: 700 }}>{fmtPLN(sumaRozchod)}</td>
            <td style={{ ...ztd(), fontWeight: 700 }} colSpan={3}>
              OBROTY
            </td>
          </tr>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <td style={{ ...ztd(), fontWeight: 700, color: '#fff' }} colSpan={4}>
              SALDO BIEŻĄCE
            </td>
            <td style={{ ...ztd(), textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmtPLN(saldo)}</td>
          </tr>
        </tfoot>
      </table>
    </DocSheet>
  )
}

// wspolne style tabel dokumentow
const zth = (w?: number): React.CSSProperties => ({
  border: '1px solid #d3cfc2',
  padding: '5px 7px',
  fontSize: '7.8pt',
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: '0.04em',
  width: w,
})
const ztd = (): React.CSSProperties => ({ border: '1px solid #d3cfc2', padding: '4px 7px', verticalAlign: 'top' })
