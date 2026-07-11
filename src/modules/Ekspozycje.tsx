import { useState } from 'react'
import { Store, Plus, Pencil, Trash2, CalendarClock, Package, X, GripVertical } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  Card,
  CardBody,
  Field,
  Input,
  Select,
  Modal,
  Badge,
  EmptyState,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { fmtPLN, fmtDate, parseNum, today, nowISO, round2 } from '../lib/format'
import type { Ekspozycja, RozliczenieEkspozycji, Firma } from '../lib/types'
import { uid } from '../lib/id'
import { PrintSendBar } from '../components/PrintSendBar'
import { RozliczenieEkspozycjiDoc } from '../documents/RozliczenieEkspozycjiDoc'

// ---------- Pole liczbowe (utrzymuje wygodne wpisywanie przecinka) ----------
function NumInput({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: number
  onChange: (n: number) => void
  placeholder?: string
  className?: string
}) {
  const [txt, setTxt] = useState(value ? String(value).replace('.', ',') : '')
  return (
    <Input
      inputMode="decimal"
      className={className}
      placeholder={placeholder || '0,00'}
      value={txt}
      onChange={(e) => {
        setTxt(e.target.value)
        onChange(parseNum(e.target.value))
      }}
    />
  )
}

// ---------- Obliczenia pomocnicze ----------
function zobowiazanieOf(e: Ekspozycja): number {
  return round2((e.wartoscNetto || 0) * (e.krotnosc || 0))
}
function zrealizowanoOf(e: Ekspozycja): number {
  return round2(e.rozliczenia.reduce((a, r) => a + (r.kwotaNetto || 0), 0))
}
function procentOf(e: Ekspozycja): number {
  const zob = zobowiazanieOf(e)
  return zob > 0 ? Math.min(100, (zrealizowanoOf(e) / zob) * 100) : 0
}
function dniDo(iso?: string): number | null {
  if (!iso) return null
  const ms = new Date(iso + 'T00:00:00').getTime() - new Date(today() + 'T00:00:00').getTime()
  return Math.round(ms / 86_400_000)
}
type Semafor = { tone: 'green' | 'amber' | 'red'; label: string }
function semaforOf(e: Ekspozycja): Semafor {
  const p = procentOf(e)
  const dni = dniDo(e.dataDo)
  if (dni !== null && dni < 0 && p < 100) return { tone: 'red', label: 'Po terminie' }
  if (p >= 80) return { tone: 'green', label: 'Realizowane' }
  if (p >= 40) return { tone: 'amber', label: 'W trakcie' }
  return { tone: 'red', label: 'Niski postęp' }
}

// ---------- Fabryka nowej ekspozycji ----------
function pustaEkspozycja(firmaId: string, numer: string): Ekspozycja {
  return {
    id: uid('eks'),
    numer,
    firmaId,
    sprzedawcaId: undefined,
    nazwaFirmy: '',
    dataPodpisania: today(),
    dataDo: '',
    numerZlecenia: '',
    wartoscNetto: 0,
    wartoscBrutto: 0,
    krotnosc: 5,
    wartoscPrac: 0,
    rozliczenia: [],
    dokumentacja: [],
    utworzono: nowISO(),
  }
}

export default function Ekspozycje() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [edit, setEdit] = useState<Ekspozycja | null>(null)

  const sprzedawcy = b.kontrahenci.filter((k) => k.typ === 'sprzedawca')
  const lista = b.ekspozycje.slice().sort((a, c) => c.utworzono.localeCompare(a.utworzono))

  const otworzNowa = () => {
    setEdit(pustaEkspozycja(firma.id, kolejnyNumer('EKS')))
  }
  const otworzEdycje = (e: Ekspozycja) => {
    setEdit(structuredClone(e))
  }
  const set = (patch: Partial<Ekspozycja>) => setEdit((e) => (e ? { ...e, ...patch } : e))

  const zapisz = () => {
    if (!edit) return
    const nazwa = (edit.nazwaFirmy || '').trim()
    const sprz = sprzedawcy.find((k) => k.id === edit.sprzedawcaId)
    if (!nazwa && !sprz) {
      push('Podaj nazwę firmy lub wybierz sprzedawcę', 'err')
      return
    }
    upsert('ekspozycje', { ...edit, nazwaFirmy: nazwa })
    setEdit(null)
    push('Zapisano ekspozycję')
  }

  const usun = async (e: Ekspozycja) => {
    const ok = await confirm(`Usunąć ekspozycję ${e.numer}? Tej operacji nie można cofnąć.`)
    if (ok) {
      remove('ekspozycje', e.id)
      push('Usunięto ekspozycję', 'info')
    }
  }

  // ---------- Edycja rozliczeń ----------
  const dodajRozliczenie = () => {
    setEdit((e) =>
      e
        ? {
            ...e,
            rozliczenia: [
              ...e.rozliczenia,
              { id: uid('roz'), data: today(), numerZlecenia: '', nazwiskoKlienta: '', kwotaNetto: 0 },
            ],
          }
        : e,
    )
  }
  const zmienRozliczenie = (id: string, patch: Partial<RozliczenieEkspozycji>) => {
    setEdit((e) => (e ? { ...e, rozliczenia: e.rozliczenia.map((r) => (r.id === id ? { ...r, ...patch } : r)) } : e))
  }
  const usunRozliczenie = (id: string) => {
    setEdit((e) => (e ? { ...e, rozliczenia: e.rozliczenia.filter((r) => r.id !== id) } : e))
  }

  return (
    <div>
      <PageHeader
        title="Ekspozycje kamienia"
        subtitle="Umowy współpracy ze sprzedawcami i rozliczenie zobowiązania zakupowego"
        icon={<Store size={22} />}
        actions={
          <button className="btn-primary" onClick={otworzNowa}>
            <Plus size={17} /> Nowa ekspozycja
          </button>
        }
      />

      {lista.length === 0 ? (
        <EmptyState
          icon={<Store size={26} />}
          title="Brak ekspozycji"
          desc="Dodaj pierwszą umowę ekspozycji, aby śledzić realizację zobowiązania zakupowego."
          action={
            <button className="btn-primary" onClick={otworzNowa}>
              <Plus size={17} /> Nowa ekspozycja
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {lista.map((e) => (
            <KartaEkspozycji
              key={e.id}
              e={e}
              sprzedawcaNazwa={sprzedawcy.find((k) => k.id === e.sprzedawcaId)?.nazwa}
              firma={firma}
              logoDataUrl={b.ustawienia.logoDataUrl}
              shareTo={sprzedawcy.find((k) => k.id === e.sprzedawcaId)?.email}
              sharePhone={sprzedawcy.find((k) => k.id === e.sprzedawcaId)?.telefon}
              onEdit={() => otworzEdycje(e)}
              onDelete={() => usun(e)}
            />
          ))}
        </div>
      )}

      {/* ---------- Modal dodawania / edycji ---------- */}
      <Modal
        open={!!edit}
        onClose={() => setEdit(null)}
        title={edit ? `Ekspozycja · ${edit.numer}` : 'Ekspozycja'}
        size="xl"
        footer={
          <>
            <button className="btn-ghost" onClick={() => setEdit(null)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={zapisz}>
              Zapisz ekspozycję
            </button>
          </>
        }
      >
        {edit && (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Sprzedawca / partner">
                <Select
                  value={edit.sprzedawcaId || ''}
                  onChange={(ev) => {
                    const id = ev.target.value || undefined
                    const k = sprzedawcy.find((x) => x.id === id)
                    set({
                      sprzedawcaId: id,
                      nazwaFirmy: !edit.nazwaFirmy && k ? k.firma || k.nazwa : edit.nazwaFirmy,
                    })
                  }}
                >
                  <option value="">– wybierz z kontrahentów –</option>
                  {sprzedawcy.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.nazwa}
                      {k.firma ? ` (${k.firma})` : ''}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Nazwa firmy">
                <Input
                  value={edit.nazwaFirmy || ''}
                  onChange={(ev) => set({ nazwaFirmy: ev.target.value })}
                  placeholder="np. Kamień-Bud sp. z o.o."
                />
              </Field>
              <Field label="Data podpisania umowy">
                <Input
                  type="date"
                  value={edit.dataPodpisania || ''}
                  onChange={(ev) => set({ dataPodpisania: ev.target.value })}
                />
              </Field>
              <Field label="Data obowiązywania (do)">
                <Input type="date" value={edit.dataDo || ''} onChange={(ev) => set({ dataDo: ev.target.value })} />
              </Field>
              <Field label="Numer zlecenia" className="sm:col-span-2">
                <Input
                  value={edit.numerZlecenia || ''}
                  onChange={(ev) => set({ numerZlecenia: ev.target.value })}
                  placeholder="np. Z 12/2026"
                />
              </Field>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Wartość netto (zł)">
                <NumInput value={edit.wartoscNetto} onChange={(n) => set({ wartoscNetto: n })} />
              </Field>
              <Field label="Wartość brutto (zł)">
                <NumInput value={edit.wartoscBrutto} onChange={(n) => set({ wartoscBrutto: n })} />
              </Field>
              <Field label="Krotność zobowiązania" hint="domyślnie 5×">
                <NumInput value={edit.krotnosc} onChange={(n) => set({ krotnosc: n })} placeholder="5" />
              </Field>
              <Field label="Wartość prac (zł)">
                <NumInput value={edit.wartoscPrac} onChange={(n) => set({ wartoscPrac: n })} />
              </Field>
            </div>

            <div className="rounded-2xl bg-stone-50 p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
                <span className="text-stone-500">
                  Zobowiązanie ({edit.krotnosc || 0}× netto): <b className="text-ink">{fmtPLN(zobowiazanieOf(edit))}</b>
                </span>
                <span className="text-stone-500">
                  Zrealizowano: <b className="text-brand-700">{fmtPLN(zrealizowanoOf(edit))}</b> (
                  {procentOf(edit).toFixed(1)}%)
                </span>
              </div>
            </div>

            {/* ---------- Rozliczenia ---------- */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="section-title">Rozliczenia</h3>
                <button className="btn-outline btn-sm" onClick={dodajRozliczenie}>
                  <Plus size={15} /> Dodaj pozycję
                </button>
              </div>

              {edit.rozliczenia.length === 0 ? (
                <p className="rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-[13px] text-stone-400">
                  Brak rozliczeń. Dodaj pierwszą pozycję powiązaną z realizacją zlecenia.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-[13px]">
                    <thead>
                      <tr>
                        <th className="th w-8"></th>
                        <th className="th w-36">Data</th>
                        <th className="th text-left">Nr zlecenia</th>
                        <th className="th text-left">Nazwisko klienta</th>
                        <th className="th w-40">Kwota netto</th>
                        <th className="th w-10"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {edit.rozliczenia.map((r) => (
                        <tr key={r.id} className="row-hover">
                          <td className="td text-stone-400">
                            <GripVertical size={15} />
                          </td>
                          <td className="td">
                            <Input
                              type="date"
                              value={r.data || ''}
                              onChange={(ev) => zmienRozliczenie(r.id, { data: ev.target.value })}
                            />
                          </td>
                          <td className="td">
                            <Input
                              value={r.numerZlecenia || ''}
                              onChange={(ev) => zmienRozliczenie(r.id, { numerZlecenia: ev.target.value })}
                              placeholder="np. Z 15/2026"
                            />
                          </td>
                          <td className="td">
                            <Input
                              value={r.nazwiskoKlienta || ''}
                              onChange={(ev) => zmienRozliczenie(r.id, { nazwiskoKlienta: ev.target.value })}
                              placeholder="Kowalski"
                            />
                          </td>
                          <td className="td">
                            <NumInput
                              value={r.kwotaNetto}
                              onChange={(n) => zmienRozliczenie(r.id, { kwotaNetto: n })}
                            />
                          </td>
                          <td className="td">
                            <button
                              className="btn-ghost !px-2 text-red-600"
                              onClick={() => usunRozliczenie(r.id)}
                              title="Usuń pozycję"
                            >
                              <X size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td className="td text-right font-semibold" colSpan={4}>
                          Suma rozliczeń netto:
                        </td>
                        <td className="td font-semibold text-brand-700">{fmtPLN(zrealizowanoOf(edit))}</td>
                        <td className="td"></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      {confirmNode}
    </div>
  )
}

// ---------- Karta pojedynczej ekspozycji ----------
function KartaEkspozycji({
  e,
  sprzedawcaNazwa,
  firma,
  logoDataUrl,
  shareTo,
  sharePhone,
  onEdit,
  onDelete,
}: {
  e: Ekspozycja
  sprzedawcaNazwa?: string
  firma: Firma
  logoDataUrl?: string
  shareTo?: string
  sharePhone?: string
  onEdit: () => void
  onDelete: () => void
}) {
  const zob = zobowiazanieOf(e)
  const zreal = zrealizowanoOf(e)
  const procent = procentOf(e)
  const sem = semaforOf(e)
  const dni = dniDo(e.dataDo)
  const barKolor = sem.tone === 'green' ? 'bg-brand-600' : sem.tone === 'amber' ? 'bg-amber-500' : 'bg-red-500'
  const tytul = e.nazwaFirmy || sprzedawcaNazwa || 'Ekspozycja'

  return (
    <Card>
      <CardBody className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <Package size={17} />
              </span>
              <div className="min-w-0">
                <div className="truncate text-[15px] font-semibold text-ink">{tytul}</div>
                <div className="text-[12px] text-stone-400">
                  {e.numer}
                  {sprzedawcaNazwa && e.nazwaFirmy ? ` · ${sprzedawcaNazwa}` : ''}
                </div>
              </div>
            </div>
          </div>
          <Badge tone={sem.tone}>{sem.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          <Info label="Wartość netto" value={fmtPLN(e.wartoscNetto)} />
          <Info label="Wartość brutto" value={fmtPLN(e.wartoscBrutto)} />
          <Info label={`Zobowiązanie (${e.krotnosc || 0}×)`} value={fmtPLN(zob)} />
          <Info label="Zrealizowano" value={fmtPLN(zreal)} tone />
        </div>

        {/* Pasek postępu */}
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[12px] text-stone-500">
            <span>Realizacja zobowiązania</span>
            <span className="font-semibold text-stone-700">{procent.toFixed(1)}%</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-stone-100">
            <div className={cx('h-full rounded-full transition-all', barKolor)} style={{ width: `${procent}%` }} />
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-100 pt-3">
          <div className="flex items-center gap-1.5 text-[12.5px] text-stone-500">
            <CalendarClock size={15} className="text-stone-400" />
            {e.dataDo ? (
              dni !== null && dni < 0 ? (
                <span className="font-medium text-red-600">po terminie ({fmtDate(e.dataDo)})</span>
              ) : (
                <span>
                  do {fmtDate(e.dataDo)}
                  {dni !== null && <span className="text-stone-400"> · {dni} dni</span>}
                </span>
              )
            ) : (
              <span className="text-stone-400">brak terminu</span>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button className="btn-outline btn-sm" onClick={onEdit}>
              <Pencil size={15} /> Edytuj
            </button>
            <button className="btn-ghost btn-sm text-red-600" onClick={onDelete}>
              <Trash2 size={15} /> Usuń
            </button>
          </div>
          <PrintSendBar
            size="sm"
            getPrintNode={() => <RozliczenieEkspozycjiDoc e={e} firma={firma} logoDataUrl={logoDataUrl} />}
            share={{
              title: `Rozliczenie ekspozycji ${e.numer}`,
              text: `Rozliczenie ekspozycji ${e.numer} – ${tytul}. Zobowiązanie: ${fmtPLN(zob)}, zrealizowano: ${fmtPLN(zreal)} (${procent.toFixed(
                1,
              )}%).`,
              to: shareTo,
              phone: sharePhone,
            }}
          />
        </div>
      </CardBody>
    </Card>
  )
}

function Info({ label, value, tone }: { label: string; value: string; tone?: boolean }) {
  return (
    <div>
      <div className="text-[11.5px] uppercase tracking-wide text-stone-400">{label}</div>
      <div className={cx('font-semibold', tone ? 'text-brand-700' : 'text-ink')}>{value}</div>
    </div>
  )
}
