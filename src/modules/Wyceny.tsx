import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Calculator,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
  FileSignature,
  ClipboardList,
  AlertTriangle,
  Search,
  Package,
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
  Checkbox,
  Badge,
  EmptyState,
  Stat,
  useToast,
  useConfirm,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { SignatureField, SignatureModal } from '../components/SignaturePad'
import { WycenaDoc } from '../documents/Wycena'
import { uid } from '../lib/id'
import { fmtPLN, fmtDate, nowISO, today, podsumuj, pozycjaNetto, parseNum } from '../lib/format'
import { klientNazwa, klientAdres, wycenaStatusInfo, domyslneEtapyZlecenia } from '../lib/helpers'
import type { Wycena, Pozycja, Produkt, VatRate, Unit, WycenaStatus, Umowa, Zlecenie, Signature } from '../lib/types'

// ---------- Stale pomocnicze ----------
const JEDNOSTKI: Unit[] = ['m²', 'mb', 'szt', 'kpl', 'usł', 'h', 'godz']
const STATUSY: WycenaStatus[] = ['szkic', 'wyslana', 'zaakceptowana', 'odrzucona', 'zrealizowana']

// Domyslne pozycje przy nowej wycenie: Kamien, Obrobki, Pomiar, Montaz, Transport (kategoria 'usluga')
function domyslnePozycje(produkty: Produkt[]): Pozycja[] {
  const klucze = ['kamień', 'obrób', 'pomiar', 'montaż', 'transport']
  const wybrane: Produkt[] = []
  for (const k of klucze) {
    const p = produkty.find((x) => x.kategoria === 'usluga' && x.nazwa.toLowerCase().includes(k))
    if (p) wybrane.push(p)
  }
  if (wybrane.length === 0) {
    return ['Kamień', 'Obróbki kamieniarskie', 'Pomiar z natury / szablony', 'Montaż', 'Transport'].map((n, i) => ({
      id: uid('poz'),
      lp: i + 1,
      nazwa: n,
      jednostka: 'usł' as Unit,
      ilosc: 1,
      cenaNetto: 0,
      vat: 23 as VatRate,
    }))
  }
  return wybrane.map((p, i) => ({
    id: uid('poz'),
    lp: i + 1,
    nazwa: p.nazwa,
    jednostka: p.jednostka,
    ilosc: 1,
    cenaNetto: p.cenaNetto,
    vat: p.vat,
  }))
}

// Ryzyko podatkowe: 8% na blacie zamiast standardowych 23%
function ryzyko8(p: Pozycja): boolean {
  return p.vat === 8 && /blat/i.test(p.nazwa)
}

// ============================================================================
// Wejscie modulu – lista lub edytor (route /wyceny/:id)
// ============================================================================
export default function Wyceny() {
  const { id } = useParams()
  if (id) return <Edytor id={id} key={id} />
  return <Lista />
}

// ---------------------------------------------------------------------------
// LISTA
// ---------------------------------------------------------------------------
function Lista() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const navigate = useNavigate()
  const [szukaj, setSzukaj] = useState('')

  const nowa = () => {
    const w: Wycena = {
      id: uid('wyc'),
      numer: kolejnyNumer('WYC'),
      firmaId: firma.id,
      pozycje: domyslnePozycje(b.produkty),
      domyslnyVat: firma.domyslnyVat,
      osobaFizyczna: true,
      warunkiPlatnosci: 'Zaliczka przy zamówieniu, dopłata przed montażem.',
      zaliczka: '',
      doplata: '',
      status: 'szkic',
      zalaczniki: [],
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    }
    upsert('wyceny', w)
    navigate(`/wyceny/${w.id}`)
  }

  const q = szukaj.trim().toLowerCase()
  const lista = b.wyceny
    .slice()
    .sort((a, c) => c.zaktualizowano.localeCompare(a.zaktualizowano))
    .filter((w) => !q || [w.numer, w.klientNazwa, w.nazwaMaterialu].filter(Boolean).join(' ').toLowerCase().includes(q))

  const wartoscRazem = b.wyceny
    .filter((w) => w.status !== 'odrzucona')
    .reduce((s, w) => s + podsumuj(w.pozycje).brutto, 0)
  const zaakceptowane = b.wyceny.filter((w) => w.status === 'zaakceptowana' || w.status === 'zrealizowana').length

  return (
    <div>
      <PageHeader
        title="Oferty i wyceny"
        subtitle="Wstępne wyceny prac kamieniarskich"
        icon={<Calculator size={22} />}
        actions={
          <button className="btn-primary" onClick={nowa}>
            <Plus size={17} /> Nowa wycena
          </button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <Stat
          label="Wycen łącznie"
          value={b.wyceny.length}
          icon={<Calculator size={18} />}
          sub={`${zaakceptowane} zaakceptowanych`}
        />
        <Stat label="Wartość ofert" value={fmtPLN(wartoscRazem)} tone="green" sub="brutto, bez odrzuconych" />
        <Stat label="Materiały w bazie" value={b.produkty.length} icon={<Package size={18} />} sub="katalog / cennik" />
      </div>

      <Card>
        <CardBody>
          <div className="relative mb-4">
            <Search
              size={17}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400"
            />
            <input
              value={szukaj}
              onChange={(e) => setSzukaj(e.target.value)}
              placeholder="Szukaj po numerze, kliencie, materiale…"
              className="input pl-10"
            />
          </div>

          {lista.length === 0 ? (
            <EmptyState
              icon={<Calculator size={26} />}
              title="Brak wycen"
              desc="Utwórz pierwszą wstępną wycenę prac kamieniarskich."
              action={
                <button className="btn-primary" onClick={nowa}>
                  <Plus size={17} /> Nowa wycena
                </button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr>
                    <th className="th text-left">Numer</th>
                    <th className="th text-left">Klient</th>
                    <th className="th text-left">Materiał</th>
                    <th className="th text-right">Wartość brutto</th>
                    <th className="th text-left">Zaktualizowano</th>
                    <th className="th text-left">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {lista.map((w) => {
                    const si = wycenaStatusInfo(w.status)
                    return (
                      <tr key={w.id} className="row-hover cursor-pointer" onClick={() => navigate(`/wyceny/${w.id}`)}>
                        <td className="td font-medium text-ink">{w.numer}</td>
                        <td className="td">{w.klientNazwa || <span className="text-stone-400">–</span>}</td>
                        <td className="td text-stone-500">{w.nazwaMaterialu || '–'}</td>
                        <td className="td text-right font-semibold">{fmtPLN(podsumuj(w.pozycje).brutto)}</td>
                        <td className="td text-stone-500">{fmtDate(w.zaktualizowano)}</td>
                        <td className="td">
                          <Badge tone={si.tone as any}>{si.label}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------------------
// EDYTOR
// ---------------------------------------------------------------------------
function Edytor({ id }: { id: string }) {
  const rec = useStore((s) => s.baza.wyceny.find((w) => w.id === id))
  const navigate = useNavigate()

  if (!rec) {
    return (
      <div>
        <PageHeader title="Wycena" subtitle="Nie znaleziono" icon={<Calculator size={22} />} />
        <EmptyState
          icon={<Calculator size={26} />}
          title="Nie znaleziono wyceny"
          desc="Ta wycena mogła zostać usunięta."
          action={
            <button className="btn-outline" onClick={() => navigate('/wyceny')}>
              <ArrowLeft size={16} /> Wróć do listy
            </button>
          }
        />
      </div>
    )
  }
  return <EdytorInner rec={rec} />
}

function EdytorInner({ rec }: { rec: Wycena }) {
  const b = useStore((s) => s.baza)
  const firmy = useStore((s) => s.baza.firmy)
  const aktywna = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const navigate = useNavigate()
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [w, setW] = useState<Wycena>(rec)
  const [uwagi, setUwagi] = useState<string[]>(() => b.ustawienia.standardoweUwagiWyceny.slice())
  const [sigTarget, setSigTarget] = useState<null | 'klient' | 'firma'>(null)

  // Autozapis do bazy przy kazdej zmianie (offline-first)
  useEffect(() => {
    upsert('wyceny', { ...w, zaktualizowano: nowISO() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w])

  const firma = firmy.find((f) => f.id === w.firmaId) || aktywna
  const sum = podsumuj(w.pozycje)
  const uwagiDoc = uwagi.map((u) => u.trim()).filter(Boolean)

  // ---- Pomocnicze aktualizatory ----
  const set = <K extends keyof Wycena>(key: K, val: Wycena[K]) => setW((p) => ({ ...p, [key]: val }) as Wycena)

  const setPoz = (pid: string, patch: Partial<Pozycja>) =>
    setW((p) => ({ ...p, pozycje: p.pozycje.map((x) => (x.id === pid ? { ...x, ...patch } : x)) }))

  const addPoz = (prod?: Produkt) =>
    setW((p) => ({
      ...p,
      pozycje: [
        ...p.pozycje,
        {
          id: uid('poz'),
          lp: p.pozycje.length + 1,
          nazwa: prod?.nazwa || '',
          jednostka: prod?.jednostka || ('m²' as Unit),
          ilosc: 1,
          cenaNetto: prod?.cenaNetto || 0,
          vat: prod?.vat || p.domyslnyVat,
        },
      ],
    }))

  const delPoz = (pid: string) =>
    setW((p) => ({ ...p, pozycje: p.pozycje.filter((x) => x.id !== pid).map((x, i) => ({ ...x, lp: i + 1 })) }))

  const wybierzKlienta = (kid: string) => {
    if (!kid) {
      setW((p) => ({ ...p, klientId: undefined }))
      return
    }
    const k = b.klienci.find((x) => x.id === kid)
    if (!k) return
    setW((p) => ({
      ...p,
      klientId: k.id,
      klientNazwa: klientNazwa(k),
      klientAdres: klientAdres(k),
      klientTelefon: k.telefon,
      klientEmail: k.email,
      osobaFizyczna: k.typ === 'osoba',
    }))
  }

  const onSign = (sig: Signature) => {
    setW((p) => (sigTarget === 'klient' ? { ...p, podpisKlienta: sig } : { ...p, podpisFirmy: sig }))
  }

  // ---- Akcje dokumentowe ----
  const zapiszRecznie = () => {
    upsert('wyceny', { ...w, zaktualizowano: nowISO() })
    push('Wycena zapisana', 'ok')
  }

  const usun = async () => {
    if (!(await confirm(`Usunąć wycenę ${w.numer}? Tej operacji nie można cofnąć.`))) return
    remove('wyceny', w.id)
    push('Wycena usunięta', 'info')
    navigate('/wyceny')
  }

  const zrobUmowe = () => {
    upsert('wyceny', { ...w, zaktualizowano: nowISO() })
    const um: Umowa = {
      id: uid('um'),
      numer: kolejnyNumer('UM'),
      typ: w.osobaFizyczna ? 'dzielo_8' : 'dzielo_23',
      firmaId: w.firmaId,
      klientId: w.klientId,
      wycenaId: w.id,
      miejscowoscZawarcia: firma.miasto,
      dataZawarcia: today(),
      zamawiajacyNazwa: w.klientNazwa,
      zamawiajacyAdres: w.klientAdres,
      zamawiajacyTelefon: w.klientTelefon,
      zamawiajacyEmail: w.klientEmail,
      adresRealizacji: w.miejsceAdres || w.klientAdres,
      przedmiot: [w.zakresPrac, w.nazwaMaterialu].filter(Boolean).join(' – '),
      wynagrodzenieBrutto: sum.brutto,
      pola: {},
      status: 'szkic',
      zalaczniki: [],
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    }
    upsert('umowy', um)
    push(`Utworzono umowę ${um.numer}`, 'ok')
    navigate(`/umowy/${um.id}`)
  }

  const utworzZlecenie = () => {
    upsert('wyceny', { ...w, zaktualizowano: nowISO() })
    const z: Zlecenie = {
      id: uid('zl'),
      numer: kolejnyNumer('ZL'),
      firmaId: w.firmaId,
      klientId: w.klientId,
      tytul: [w.nazwaMaterialu, w.klientNazwa].filter(Boolean).join(' – ') || `Zlecenie ${w.numer}`,
      adres: w.miejsceAdres || w.klientAdres,
      osoby: {},
      etap: 'wycena',
      etapy: domyslneEtapyZlecenia(),
      wartoscNetto: sum.netto,
      wartoscBrutto: sum.brutto,
      wycenaId: w.id,
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    }
    upsert('zlecenia', z)
    push(`Utworzono zlecenie ${z.numer}`, 'ok')
    navigate(`/zlecenia/${z.id}`)
  }

  const shareText = `Dzień dobry,\n\nw załączeniu wstępna wycena prac kamieniarskich ${w.numer}${
    w.nazwaMaterialu ? ` (${w.nazwaMaterialu})` : ''
  } na kwotę ${fmtPLN(sum.brutto)} brutto.\n\nPozdrawiam,\n${firma.wlasciciel}\n${firma.telefon}`

  return (
    <div>
      {confirmNode}
      <PageHeader
        title={`Wycena ${w.numer}`}
        subtitle={w.klientNazwa || 'Wstępna wycena prac kamieniarskich'}
        icon={<Calculator size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn-ghost" onClick={() => navigate('/wyceny')}>
              <ArrowLeft size={16} /> Lista
            </button>
            <button className="btn-outline" onClick={zapiszRecznie}>
              <Save size={16} /> Zapisz
            </button>
            <PrintSendBar
              getPrintNode={() => (
                <WycenaDoc w={w} firma={firma} uwagi={uwagiDoc} logoDataUrl={b.ustawienia.logoDataUrl} />
              )}
              share={{ title: `Wstępna wycena ${w.numer}`, text: shareText, to: w.klientEmail, phone: w.klientTelefon }}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Dane klienta */}
          <SectionCard title="Dane klienta" icon={<Calculator size={16} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Wybierz z bazy klientów" className="sm:col-span-2">
                <Select value={w.klientId || ''} onChange={(e) => wybierzKlienta(e.target.value)}>
                  <option value="">– wpis ręczny / brak –</option>
                  {b.klienci.map((k) => (
                    <option key={k.id} value={k.id}>
                      {klientNazwa(k)} {k.telefon ? `· ${k.telefon}` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nazwa / imię i nazwisko" className="sm:col-span-2">
                <Input
                  value={w.klientNazwa || ''}
                  onChange={(e) => set('klientNazwa', e.target.value)}
                  placeholder="np. Jan Kowalski"
                />
              </Field>
              <Field label="Adres" className="sm:col-span-2">
                <Input value={w.klientAdres || ''} onChange={(e) => set('klientAdres', e.target.value)} />
              </Field>
              <Field label="Telefon">
                <Input value={w.klientTelefon || ''} onChange={(e) => set('klientTelefon', e.target.value)} />
              </Field>
              <Field label="E-mail">
                <Input value={w.klientEmail || ''} onChange={(e) => set('klientEmail', e.target.value)} />
              </Field>
              <div className="sm:col-span-2">
                <Toggle
                  checked={w.osobaFizyczna}
                  onChange={(v) => set('osobaFizyczna', v)}
                  label="Umowa na osobę fizyczną"
                />
              </div>
            </div>
          </SectionCard>

          {/* Miejsce realizacji */}
          <SectionCard title="Miejsce realizacji">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Adres realizacji" className="sm:col-span-2">
                <Input value={w.miejsceAdres || ''} onChange={(e) => set('miejsceAdres', e.target.value)} />
              </Field>
              <Field label="Piętro / lokal">
                <Input value={w.miejscePietro || ''} onChange={(e) => set('miejscePietro', e.target.value)} />
              </Field>
              <Field label="Uwagi do miejsca">
                <Input value={w.miejsceUwagi || ''} onChange={(e) => set('miejsceUwagi', e.target.value)} />
              </Field>
            </div>
          </SectionCard>

          {/* Zakres i material */}
          <SectionCard title="Zakres prac i materiał">
            <div className="grid gap-3">
              <Field label="Zakres prac">
                <Textarea
                  value={w.zakresPrac || ''}
                  onChange={(e) => set('zakresPrac', e.target.value)}
                  placeholder="np. Blat kuchenny + wyspa, parapety wewnętrzne…"
                />
              </Field>
              <Field label="Nazwa materiału">
                <Input
                  value={w.nazwaMaterialu || ''}
                  onChange={(e) => set('nazwaMaterialu', e.target.value)}
                  placeholder="np. Granit Steel Grey 3 cm"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Pozycje */}
          <SectionCard
            title="Zestawienie elementów i prac"
            desc="Dodaj z katalogu lub wpisz ręcznie. Wartość liczona automatycznie."
            actions={
              <div className="flex items-center gap-2">
                <Select
                  value=""
                  onChange={(e) => {
                    const prod = b.produkty.find((x) => x.id === e.target.value)
                    if (prod) addPoz(prod)
                    e.currentTarget.value = ''
                  }}
                  className="!w-52"
                >
                  <option value="">+ z katalogu…</option>
                  {b.produkty
                    .filter((p) => p.aktywny)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nazwa}
                      </option>
                    ))}
                </Select>
                <button className="btn-outline btn-sm" onClick={() => addPoz()}>
                  <Plus size={15} /> Pozycja
                </button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full text-[13.5px]">
                <thead>
                  <tr>
                    <th className="th text-left" style={{ minWidth: 200 }}>
                      Nazwa / opis
                    </th>
                    <th className="th text-right" style={{ width: 80 }}>
                      Ilość
                    </th>
                    <th className="th text-left" style={{ width: 90 }}>
                      Jedn.
                    </th>
                    <th className="th text-right" style={{ width: 120 }}>
                      Cena netto
                    </th>
                    <th className="th text-left" style={{ width: 90 }}>
                      VAT
                    </th>
                    <th className="th text-right" style={{ width: 120 }}>
                      Wartość netto
                    </th>
                    <th className="th" style={{ width: 40 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {w.pozycje.map((p) => (
                    <tr key={p.id} className="align-top">
                      <td className="td">
                        <Input
                          value={p.nazwa}
                          onChange={(e) => setPoz(p.id, { nazwa: e.target.value })}
                          placeholder="Nazwa pozycji"
                        />
                      </td>
                      <td className="td">
                        <Input
                          type="number"
                          className="text-right"
                          value={p.ilosc}
                          onChange={(e) => setPoz(p.id, { ilosc: parseNum(e.target.value) })}
                        />
                      </td>
                      <td className="td">
                        <Select
                          value={p.jednostka}
                          onChange={(e) => setPoz(p.id, { jednostka: e.target.value as Unit })}
                        >
                          {JEDNOSTKI.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </Select>
                      </td>
                      <td className="td">
                        <Input
                          type="number"
                          className="text-right"
                          value={p.cenaNetto}
                          onChange={(e) => setPoz(p.id, { cenaNetto: parseNum(e.target.value) })}
                        />
                      </td>
                      <td className="td">
                        <div className="flex items-center gap-1">
                          <Select
                            value={p.vat}
                            onChange={(e) => setPoz(p.id, { vat: Number(e.target.value) as VatRate })}
                          >
                            <option value={23}>23%</option>
                            <option value={8}>8%</option>
                          </Select>
                          {ryzyko8(p) && (
                            <span
                              title="Ryzyko podatkowe: stawka 8% na blacie. Standardowo blaty kuchenne opodatkowane są 23% (8% dotyczy budownictwa objętego społecznym programem mieszkaniowym)."
                              className="text-amber-500"
                            >
                              <AlertTriangle size={16} />
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="td text-right font-medium">{fmtPLN(pozycjaNetto(p))}</td>
                      <td className="td text-center">
                        <button
                          className="btn-ghost !px-1.5 text-stone-400 hover:text-red-600"
                          onClick={() => delPoz(p.id)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {w.pozycje.length === 0 && (
                    <tr>
                      <td className="td text-center text-stone-400" colSpan={7}>
                        Brak pozycji – dodaj z katalogu lub ręcznie.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {w.pozycje.some(ryzyko8) && (
              <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-[12.5px] text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                <span>
                  Zastosowano stawkę <b>8% na blacie</b>. To potencjalne ryzyko podatkowe – standardem dla blatów
                  kuchennych jest <b>23%</b>. Stawkę 8% stosuj wyłącznie dla budownictwa objętego społecznym programem
                  mieszkaniowym.
                </span>
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <div className="w-full max-w-xs space-y-1.5 text-[14px]">
                <div className="flex justify-between text-stone-500">
                  <span>Razem netto</span>
                  <span className="font-medium text-ink">{fmtPLN(sum.netto)}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Podatek VAT</span>
                  <span className="font-medium text-ink">{fmtPLN(sum.vat)}</span>
                </div>
                <div className="flex justify-between border-t border-stone-200 pt-1.5 text-[16px] font-semibold">
                  <span>Razem brutto</span>
                  <span className="text-brand-700">{fmtPLN(sum.brutto)}</span>
                </div>
              </div>
            </div>
          </SectionCard>

          {/* Warunki */}
          <SectionCard title="Warunki wyceny">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Warunki płatności" className="sm:col-span-2">
                <Input value={w.warunkiPlatnosci || ''} onChange={(e) => set('warunkiPlatnosci', e.target.value)} />
              </Field>
              <Field label="Zaliczka">
                <Input
                  value={w.zaliczka || ''}
                  onChange={(e) => set('zaliczka', e.target.value)}
                  placeholder="np. 30% przy zamówieniu"
                />
              </Field>
              <Field label="Dopłata">
                <Input
                  value={w.doplata || ''}
                  onChange={(e) => set('doplata', e.target.value)}
                  placeholder="np. przed montażem"
                />
              </Field>
              <Field label="Ważność wyceny">
                <Input type="date" value={w.waznosc || ''} onChange={(e) => set('waznosc', e.target.value)} />
              </Field>
              <Field label="Uwagi (do warunków)">
                <Input value={w.uwagi || ''} onChange={(e) => set('uwagi', e.target.value)} />
              </Field>
            </div>
          </SectionCard>

          {/* Standardowe uwagi */}
          <SectionCard
            title="Dodatkowe informacje / standardowe uwagi"
            desc="Każda linia to osobny punkt na wydruku. Możesz edytować dla tej wyceny."
          >
            <Textarea rows={7} value={uwagi.join('\n')} onChange={(e) => setUwagi(e.target.value.split('\n'))} />
            <div className="mt-2">
              <button
                className="btn-ghost btn-sm"
                onClick={() => setUwagi(b.ustawienia.standardoweUwagiWyceny.slice())}
              >
                Przywróć standardowe uwagi
              </button>
            </div>
          </SectionCard>

          {/* Przygotowanie pod montaz */}
          <SectionCard title="Przygotowanie pod montaż (po stronie Klienta)">
            <div className="space-y-3">
              <Checkbox
                checked={!!w.przygBlaty}
                onChange={(v) => set('przygBlaty', v)}
                label="Blaty / podłoża równe i wypoziomowane"
              />
              <Checkbox
                checked={!!w.przygWodaPrad}
                onChange={(v) => set('przygWodaPrad', v)}
                label="Dostęp do wody i prądu"
              />
              <Checkbox
                checked={!!w.przygDojazd}
                onChange={(v) => set('przygDojazd', v)}
                label="Swobodny dojazd i wniesienie materiału"
              />
              <Field label="Inne wymagania">
                <Input value={w.przygInne || ''} onChange={(e) => set('przygInne', e.target.value)} />
              </Field>
            </div>
          </SectionCard>
        </div>

        {/* Panel boczny */}
        <div className="space-y-6">
          <SectionCard title="Status i akcje">
            <Field label="Status wyceny">
              <Select value={w.status} onChange={(e) => set('status', e.target.value as WycenaStatus)}>
                {STATUSY.map((s) => (
                  <option key={s} value={s}>
                    {wycenaStatusInfo(s).label}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-4 space-y-2">
              <button className="btn-primary w-full" onClick={zrobUmowe}>
                <FileSignature size={16} /> Zrób umowę
              </button>
              <button className="btn-outline w-full" onClick={utworzZlecenie}>
                <ClipboardList size={16} /> Utwórz zlecenie
              </button>
              <button className="btn-danger w-full" onClick={usun}>
                <Trash2 size={16} /> Usuń wycenę
              </button>
            </div>
          </SectionCard>

          <SectionCard title="Podpis i akceptacja">
            <div className="space-y-3">
              <SignatureField
                sig={w.podpisKlienta}
                onSign={() => setSigTarget('klient')}
                label="Podpis Klienta"
                rola="Klient"
              />
              <SignatureField
                sig={w.podpisFirmy}
                onSign={() => setSigTarget('firma')}
                label="Podpis / pieczęć firmy"
                rola="Wykonawca"
              />
            </div>
          </SectionCard>

          <SectionCard title="Podgląd dokumentu" desc="Wersja do druku / wysyłki (DRUKUJ i WYŚLIJ powyżej).">
            <div className="overflow-auto rounded-xl border border-stone-200 bg-stone-50 p-2">
              <div style={{ transform: 'scale(0.42)', transformOrigin: 'top left', width: '238%' }}>
                <WycenaDoc w={w} firma={firma} uwagi={uwagiDoc} logoDataUrl={b.ustawienia.logoDataUrl} />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      <SignatureModal
        open={sigTarget !== null}
        onClose={() => setSigTarget(null)}
        onSave={onSign}
        rola={sigTarget === 'klient' ? 'Klient' : 'Wykonawca'}
        domyslnyPodpisujacy={sigTarget === 'klient' ? w.klientNazwa || '' : firma.wlasciciel}
        dokumentId={w.id}
        klauzula={b.ustawienia.klauzulaPodpis}
      />
    </div>
  )
}
