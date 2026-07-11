import { useState, useMemo } from 'react'
import { Package, Plus, Pencil, Trash2, Boxes, Tag } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Produkt, ProduktKategoria, Unit, VatRate, Firma } from '../lib/types'
import {
  PageHeader,
  SectionCard,
  SearchInput,
  Field,
  Input,
  Textarea,
  Select,
  Toggle,
  Badge,
  Modal,
  EmptyState,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { DocSheet } from '../documents/DocShell'
import { fmtPLN } from '../lib/format'
import { uid } from '../lib/id'

// ---------- Kategorie produktow ----------
type BadgeTone = 'green' | 'stone' | 'amber' | 'blue' | 'red'
const KATEGORIE: { klucz: ProduktKategoria; nazwa: string; tone: BadgeTone }[] = [
  { klucz: 'granit', nazwa: 'Granit', tone: 'stone' },
  { klucz: 'marmur', nazwa: 'Marmur', tone: 'blue' },
  { klucz: 'trawertyn', nazwa: 'Trawertyn', tone: 'amber' },
  { klucz: 'onyks', nazwa: 'Onyks', tone: 'red' },
  { klucz: 'kwarc', nazwa: 'Kwarc', tone: 'green' },
  { klucz: 'spiek', nazwa: 'Spiek', tone: 'blue' },
  { klucz: 'dekton', nazwa: 'Dekton', tone: 'amber' },
  { klucz: 'konglomerat', nazwa: 'Konglomerat', tone: 'stone' },
  { klucz: 'usluga', nazwa: 'Usługa', tone: 'green' },
  { klucz: 'akcesorium', nazwa: 'Akcesorium', tone: 'stone' },
]
function kategoriaInfo(k: ProduktKategoria) {
  return KATEGORIE.find((x) => x.klucz === k) || KATEGORIE[0]
}

const JEDNOSTKI: Unit[] = ['m²', 'mb', 'szt', 'kpl', 'usł', 'h']
const VAT_STAWKI: VatRate[] = [8, 23]

// Formularz – cena jako string dla wygody wpisywania
interface Form {
  id: string
  nazwa: string
  kategoria: ProduktKategoria
  jednostka: Unit
  cena: string
  vat: VatRate
  producent: string
  kolor: string
  grubosc: string
  opis: string
  aktywny: boolean
}

function pustyForm(): Form {
  return {
    id: uid('prod'),
    nazwa: '',
    kategoria: 'granit',
    jednostka: 'm²',
    cena: '',
    vat: 23,
    producent: '',
    kolor: '',
    grubosc: '',
    opis: '',
    aktywny: true,
  }
}

function toForm(p: Produkt): Form {
  return {
    id: p.id,
    nazwa: p.nazwa,
    kategoria: p.kategoria,
    jednostka: p.jednostka,
    cena: p.cenaNetto ? String(p.cenaNetto) : '',
    vat: p.vat,
    producent: p.producent || '',
    kolor: p.kolor || '',
    grubosc: p.grubosc || '',
    opis: p.opis || '',
    aktywny: p.aktywny,
  }
}

export default function Produkty() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [szukaj, setSzukaj] = useState('')
  const [filtr, setFiltr] = useState<ProduktKategoria | 'all'>('all')
  const [edit, setEdit] = useState<Form | null>(null)

  const produkty = b.produkty

  const widoczne = useMemo(() => {
    const q = szukaj.trim().toLowerCase()
    return produkty
      .filter((p) => (filtr === 'all' ? true : p.kategoria === filtr))
      .filter((p) => {
        if (!q) return true
        return [p.nazwa, p.producent, p.kolor, p.grubosc, kategoriaInfo(p.kategoria).nazwa]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(q))
      })
      .sort((a, c) => a.nazwa.localeCompare(c.nazwa, 'pl'))
  }, [produkty, filtr, szukaj])

  // Grupowanie po kategorii (kolejnosc wg KATEGORIE)
  const grupy = useMemo(() => {
    return KATEGORIE.map((kat) => ({
      kat,
      items: widoczne.filter((p) => p.kategoria === kat.klucz),
    })).filter((g) => g.items.length > 0)
  }, [widoczne])

  // Liczniki per kategoria (do chipsow)
  const licznik = (k: ProduktKategoria | 'all') =>
    k === 'all' ? produkty.length : produkty.filter((p) => p.kategoria === k).length

  function zapisz() {
    if (!edit) return
    if (!edit.nazwa.trim()) {
      push('Podaj nazwę produktu', 'err')
      return
    }
    const produkt: Produkt = {
      id: edit.id,
      nazwa: edit.nazwa.trim(),
      kategoria: edit.kategoria,
      jednostka: edit.jednostka,
      cenaNetto: parseCena(edit.cena),
      vat: edit.vat,
      opis: edit.opis.trim() || undefined,
      producent: edit.producent.trim() || undefined,
      kolor: edit.kolor.trim() || undefined,
      grubosc: edit.grubosc.trim() || undefined,
      aktywny: edit.aktywny,
    }
    upsert('produkty', produkt)
    push('Zapisano produkt', 'ok')
    setEdit(null)
  }

  async function usun(p: Produkt) {
    if (await confirm(`Usunąć „${p.nazwa}” z katalogu?`)) {
      remove('produkty', p.id)
      push('Usunięto produkt', 'ok')
    }
  }

  return (
    <div>
      <PageHeader
        title="Produkty i cennik"
        subtitle={`Katalog materiałów, usług i akcesoriów · ${produkty.length} pozycji`}
        icon={<Package size={22} />}
        actions={
          <>
            <PrintSendBar
              getPrintNode={() => (
                <CennikDoc produkty={widoczne} firma={firma} logoDataUrl={b.ustawienia.logoDataUrl} />
              )}
              share={{
                title: `Cennik – ${firma.nazwa}`,
                text: cennikTekst(widoczne, firma),
              }}
              labelPrint="Drukuj cennik"
            />
            <button className="btn-primary" onClick={() => setEdit(pustyForm())}>
              <Plus size={17} /> Dodaj produkt
            </button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="lg:w-80">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj nazwy, producenta, koloru…" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={filtr === 'all'} onClick={() => setFiltr('all')} label="Wszystkie" n={licznik('all')} />
          {KATEGORIE.map((k) => (
            <Chip
              key={k.klucz}
              active={filtr === k.klucz}
              onClick={() => setFiltr(k.klucz)}
              label={k.nazwa}
              n={licznik(k.klucz)}
            />
          ))}
        </div>
      </div>

      {widoczne.length === 0 ? (
        <EmptyState
          icon={<Boxes size={26} />}
          title="Brak produktów"
          desc={
            produkty.length === 0
              ? 'Dodaj pierwszą pozycję do katalogu – materiał, usługę lub akcesorium.'
              : 'Żaden produkt nie pasuje do wybranych filtrów.'
          }
          action={
            <button className="btn-primary" onClick={() => setEdit(pustyForm())}>
              <Plus size={17} /> Dodaj produkt
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {grupy.map((g) => (
            <div key={g.kat.klucz}>
              <div className="mb-2.5 flex items-center gap-2">
                <h3 className="text-[14px] font-semibold text-ink">{g.kat.nazwa}</h3>
                <Badge tone={g.kat.tone}>{g.items.length}</Badge>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.items.map((p) => (
                  <ProduktKarta key={p.id} p={p} onEdit={() => setEdit(toForm(p))} onDelete={() => usun(p)} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit && produkty.some((p) => p.id === edit.id) ? 'Edytuj produkt' : 'Nowy produkt'}
        size="lg"
        footer={
          <>
            <button className="btn-outline" onClick={() => setEdit(null)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={zapisz}>
              Zapisz
            </button>
          </>
        }
      >
        {edit && (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Nazwa" required className="sm:col-span-2">
              <Input
                value={edit.nazwa}
                onChange={(e) => setEdit({ ...edit, nazwa: e.target.value })}
                placeholder="np. Blat granitowy Nero Assoluto 3 cm"
                autoFocus
              />
            </Field>

            <Field label="Kategoria">
              <Select
                value={edit.kategoria}
                onChange={(e) => setEdit({ ...edit, kategoria: e.target.value as ProduktKategoria })}
              >
                {KATEGORIE.map((k) => (
                  <option key={k.klucz} value={k.klucz}>
                    {k.nazwa}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Jednostka">
              <Select value={edit.jednostka} onChange={(e) => setEdit({ ...edit, jednostka: e.target.value as Unit })}>
                {JEDNOSTKI.map((j) => (
                  <option key={j} value={j}>
                    {j}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Cena netto (zł)" hint="Wpisz 0 lub zostaw puste → „wg wyceny”">
              <Input
                inputMode="decimal"
                value={edit.cena}
                onChange={(e) => setEdit({ ...edit, cena: e.target.value })}
                placeholder="0,00"
              />
            </Field>

            <Field label="Stawka VAT">
              <Select value={edit.vat} onChange={(e) => setEdit({ ...edit, vat: Number(e.target.value) as VatRate })}>
                {VAT_STAWKI.map((v) => (
                  <option key={v} value={v}>
                    {v}%
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Producent">
              <Input
                value={edit.producent}
                onChange={(e) => setEdit({ ...edit, producent: e.target.value })}
                placeholder="np. Levantina"
              />
            </Field>

            <Field label="Kolor">
              <Input
                value={edit.kolor}
                onChange={(e) => setEdit({ ...edit, kolor: e.target.value })}
                placeholder="np. Nero Assoluto"
              />
            </Field>

            <Field label="Grubość">
              <Input
                value={edit.grubosc}
                onChange={(e) => setEdit({ ...edit, grubosc: e.target.value })}
                placeholder='np. "2/3 cm"'
              />
            </Field>

            <Field label="Opis" className="sm:col-span-2">
              <Textarea
                value={edit.opis}
                onChange={(e) => setEdit({ ...edit, opis: e.target.value })}
                placeholder="Dodatkowe informacje, wykończenie krawędzi, uwagi…"
              />
            </Field>

            <div className="sm:col-span-2">
              <Toggle
                checked={edit.aktywny}
                onChange={(v) => setEdit({ ...edit, aktywny: v })}
                label="Produkt aktywny (widoczny w cenniku i wycenach)"
              />
            </div>
          </div>
        )}
      </Modal>

      {confirmNode}
    </div>
  )
}

// ---------- Chip filtra ----------
function Chip({ active, onClick, label, n }: { active: boolean; onClick: () => void; label: string; n: number }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition',
        active
          ? 'border-brand-700 bg-white/10 text-white'
          : 'border-white/10 bg-white/[0.03] text-stone-600 hover:border-brand-300 hover:bg-brand-50',
      )}
    >
      {label}
      <span className={cx('rounded-full px-1.5 text-[11px]', active ? 'bg-white/20' : 'bg-stone-100 text-stone-500')}>
        {n}
      </span>
    </button>
  )
}

// ---------- Karta produktu ----------
function ProduktKarta({ p, onEdit, onDelete }: { p: Produkt; onEdit: () => void; onDelete: () => void }) {
  const ki = kategoriaInfo(p.kategoria)
  return (
    <div className={cx('card card-pad flex flex-col gap-3', !p.aktywny && 'opacity-60')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Badge tone={ki.tone}>{ki.nazwa}</Badge>
            {!p.aktywny && <Badge tone="stone">Nieaktywny</Badge>}
          </div>
          <h4 className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{p.nazwa}</h4>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button className="btn-ghost !px-2" onClick={onEdit} title="Edytuj">
            <Pencil size={16} />
          </button>
          <button className="btn-ghost !px-2 text-red-600" onClick={onDelete} title="Usuń">
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {(p.producent || p.kolor || p.grubosc) && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-stone-500">
          {p.producent && <span>{p.producent}</span>}
          {p.kolor && (
            <span className="inline-flex items-center gap-1">
              <Tag size={12} className="text-stone-400" /> {p.kolor}
            </span>
          )}
          {p.grubosc && <span>gr. {p.grubosc}</span>}
        </div>
      )}

      <div className="mt-auto flex items-end justify-between border-t border-stone-100 pt-3">
        <div>
          <div className="text-[17px] font-display font-semibold text-brand-700">
            {p.cenaNetto > 0 ? fmtPLN(p.cenaNetto) : <span className="text-stone-500">wg wyceny</span>}
          </div>
          <div className="text-[11.5px] text-stone-400">
            {p.cenaNetto > 0 ? `netto / ${p.jednostka}` : `jedn.: ${p.jednostka}`}
          </div>
        </div>
        <Badge tone="stone">VAT {p.vat}%</Badge>
      </div>
    </div>
  )
}

// ---------- Pomocnicze ----------
function parseCena(s: string): number {
  const cleaned = s.replace(/\s/g, '').replace(/zł/gi, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0
}

function cenaLub(p: Produkt): string {
  return p.cenaNetto > 0 ? `${fmtPLN(p.cenaNetto)} / ${p.jednostka}` : 'wg wyceny'
}

function cennikTekst(produkty: Produkt[], firma: Firma): string {
  const linie = produkty.map((p) => {
    const dod = [p.producent, p.kolor, p.grubosc].filter(Boolean).join(', ')
    return `• ${p.nazwa}${dod ? ` (${dod})` : ''} – ${cenaLub(p)} (VAT ${p.vat}%)`
  })
  return `Cennik – ${firma.nazwa}\n\n${linie.join('\n')}`
}

// ---------- Dokument: Cennik (wydruk / PDF) ----------
export function CennikDoc({
  produkty,
  firma,
  logoDataUrl,
}: {
  produkty: Produkt[]
  firma: Firma
  logoDataUrl?: string
}) {
  const cellH: React.CSSProperties = {
    border: '1px solid #d3cfc2',
    padding: '4px 6px',
    fontSize: '7.6pt',
    fontWeight: 700,
    background: '#f0ede6',
  }
  const cell: React.CSSProperties = { border: '1px solid #d3cfc2', padding: '4px 6px', fontSize: '8.5pt' }

  // grupowanie wg kategorii dla czytelnosci
  const grupy = KATEGORIE.map((kat) => ({
    kat,
    items: produkty.filter((p) => p.kategoria === kat.klucz).sort((a, c) => a.nazwa.localeCompare(c.nazwa, 'pl')),
  })).filter((g) => g.items.length > 0)

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#12233a',
            letterSpacing: '0.03em',
          }}
        >
          CENNIK
        </div>
        <div style={{ fontSize: '9pt', color: '#6b6459', letterSpacing: '0.1em', fontWeight: 600 }}>
          MATERIAŁY · USŁUGI · AKCESORIA
        </div>
      </div>

      {grupy.length === 0 ? (
        <div style={{ fontSize: '9pt', color: '#6b6459', textAlign: 'center', padding: '12px 0' }}>
          Brak pozycji do wyświetlenia.
        </div>
      ) : (
        grupy.map((g) => (
          <div key={g.kat.klucz} style={{ marginBottom: 12 }}>
            <div
              style={{
                display: 'inline-block',
                background: '#12233a',
                color: '#fff',
                fontSize: '8.5pt',
                fontWeight: 700,
                borderRadius: 6,
                padding: '3px 9px',
                marginBottom: 6,
              }}
            >
              {g.kat.nazwa}
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...cellH, textAlign: 'left' }}>NAZWA</th>
                  <th style={{ ...cellH, textAlign: 'left', width: 150 }}>PRODUCENT / KOLOR</th>
                  <th style={{ ...cellH, textAlign: 'center', width: 60 }}>GRUB.</th>
                  <th style={{ ...cellH, textAlign: 'center', width: 46 }}>JEDN.</th>
                  <th style={{ ...cellH, textAlign: 'right', width: 90 }}>CENA NETTO</th>
                  <th style={{ ...cellH, textAlign: 'center', width: 44 }}>VAT</th>
                </tr>
              </thead>
              <tbody>
                {g.items.map((p) => (
                  <tr key={p.id}>
                    <td style={{ ...cell, textAlign: 'left', fontWeight: 500 }}>{p.nazwa}</td>
                    <td style={{ ...cell, textAlign: 'left' }}>
                      {[p.producent, p.kolor].filter(Boolean).join(' · ') || '–'}
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>{p.grubosc || '–'}</td>
                    <td style={{ ...cell, textAlign: 'center' }}>{p.jednostka}</td>
                    <td style={{ ...cell, textAlign: 'right', fontWeight: 600 }}>
                      {p.cenaNetto > 0 ? fmtPLN(p.cenaNetto) : 'wg wyceny'}
                    </td>
                    <td style={{ ...cell, textAlign: 'center' }}>{p.vat}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))
      )}

      <div style={{ fontSize: '7.6pt', color: '#8a8478', marginTop: 6 }}>
        Ceny netto, orientacyjne. Ostateczna wycena po obmiarze z natury. Ceny oznaczone „wg wyceny” ustalane
        indywidualnie.
      </div>
    </DocSheet>
  )
}
