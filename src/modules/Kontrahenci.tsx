import { useMemo, useState, useEffect } from 'react'
import { Handshake, Plus, Pencil, Trash2, Phone, Mail, Building2, Coins, Percent, Check } from 'lucide-react'
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
  Stat,
  Modal,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { DocSheet, DocTitle } from '../documents/DocShell'
import { KONTRAHENT_TYPY } from '../lib/helpers'
import { fmtPLN, fmtDate, fmtNIP, parseNum, today, nowISO, validNIP } from '../lib/format'
import { uid } from '../lib/id'
import type { Firma, Kontrahent, KontrahentTyp, Prowizja } from '../lib/types'

// Typy kontrahentow ktore rozliczaja sie prowizyjnie
const PROWIZJA_TYPY: KontrahentTyp[] = ['projektant', 'deweloper', 'sprzedawca']
const maProwizje = (t: KontrahentTyp) => PROWIZJA_TYPY.includes(t)

function pustyKontrahent(typ: KontrahentTyp): Kontrahent {
  return {
    id: uid('kon'),
    typ,
    nazwa: '',
    firma: '',
    telefon: '',
    email: '',
    specjalizacja: '',
    branza: '',
    nip: '',
    adres: '',
    dataKontaktu: today(),
    stawkaProwizji: undefined,
    prowizje: [],
    notatki: '',
    aktywny: true,
    utworzono: nowISO(),
  }
}

export default function Kontrahenci() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [aktywnyTyp, setAktywnyTyp] = useState<KontrahentTyp>('projektant')
  const [szukaj, setSzukaj] = useState('')
  const [edytowany, setEdytowany] = useState<Kontrahent | null>(null)

  const logoDataUrl = b.ustawienia.logoDataUrl

  const wszyscyTypu = useMemo(() => b.kontrahenci.filter((k) => k.typ === aktywnyTyp), [b.kontrahenci, aktywnyTyp])

  const lista = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    const filtered = q
      ? wszyscyTypu.filter((k) =>
          [k.nazwa, k.firma, k.telefon, k.email, k.specjalizacja, k.branza]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .includes(q),
        )
      : wszyscyTypu
    return filtered.slice().sort((a, c) => Number(c.aktywny) - Number(a.aktywny) || a.nazwa.localeCompare(c.nazwa))
  }, [wszyscyTypu, szukaj])

  const typInfo = KONTRAHENT_TYPY.find((t) => t.typ === aktywnyTyp) || KONTRAHENT_TYPY[0]

  const zapisz = (k: Kontrahent) => {
    if (!k.nazwa.trim()) {
      push('Podaj nazwę / imię i nazwisko kontrahenta', 'err')
      return
    }
    upsert('kontrahenci', k)
    setEdytowany(null)
    push('Zapisano kontrahenta')
  }

  const usun = async (k: Kontrahent) => {
    if (await confirm(`Usunąć kontrahenta „${k.nazwa}”? Operacja jest nieodwracalna.`)) {
      remove('kontrahenci', k.id)
      push('Usunięto kontrahenta', 'info')
    }
  }

  // Statystyki prowizji dla aktywnej kategorii
  const wszystkieProwizje = wszyscyTypu.flatMap((k) => k.prowizje)
  const sumaNaleznych = wszystkieProwizje.filter((p) => !p.wyplacona).reduce((s, p) => s + (p.kwota || 0), 0)
  const sumaWyplaconych = wszystkieProwizje.filter((p) => p.wyplacona).reduce((s, p) => s + (p.kwota || 0), 0)

  return (
    <div>
      <PageHeader
        title="Kontrahenci"
        subtitle="Projektanci, stolarze, wykonawcy, deweloperzy i partnerzy handlowi"
        icon={<Handshake size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setEdytowany(pustyKontrahent(aktywnyTyp))}>
            <Plus size={17} /> Dodaj kontrahenta
          </button>
        }
      />

      {/* Taby wg typu */}
      <div className="mb-5 flex flex-wrap gap-2">
        {KONTRAHENT_TYPY.map((t) => {
          const n = b.kontrahenci.filter((k) => k.typ === t.typ).length
          const on = t.typ === aktywnyTyp
          return (
            <button
              key={t.typ}
              onClick={() => setAktywnyTyp(t.typ)}
              className={cx(
                'flex items-center gap-2 rounded-xl border px-3.5 py-2 text-[13.5px] font-medium transition',
                on
                  ? 'border-brand-300 bg-brand-50 text-brand-700'
                  : 'border-white/10 bg-white/[0.03] text-stone-600 hover:border-brand-200',
              )}
            >
              {t.lm}
              <span
                className={cx(
                  'rounded-full px-1.5 py-0.5 text-[11px] font-semibold',
                  on ? 'bg-white/10 text-white' : 'bg-stone-100 text-stone-500',
                )}
              >
                {n}
              </span>
            </button>
          )
        })}
      </div>

      {/* Statystyki prowizji (tylko dla kategorii prowizyjnych) */}
      {maProwizje(aktywnyTyp) && (
        <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Stat
            label="Kontrahenci"
            value={wszyscyTypu.length}
            icon={<Building2 size={18} />}
            sub={`${wszyscyTypu.filter((k) => k.aktywny).length} aktywnych`}
          />
          <Stat label="Prowizje należne" value={fmtPLN(sumaNaleznych)} icon={<Coins size={18} />} sub="do wypłaty" />
          <Stat
            label="Prowizje wypłacone"
            value={fmtPLN(sumaWyplaconych)}
            tone="green"
            icon={<Check size={18} />}
            sub={`${wszystkieProwizje.length} pozycji łącznie`}
          />
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="w-full max-w-sm">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder={`Szukaj w: ${typInfo.lm}…`} />
        </div>
        <PrintSendBar
          getPrintNode={() => (
            <KontrahenciDoc firma={firma} typNazwa={typInfo.lm} lista={lista} logoDataUrl={logoDataUrl} />
          )}
          share={{
            title: `Kontakty – ${typInfo.lm}`,
            text: lista
              .map((k) => `${k.nazwa}${k.firma ? ` (${k.firma})` : ''} – tel. ${k.telefon || '–'} – ${k.email || '–'}`)
              .join('\n'),
          }}
        />
      </div>

      {/* Lista */}
      {lista.length === 0 ? (
        <EmptyState
          icon={<Handshake size={26} />}
          title={`Brak: ${typInfo.lm}`}
          desc="Dodaj pierwszego kontrahenta tej kategorii, aby prowadzić kontakty i rozliczać prowizje."
          action={
            <button className="btn-primary" onClick={() => setEdytowany(pustyKontrahent(aktywnyTyp))}>
              <Plus size={17} /> Dodaj kontrahenta
            </button>
          }
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {lista.map((k) => (
            <KartaKontrahenta key={k.id} k={k} onEdit={() => setEdytowany(k)} onDelete={() => usun(k)} />
          ))}
        </div>
      )}

      {edytowany && (
        <EdycjaModal key={edytowany.id} poczatek={edytowany} onClose={() => setEdytowany(null)} onSave={zapisz} />
      )}
      {confirmNode}
    </div>
  )
}

// ---------- Karta kontrahenta ----------
function KartaKontrahenta({ k, onEdit, onDelete }: { k: Kontrahent; onEdit: () => void; onDelete: () => void }) {
  const naleznosc = k.prowizje.filter((p) => !p.wyplacona).reduce((s, p) => s + (p.kwota || 0), 0)
  const spec = k.typ === 'wykonawca' ? k.branza : k.specjalizacja
  return (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="truncate text-[15px] font-semibold text-ink">{k.nazwa || 'Bez nazwy'}</h3>
              {!k.aktywny && <Badge tone="stone">nieaktywny</Badge>}
            </div>
            {k.firma && <div className="truncate text-[13px] text-stone-500">{k.firma}</div>}
          </div>
          <div className="flex shrink-0 gap-1">
            <button className="btn-ghost !px-2" title="Edytuj" onClick={onEdit}>
              <Pencil size={16} />
            </button>
            <button className="btn-ghost !px-2 text-red-600" title="Usuń" onClick={onDelete}>
              <Trash2 size={16} />
            </button>
          </div>
        </div>

        <div className="mt-2.5 space-y-1 text-[13px] text-stone-600">
          {k.telefon && (
            <a href={`tel:${k.telefon}`} className="flex items-center gap-2 hover:text-brand-700">
              <Phone size={14} className="text-stone-400" /> {k.telefon}
            </a>
          )}
          {k.email && (
            <a href={`mailto:${k.email}`} className="flex items-center gap-2 truncate hover:text-brand-700">
              <Mail size={14} className="shrink-0 text-stone-400" /> <span className="truncate">{k.email}</span>
            </a>
          )}
          {spec && (
            <div className="flex items-center gap-2 text-stone-500">
              <span className="text-stone-400">•</span> {spec}
            </div>
          )}
        </div>

        {(maProwizje(k.typ) || k.stawkaProwizji) && (
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-stone-100 pt-3">
            {k.stawkaProwizji ? (
              <Badge tone="blue">
                <span className="inline-flex items-center gap-1">
                  <Percent size={11} /> {k.stawkaProwizji}%
                </span>
              </Badge>
            ) : null}
            {k.prowizje.length > 0 && (
              <Badge tone={naleznosc > 0 ? 'amber' : 'green'}>
                {naleznosc > 0 ? `należne: ${fmtPLN(naleznosc)}` : 'rozliczone'}
              </Badge>
            )}
            {k.prowizje.length > 0 && <span className="text-[12px] text-stone-400">{k.prowizje.length} prowizji</span>}
          </div>
        )}
      </CardBody>
    </Card>
  )
}

// ---------- Modal edycji ----------
function EdycjaModal({
  poczatek,
  onClose,
  onSave,
}: {
  poczatek: Kontrahent
  onClose: () => void
  onSave: (k: Kontrahent) => void
}) {
  const [k, setK] = useState<Kontrahent>(poczatek)
  const set = <F extends keyof Kontrahent>(pole: F, wartosc: Kontrahent[F]) => setK((s) => ({ ...s, [pole]: wartosc }))

  const nipOk = !k.nip || validNIP(k.nip)
  const nowy = poczatek.nazwa === ''
  const pokazProwizje = maProwizje(k.typ)

  // --- operacje na prowizjach ---
  const dodajProwizje = () => {
    const p: Prowizja = { id: uid('prw'), kwota: 0, numerZlecenia: '', dataNaliczenia: today(), wyplacona: false }
    setK((s) => ({ ...s, prowizje: [...s.prowizje, p] }))
  }
  const zmienProwizje = (id: string, patch: Partial<Prowizja>) =>
    setK((s) => ({ ...s, prowizje: s.prowizje.map((p) => (p.id === id ? { ...p, ...patch } : p)) }))
  const usunProwizje = (id: string) => setK((s) => ({ ...s, prowizje: s.prowizje.filter((p) => p.id !== id) }))

  const sumaNaleznych = k.prowizje.filter((p) => !p.wyplacona).reduce((s, p) => s + (p.kwota || 0), 0)
  const sumaWyplaconych = k.prowizje.filter((p) => p.wyplacona).reduce((s, p) => s + (p.kwota || 0), 0)

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title={nowy ? 'Nowy kontrahent' : `Edycja: ${poczatek.nazwa}`}
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={() => onSave(k)}>
            <Check size={16} /> Zapisz
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Kategoria" required>
            <Select value={k.typ} onChange={(e) => set('typ', e.target.value as KontrahentTyp)}>
              {KONTRAHENT_TYPY.map((t) => (
                <option key={t.typ} value={t.typ}>
                  {t.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Aktywny">
            <div className="flex h-[42px] items-center">
              <Toggle
                checked={k.aktywny}
                onChange={(v) => set('aktywny', v)}
                label={k.aktywny ? 'Współpraca aktywna' : 'Nieaktywny'}
              />
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Imię i nazwisko / nazwa" required>
            <Input value={k.nazwa} onChange={(e) => set('nazwa', e.target.value)} placeholder="np. Anna Kowalska" />
          </Field>
          <Field label="Firma">
            <Input
              value={k.firma || ''}
              onChange={(e) => set('firma', e.target.value)}
              placeholder="Nazwa firmy / pracowni"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Telefon">
            <Input
              value={k.telefon || ''}
              onChange={(e) => set('telefon', e.target.value)}
              placeholder="+48 600 000 000"
              inputMode="tel"
            />
          </Field>
          <Field label="E-mail">
            <Input
              value={k.email || ''}
              onChange={(e) => set('email', e.target.value)}
              placeholder="kontakt@firma.pl"
              type="email"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field label="Specjalizacja">
            <Input
              value={k.specjalizacja || ''}
              onChange={(e) => set('specjalizacja', e.target.value)}
              placeholder="np. kuchnie premium, łazienki"
            />
          </Field>
          <Field label="Branża" hint="np. glazurnik, elektryk, hydraulik">
            <Input
              value={k.branza || ''}
              onChange={(e) => set('branza', e.target.value)}
              placeholder="Branża wykonawcza"
            />
          </Field>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label="NIP" error={nipOk ? undefined : 'Nieprawidłowy NIP'}>
            <Input
              value={k.nip || ''}
              onChange={(e) => set('nip', e.target.value)}
              placeholder="000-000-00-00"
              inputMode="numeric"
            />
          </Field>
          <Field label="Data kontaktu">
            <Input type="date" value={k.dataKontaktu || ''} onChange={(e) => set('dataKontaktu', e.target.value)} />
          </Field>
          <Field label="Stawka prowizji (%)">
            <KwotaInput value={k.stawkaProwizji} onChange={(n) => set('stawkaProwizji', n)} placeholder="np. 10" />
          </Field>
        </div>

        <Field label="Adres">
          <Input
            value={k.adres || ''}
            onChange={(e) => set('adres', e.target.value)}
            placeholder="ul. Przykładowa 1, 00-000 Miasto"
          />
        </Field>

        <Field label="Notatki">
          <Textarea
            value={k.notatki || ''}
            onChange={(e) => set('notatki', e.target.value)}
            placeholder="Ustalenia, warunki współpracy, uwagi…"
          />
        </Field>

        {/* Sekcja prowizji – tylko dla kategorii prowizyjnych */}
        {pokazProwizje && (
          <SectionCard
            title="Prowizje"
            icon={<Coins size={18} />}
            desc="Naliczone prowizje i status wypłat"
            actions={
              <button className="btn-outline btn-sm" onClick={dodajProwizje}>
                <Plus size={15} /> Dodaj
              </button>
            }
          >
            {k.prowizje.length === 0 ? (
              <p className="py-3 text-center text-[13px] text-stone-400">Brak naliczonych prowizji.</p>
            ) : (
              <div className="space-y-2.5">
                {k.prowizje.map((p) => (
                  <div key={p.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <Field label="Kwota (zł)">
                        <KwotaInput value={p.kwota} onChange={(n) => zmienProwizje(p.id, { kwota: n || 0 })} />
                      </Field>
                      <Field label="Nr zlecenia">
                        <Input
                          value={p.numerZlecenia || ''}
                          onChange={(e) => zmienProwizje(p.id, { numerZlecenia: e.target.value })}
                          placeholder="ZL 1/2026"
                        />
                      </Field>
                      <Field label="Data naliczenia">
                        <Input
                          type="date"
                          value={p.dataNaliczenia || ''}
                          onChange={(e) => zmienProwizje(p.id, { dataNaliczenia: e.target.value })}
                        />
                      </Field>
                      <Field label="Data wypłaty">
                        <Input
                          type="date"
                          value={p.dataWyplaty || ''}
                          onChange={(e) => zmienProwizje(p.id, { dataWyplaty: e.target.value })}
                        />
                      </Field>
                    </div>
                    <div className="mt-2.5 flex items-center justify-between gap-3">
                      <Toggle
                        checked={p.wyplacona}
                        onChange={(v) =>
                          zmienProwizje(p.id, {
                            wyplacona: v,
                            dataWyplaty: v && !p.dataWyplaty ? today() : p.dataWyplaty,
                          })
                        }
                        label={p.wyplacona ? 'Wypłacona' : 'Do wypłaty'}
                      />
                      <button
                        className="btn-ghost !px-2 text-red-600"
                        title="Usuń prowizję"
                        onClick={() => usunProwizje(p.id)}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
                <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 border-t border-stone-100 pt-2.5 text-[13px]">
                  <span className="text-stone-500">
                    Należne: <b className="text-amber-600">{fmtPLN(sumaNaleznych)}</b>
                  </span>
                  <span className="text-stone-500">
                    Wypłacone: <b className="text-brand-700">{fmtPLN(sumaWyplaconych)}</b>
                  </span>
                </div>
              </div>
            )}
          </SectionCard>
        )}
      </div>
    </Modal>
  )
}

// ---------- Dokument do druku: lista kontaktow kategorii ----------
export function KontrahenciDoc({
  firma,
  typNazwa,
  lista,
  logoDataUrl,
}: {
  firma: Firma
  typNazwa: string
  lista: Kontrahent[]
  logoDataUrl?: string
}) {
  const th: React.CSSProperties = {
    border: '1px solid #d3cfc2',
    padding: '5px 7px',
    fontSize: '8pt',
    fontWeight: 700,
    textAlign: 'left',
    background: '#f0ede6',
  }
  const td: React.CSSProperties = {
    border: '1px solid #d3cfc2',
    padding: '5px 7px',
    fontSize: '9pt',
    verticalAlign: 'top',
  }
  return (
    <DocSheet firma={firma} logoDataUrl={logoDataUrl}>
      <DocTitle sub={`Wygenerowano: ${fmtDate(today())} · pozycji: ${lista.length}`}>
        Lista kontaktów – {typNazwa}
      </DocTitle>
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8 }}>
        <thead>
          <tr>
            <th style={{ ...th, width: 26, textAlign: 'center' }}>LP.</th>
            <th style={th}>Imię i nazwisko / nazwa</th>
            <th style={th}>Firma</th>
            <th style={th}>Telefon</th>
            <th style={th}>E-mail</th>
            <th style={th}>Specjalizacja / branża</th>
          </tr>
        </thead>
        <tbody>
          {lista.map((k, i) => (
            <tr key={k.id}>
              <td style={{ ...td, textAlign: 'center' }}>{i + 1}.</td>
              <td style={td}>
                {k.nazwa}
                {k.nip ? <div style={{ fontSize: '7.5pt', color: '#6b6459' }}>NIP: {fmtNIP(k.nip)}</div> : null}
              </td>
              <td style={td}>{k.firma || '–'}</td>
              <td style={td}>{k.telefon || '–'}</td>
              <td style={td}>{k.email || '–'}</td>
              <td style={td}>{[k.specjalizacja, k.branza].filter(Boolean).join(' · ') || '–'}</td>
            </tr>
          ))}
          {lista.length === 0 && (
            <tr>
              <td style={{ ...td, textAlign: 'center', color: '#8a8478' }} colSpan={6}>
                Brak kontaktów w tej kategorii.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <div style={{ marginTop: 10, fontSize: '8pt', color: '#6b6459' }}>
        Kategoria kontrahentów: <b>{typNazwa}</b>. Dokument informacyjny – {firma.nazwa}.
      </div>
    </DocSheet>
  )
}

// Pole kwoty z wlasnym buforem tekstu. Bez niego wpisanie liczby z przecinkiem
// (np. "1,50") gubilo przecinek i zawyzalo kwote 100-krotnie.
function KwotaInput({
  value,
  onChange,
  placeholder,
}: {
  value?: number
  onChange: (n: number | undefined) => void
  placeholder?: string
}) {
  const [txt, setTxt] = useState(value != null ? String(value).replace('.', ',') : '')
  useEffect(() => {
    const biezacy = parseNum(txt)
    if (biezacy !== (value || 0)) setTxt(value != null ? String(value).replace('.', ',') : '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <Input
      value={txt}
      inputMode="decimal"
      placeholder={placeholder ?? '0,00'}
      onChange={(e) => {
        setTxt(e.target.value)
        onChange(e.target.value.trim() === '' ? undefined : parseNum(e.target.value))
      }}
    />
  )
}
