import { useState } from 'react'
import { FileCheck2, Receipt, Plus, Pencil, Trash2 } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  Card,
  Field,
  Input,
  Textarea,
  Select,
  Badge,
  EmptyState,
  SearchInput,
  Modal,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { SignatureField, SignatureModal } from '../components/SignaturePad'
import { fmtPLN, fmtDate, today, nowISO, parseNum, kwotaSlownie } from '../lib/format'
import { klientNazwa, klientAdres } from '../lib/helpers'
import { uid } from '../lib/id'
import { ProtokolDoc } from '../documents/Protokol'
import { KPDoc } from '../documents/KP'
import type { Protokol, KP, Klient, Signature, Firma } from '../lib/types'

type Tab = 'protokoly' | 'kp'

export default function Dokumenty() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const podgladNumeru = useStore((s) => s.podgladNumeru)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const logo = b.ustawienia.logoDataUrl
  const [tab, setTab] = useState<Tab>('protokoly')
  const [szukaj, setSzukaj] = useState('')

  const [edytorP, setEdytorP] = useState<Protokol | null>(null)
  const [edytorK, setEdytorK] = useState<KP | null>(null)

  const klientById = (id?: string): Klient | undefined => (id ? b.klienci.find((k) => k.id === id) : undefined)

  // ---------------- listy ----------------
  const q = szukaj.trim().toLowerCase()
  const protokoly = b.protokoly
    .slice()
    .sort((a, c) => c.utworzono.localeCompare(a.utworzono))
    .filter((p) => {
      if (!q) return true
      const kn = p.klientNazwa || klientNazwa(klientById(p.klientId))
      return [p.numer, kn, p.numerZamowienia].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  const kpLista = b.kp
    .slice()
    .sort((a, c) => c.utworzono.localeCompare(a.utworzono))
    .filter((kp) => {
      if (!q) return true
      const kn = kp.odKogo || klientNazwa(klientById(kp.klientId))
      return [kp.numer, kn, kp.tytul].filter(Boolean).join(' ').toLowerCase().includes(q)
    })

  // ---------------- akcje: nowy ----------------
  // Numer to na razie tylko PODGLAD. Prawdziwy nadajemy przy zapisie (onSave),
  // zeby otwarcie i zamkniecie okna nie robilo dziury w numeracji.
  const nowyProtokol = () => {
    setEdytorP({
      id: uid('po'),
      numer: podgladNumeru('PO'),
      firmaId: firma.id,
      klientId: undefined,
      klientNazwa: '',
      klientAdres: '',
      klientTelefon: '',
      numerZamowienia: '',
      data: today(),
      odebraneElementy: '',
      uwagi: '',
      podpisKlienta: undefined,
      utworzono: nowISO(),
    })
  }
  const nowyKP = () => {
    setEdytorK({
      id: uid('kp'),
      numer: podgladNumeru('KP'),
      firmaId: firma.id,
      klientId: undefined,
      data: today(),
      odKogo: '',
      kwota: 0,
      tytul: '',
      slownie: '',
      podpisPrzyjmujacy: undefined,
      utworzono: nowISO(),
    })
  }

  const usunProtokol = async (p: Protokol) => {
    if (await confirm(`Usunąć protokół ${p.numer}? Tej operacji nie można cofnąć.`)) {
      remove('protokoly', p.id)
      push('Protokół usunięty', 'info')
    }
  }
  const usunKP = async (kp: KP) => {
    if (await confirm(`Usunąć dowód KP ${kp.numer}? Tej operacji nie można cofnąć.`)) {
      remove('kp', kp.id)
      push('Dowód KP usunięty', 'info')
    }
  }

  return (
    <div>
      <PageHeader
        title="Dokumenty"
        subtitle="Protokoły odbioru i dowody kasowe KP"
        icon={<FileCheck2 size={22} />}
        actions={
          tab === 'protokoly' ? (
            <button className="btn-primary" onClick={nowyProtokol}>
              <Plus size={17} /> Nowy protokół
            </button>
          ) : (
            <button className="btn-primary" onClick={nowyKP}>
              <Plus size={17} /> Nowy KP
            </button>
          )
        }
      />

      {/* Zakładki */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <TabBtn active={tab === 'protokoly'} onClick={() => setTab('protokoly')} icon={<FileCheck2 size={16} />}>
          Protokoły odbioru
          <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500">
            {b.protokoly.length}
          </span>
        </TabBtn>
        <TabBtn active={tab === 'kp'} onClick={() => setTab('kp')} icon={<Receipt size={16} />}>
          KP – Kasa Przyjmie
          <span className="ml-1.5 rounded-full bg-stone-100 px-1.5 text-[11px] text-stone-500">{b.kp.length}</span>
        </TabBtn>
        <div className="ml-auto w-full sm:w-64">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj po numerze, kliencie…" />
        </div>
      </div>

      {/* ---------------- Protokoły ---------------- */}
      {tab === 'protokoly' &&
        (protokoly.length === 0 ? (
          <EmptyState
            icon={<FileCheck2 size={26} />}
            title="Brak protokołów odbioru"
            desc="Wystaw protokół potwierdzający odbiór elementów kamiennych przez klienta."
            action={
              <button className="btn-primary" onClick={nowyProtokol}>
                <Plus size={17} /> Nowy protokół
              </button>
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th text-left">Numer</th>
                    <th className="th text-left">Klient</th>
                    <th className="th text-left">Zamówienie</th>
                    <th className="th text-left">Data</th>
                    <th className="th text-left">Podpis</th>
                    <th className="th text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {protokoly.map((p) => {
                    const kl = klientById(p.klientId)
                    const nazwa = p.klientNazwa || klientNazwa(kl)
                    return (
                      <tr key={p.id} className="row-hover">
                        <td className="td font-medium text-ink">{p.numer}</td>
                        <td className="td">{nazwa || '–'}</td>
                        <td className="td text-stone-500">{p.numerZamowienia || '–'}</td>
                        <td className="td text-stone-500">{fmtDate(p.data)}</td>
                        <td className="td">
                          {p.podpisKlienta ? (
                            <Badge tone="green">Podpisany</Badge>
                          ) : (
                            <Badge tone="stone">Bez podpisu</Badge>
                          )}
                        </td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-2">
                            <PrintSendBar
                              size="sm"
                              getPrintNode={() => (
                                <ProtokolDoc
                                  p={p}
                                  firma={b.firmy.find((x) => x.id === p.firmaId) || firma}
                                  logoDataUrl={logo}
                                />
                              )}
                              share={{
                                title: `Protokół odbioru ${p.numer}`,
                                text: `Protokół odbioru ${p.numer} – ${nazwa}. Data: ${fmtDate(p.data)}.`,
                                to: kl?.email,
                                phone: p.klientTelefon || kl?.telefon,
                              }}
                            />
                            <button className="btn-ghost btn-sm" onClick={() => setEdytorP(p)} title="Edytuj">
                              <Pencil size={15} />
                            </button>
                            <button
                              className="btn-ghost btn-sm text-red-600"
                              onClick={() => usunProtokol(p)}
                              title="Usuń"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {/* ---------------- KP ---------------- */}
      {tab === 'kp' &&
        (kpLista.length === 0 ? (
          <EmptyState
            icon={<Receipt size={26} />}
            title="Brak dowodów KP"
            desc="Wystaw kasowy dowód wpłaty (KP) potwierdzający przyjęcie gotówki."
            action={
              <button className="btn-primary" onClick={nowyKP}>
                <Plus size={17} /> Nowy KP
              </button>
            }
          />
        ) : (
          <Card>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="th text-left">Numer</th>
                    <th className="th text-left">Od kogo</th>
                    <th className="th text-left">Tytułem</th>
                    <th className="th text-right">Kwota</th>
                    <th className="th text-left">Data</th>
                    <th className="th text-right">Akcje</th>
                  </tr>
                </thead>
                <tbody>
                  {kpLista.map((kp) => {
                    const kl = klientById(kp.klientId)
                    const nazwa = kp.odKogo || klientNazwa(kl)
                    return (
                      <tr key={kp.id} className="row-hover">
                        <td className="td font-medium text-ink">{kp.numer}</td>
                        <td className="td">{nazwa || '–'}</td>
                        <td className="td text-stone-500">{kp.tytul || '–'}</td>
                        <td className="td text-right font-semibold text-ink">{fmtPLN(kp.kwota)}</td>
                        <td className="td text-stone-500">{fmtDate(kp.data)}</td>
                        <td className="td">
                          <div className="flex items-center justify-end gap-2">
                            <PrintSendBar
                              size="sm"
                              getPrintNode={() => (
                                <KPDoc
                                  kp={kp}
                                  firma={b.firmy.find((x) => x.id === kp.firmaId) || firma}
                                  logoDataUrl={logo}
                                />
                              )}
                              share={{
                                title: `Dowód KP ${kp.numer}`,
                                text: `Dowód wpłaty KP ${kp.numer} na kwotę ${fmtPLN(kp.kwota)} od: ${nazwa}. Data: ${fmtDate(kp.data)}.`,
                                to: kl?.email,
                                phone: kl?.telefon,
                              }}
                            />
                            <button className="btn-ghost btn-sm" onClick={() => setEdytorK(kp)} title="Edytuj">
                              <Pencil size={15} />
                            </button>
                            <button className="btn-ghost btn-sm text-red-600" onClick={() => usunKP(kp)} title="Usuń">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ))}

      {edytorP && (
        <ProtokolEditor
          draft={edytorP}
          klienci={b.klienci}
          firma={b.firmy.find((x) => x.id === edytorP.firmaId) || firma}
          logo={logo}
          onChange={setEdytorP}
          onClose={() => setEdytorP(null)}
          onSave={(p) => {
            const nowy = !b.protokoly.some((x) => x.id === p.id)
            upsert('protokoly', { ...p, numer: nowy ? kolejnyNumer('PO') : p.numer })
            setEdytorP(null)
            push('Protokół zapisany')
          }}
        />
      )}

      {edytorK && (
        <KPEditor
          draft={edytorK}
          klienci={b.klienci}
          firma={b.firmy.find((x) => x.id === edytorK.firmaId) || firma}
          logo={logo}
          onChange={setEdytorK}
          onClose={() => setEdytorK(null)}
          onSave={(kp) => {
            const nowy = !b.kp.some((x) => x.id === kp.id)
            upsert('kp', {
              ...kp,
              numer: nowy ? kolejnyNumer('KP') : kp.numer,
              slownie: kwotaSlownie(kp.kwota),
            })
            setEdytorK(null)
            push('Dowód KP zapisany')
          }}
        />
      )}

      {confirmNode}
    </div>
  )
}

// ================= Zakładka =================
function TabBtn({
  active,
  onClick,
  icon,
  children,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-[14px] font-medium transition',
        active
          ? 'border-brand-300 bg-brand-50 text-brand-700'
          : 'border-white/10 bg-white/[0.03] text-stone-600 hover:bg-stone-50',
      )}
    >
      {icon}
      {children}
    </button>
  )
}

// ================= Edytor protokołu =================
function ProtokolEditor({
  draft,
  klienci,
  firma,
  logo,
  onChange,
  onClose,
  onSave,
}: {
  draft: Protokol
  klienci: Klient[]
  firma: Firma
  logo?: string
  onChange: (p: Protokol) => void
  onClose: () => void
  onSave: (p: Protokol) => void
}) {
  const [sigOpen, setSigOpen] = useState(false)
  const klauzula = useStore((s) => s.baza.ustawienia.klauzulaPodpis)
  const set = <K extends keyof Protokol>(k: K, v: Protokol[K]) => onChange({ ...draft, [k]: v })

  const wybierzKlienta = (id: string) => {
    if (!id) {
      onChange({ ...draft, klientId: undefined })
      return
    }
    const k = klienci.find((x) => x.id === id)
    onChange({
      ...draft,
      klientId: id,
      klientNazwa: k ? klientNazwa(k) : draft.klientNazwa,
      klientAdres: k ? klientAdres(k) : draft.klientAdres,
      klientTelefon: k?.telefon ?? draft.klientTelefon,
    })
  }

  const nazwaKlienta = draft.klientNazwa || klientNazwa(klienci.find((k) => k.id === draft.klientId))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Protokół odbioru · ${draft.numer}`}
      size="lg"
      footer={
        <>
          <PrintSendBar
            size="sm"
            getPrintNode={() => <ProtokolDoc p={draft} firma={firma} logoDataUrl={logo} />}
            share={{
              title: `Protokół odbioru ${draft.numer}`,
              text: `Protokół odbioru ${draft.numer} – ${nazwaKlienta}. Data: ${fmtDate(draft.data)}.`,
              phone: draft.klientTelefon,
            }}
          />
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)}>
            Zapisz protokół
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Klient z bazy (opcjonalnie)">
          <Select value={draft.klientId || ''} onChange={(e) => wybierzKlienta(e.target.value)}>
            <option value="">– wpisz dane ręcznie –</option>
            {klienci.map((k) => (
              <option key={k.id} value={k.id}>
                {klientNazwa(k)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Klient (nazwa)">
            <Input
              value={draft.klientNazwa || ''}
              onChange={(e) => set('klientNazwa', e.target.value)}
              placeholder="Imię i nazwisko / firma"
            />
          </Field>
          <Field label="Telefon">
            <Input
              value={draft.klientTelefon || ''}
              onChange={(e) => set('klientTelefon', e.target.value)}
              placeholder="np. 600 100 200"
            />
          </Field>
        </div>

        <Field label="Adres">
          <Input
            value={draft.klientAdres || ''}
            onChange={(e) => set('klientAdres', e.target.value)}
            placeholder="ul. Przykładowa 1, 00-000 Miasto"
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Numer zamówienia">
            <Input
              value={draft.numerZamowienia || ''}
              onChange={(e) => set('numerZamowienia', e.target.value)}
              placeholder="np. ZL 12/2026"
            />
          </Field>
          <Field label="Data odbioru">
            <Input type="date" value={draft.data || ''} onChange={(e) => set('data', e.target.value)} />
          </Field>
        </div>

        <Field label="Odebrane elementy">
          <Textarea
            value={draft.odebraneElementy || ''}
            onChange={(e) => set('odebraneElementy', e.target.value)}
            rows={3}
            placeholder="np. Blat kuchenny z granitu Steel Grey (2 szt.), parapety 3 szt…"
          />
        </Field>

        <Field label="Uwagi">
          <Textarea
            value={draft.uwagi || ''}
            onChange={(e) => set('uwagi', e.target.value)}
            rows={2}
            placeholder="Uwagi do odbioru (opcjonalnie)"
          />
        </Field>

        <div>
          <span className="label">Podpis klienta</span>
          <SignatureField
            sig={draft.podpisKlienta}
            onSign={() => setSigOpen(true)}
            label="Czytelny podpis klienta"
            rola="Klient"
          />
        </div>
      </div>

      <SignatureModal
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        onSave={(sig: Signature) => set('podpisKlienta', sig)}
        domyslnyPodpisujacy={nazwaKlienta}
        rola="Klient"
        dokumentId={draft.id}
        klauzula={klauzula}
      />
    </Modal>
  )
}

// ================= Edytor KP =================
function KPEditor({
  draft,
  klienci,
  firma,
  logo,
  onChange,
  onClose,
  onSave,
}: {
  draft: KP
  klienci: Klient[]
  firma: Firma
  logo?: string
  onChange: (kp: KP) => void
  onClose: () => void
  onSave: (kp: KP) => void
}) {
  const [sigOpen, setSigOpen] = useState(false)
  const [kwotaTxt, setKwotaTxt] = useState(draft.kwota ? String(draft.kwota).replace('.', ',') : '')
  const klauzula = useStore((s) => s.baza.ustawienia.klauzulaPodpis)
  const set = <K extends keyof KP>(k: K, v: KP[K]) => onChange({ ...draft, [k]: v })

  const wybierzKlienta = (id: string) => {
    if (!id) {
      onChange({ ...draft, klientId: undefined })
      return
    }
    const k = klienci.find((x) => x.id === id)
    onChange({ ...draft, klientId: id, odKogo: k ? klientNazwa(k) : draft.odKogo })
  }

  const slownie = kwotaSlownie(draft.kwota)
  const nazwaWplacajacego = draft.odKogo || klientNazwa(klienci.find((k) => k.id === draft.klientId))

  return (
    <Modal
      open
      onClose={onClose}
      title={`Kasowy dowód wpłaty · ${draft.numer}`}
      size="lg"
      footer={
        <>
          <PrintSendBar
            size="sm"
            getPrintNode={() => <KPDoc kp={{ ...draft, slownie }} firma={firma} logoDataUrl={logo} />}
            share={{
              title: `Dowód KP ${draft.numer}`,
              text: `Dowód wpłaty KP ${draft.numer} na kwotę ${fmtPLN(draft.kwota)} od: ${nazwaWplacajacego}. Data: ${fmtDate(draft.data)}.`,
            }}
          />
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={() => onSave(draft)}>
            Zapisz KP
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Klient z bazy (opcjonalnie)">
          <Select value={draft.klientId || ''} onChange={(e) => wybierzKlienta(e.target.value)}>
            <option value="">– wpisz dane ręcznie –</option>
            {klienci.map((k) => (
              <option key={k.id} value={k.id}>
                {klientNazwa(k)}
              </option>
            ))}
          </Select>
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Od kogo (wpłacający)">
            <Input
              value={draft.odKogo || ''}
              onChange={(e) => set('odKogo', e.target.value)}
              placeholder="Imię i nazwisko / firma"
            />
          </Field>
          <Field label="Data wpłaty">
            <Input type="date" value={draft.data || ''} onChange={(e) => set('data', e.target.value)} />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Kwota (zł)" hint={draft.kwota > 0 ? slownie : undefined}>
            <Input
              inputMode="decimal"
              value={kwotaTxt}
              onChange={(e) => {
                setKwotaTxt(e.target.value)
                set('kwota', parseNum(e.target.value))
              }}
              placeholder="0,00"
            />
          </Field>
          <Field label="Tytułem">
            <Input
              value={draft.tytul || ''}
              onChange={(e) => set('tytul', e.target.value)}
              placeholder="np. zaliczka do zlecenia ZL 12/2026"
            />
          </Field>
        </div>

        <div>
          <span className="label">Podpis przyjmującego</span>
          <SignatureField
            sig={draft.podpisPrzyjmujacy}
            onSign={() => setSigOpen(true)}
            label="Podpis osoby przyjmującej wpłatę"
            rola="Przyjął"
          />
        </div>
      </div>

      <SignatureModal
        open={sigOpen}
        onClose={() => setSigOpen(false)}
        onSave={(sig: Signature) => set('podpisPrzyjmujacy', sig)}
        domyslnyPodpisujacy={firma.wlasciciel}
        rola="Przyjął"
        dokumentId={draft.id}
        klauzula={klauzula}
      />
    </Modal>
  )
}
