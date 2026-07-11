import { useMemo, useState } from 'react'
import { CalendarDays, Plus, ChevronLeft, ChevronRight, MapPin, User, Clock, Trash2, Pencil } from 'lucide-react'
import { useStore } from '../lib/store'
import type { Wydarzenie, WydarzenieTyp } from '../lib/types'
import {
  PageHeader,
  Card,
  CardBody,
  Field,
  Input,
  Textarea,
  Select,
  Modal,
  Badge,
  Toggle,
  EmptyState,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { DocSheet } from '../documents/DocShell'
import { uid } from '../lib/id'
import { today, nowISO, fmtDate, fmtMonthYear, toISO, dayName } from '../lib/format'
import { klientNazwa } from '../lib/helpers'

// ---------- Metadane typow wydarzen (kolory + etykiety) ----------
const TYPY: { typ: WydarzenieTyp; nazwa: string; kolor: string; tone: 'green' | 'stone' | 'amber' | 'blue' | 'red' }[] =
  [
    { typ: 'pomiar', nazwa: 'Pomiar', kolor: '#2563eb', tone: 'blue' },
    { typ: 'montaz', nazwa: 'Montaż', kolor: '#d97706', tone: 'amber' },
    { typ: 'transport', nazwa: 'Transport', kolor: '#7c3aed', tone: 'stone' },
    { typ: 'spotkanie', nazwa: 'Spotkanie', kolor: '#0891b2', tone: 'blue' },
    { typ: 'odbior', nazwa: 'Odbiór', kolor: '#059669', tone: 'green' },
    { typ: 'inne', nazwa: 'Inne', kolor: '#78716c', tone: 'stone' },
  ]
function typInfo(t: WydarzenieTyp) {
  return TYPY.find((x) => x.typ === t) || TYPY[TYPY.length - 1]
}

const DNI_SKROT = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nie']

function pustyDraft(data: string): Wydarzenie {
  return {
    id: uid('wyd'),
    data,
    godzina: '',
    typ: 'pomiar',
    tytul: '',
    klientId: '',
    pracownikId: '',
    adres: '',
    notatki: '',
    zrobione: false,
  }
}

export default function Kalendarz() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const t = today()
  const [wybranyDzien, setWybranyDzien] = useState<string>(t)
  const startowa = new Date(t)
  const [rok, setRok] = useState(startowa.getFullYear())
  const [mies, setMies] = useState(startowa.getMonth())

  const [filtrPracownik, setFiltrPracownik] = useState('')
  const [filtrTyp, setFiltrTyp] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [draft, setDraft] = useState<Wydarzenie>(() => pustyDraft(t))
  const [edycja, setEdycja] = useState(false)

  // ---------- Filtrowanie ----------
  const wydarzeniaFiltr = useMemo(
    () =>
      b.wydarzenia.filter(
        (w) => (!filtrPracownik || w.pracownikId === filtrPracownik) && (!filtrTyp || w.typ === filtrTyp),
      ),
    [b.wydarzenia, filtrPracownik, filtrTyp],
  )

  // Mapa: data ISO -> lista wydarzen (posortowana po godzinie)
  const wgDnia = useMemo(() => {
    const m = new Map<string, Wydarzenie[]>()
    for (const w of wydarzeniaFiltr) {
      const arr = m.get(w.data) || []
      arr.push(w)
      m.set(w.data, arr)
    }
    for (const arr of m.values()) arr.sort((a, c) => (a.godzina || '').localeCompare(c.godzina || ''))
    return m
  }, [wydarzeniaFiltr])

  // ---------- Siatka miesiaca (poniedzialek-pierwszy, 42 komorki) ----------
  const komorki = useMemo(() => {
    const first = new Date(rok, mies, 1)
    const offset = (first.getDay() + 6) % 7
    return Array.from({ length: 42 }, (_, i) => {
      const d = new Date(rok, mies, 1 - offset + i)
      const iso = toISO(d)
      return { iso, dzien: d.getDate(), wMiesiacu: d.getMonth() === mies, dzis: iso === t }
    })
  }, [rok, mies, t])

  const dzienWydarzenia = wgDnia.get(wybranyDzien) || []

  function poprzedni() {
    const m = mies - 1
    if (m < 0) {
      setMies(11)
      setRok(rok - 1)
    } else setMies(m)
  }
  function nastepny() {
    const m = mies + 1
    if (m > 11) {
      setMies(0)
      setRok(rok + 1)
    } else setMies(m)
  }
  function dzis() {
    setRok(startowa.getFullYear())
    setMies(startowa.getMonth())
    setWybranyDzien(t)
  }

  // ---------- Modal ----------
  function nowe() {
    setDraft(pustyDraft(wybranyDzien))
    setEdycja(false)
    setModalOpen(true)
  }
  function edytuj(w: Wydarzenie) {
    setDraft({ ...w })
    setEdycja(true)
    setModalOpen(true)
  }
  function zapisz() {
    if (!draft.tytul.trim()) {
      push('Podaj tytuł wydarzenia', 'err')
      return
    }
    upsert('wydarzenia', { ...draft, tytul: draft.tytul.trim() })
    setModalOpen(false)
    setWybranyDzien(draft.data)
    push(edycja ? 'Zapisano zmiany' : 'Dodano wydarzenie')
  }
  async function usun(w: Wydarzenie) {
    if (await confirm(`Usunąć wydarzenie „${w.tytul}”?`)) {
      remove('wydarzenia', w.id)
      push('Usunięto wydarzenie', 'info')
    }
  }
  function przelaczZrobione(w: Wydarzenie, v: boolean) {
    upsert('wydarzenia', { ...w, zrobione: v })
  }

  // ---------- Tydzien do wydruku (pon-nie zawierajacy wybrany dzien) ----------
  const tydzien = useMemo(() => {
    const d = new Date(wybranyDzien)
    const offset = (d.getDay() + 6) % 7
    return Array.from({ length: 7 }, (_, i) => {
      const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate() - offset + i)
      const iso = toISO(dd)
      return { iso, wydarzenia: wgDnia.get(iso) || [] }
    })
  }, [wybranyDzien, wgDnia])

  const shareText = useMemo(() => {
    const linie = dzienWydarzenia.map(
      (w) =>
        `${w.godzina ? w.godzina + ' ' : ''}${typInfo(w.typ).nazwa}: ${w.tytul}${w.adres ? ' (' + w.adres + ')' : ''}`,
    )
    return `Plan dnia ${fmtDate(wybranyDzien)}\n${linie.length ? linie.join('\n') : 'Brak zaplanowanych wydarzeń.'}`
  }, [dzienWydarzenia, wybranyDzien])

  const planNode = () => (
    <PlanTygodniaDoc
      firma={firma}
      logoDataUrl={b.ustawienia.logoDataUrl}
      dni={tydzien}
      b={b}
      wybranyDzien={wybranyDzien}
    />
  )

  return (
    <div>
      <PageHeader
        title="Kalendarz"
        subtitle="Pomiary, montaże, transport i spotkania"
        icon={<CalendarDays size={22} />}
        actions={
          <>
            <PrintSendBar
              getPrintNode={planNode}
              labelPrint="Drukuj plan"
              share={{ title: `Plan dnia ${fmtDate(wybranyDzien)}`, text: shareText }}
            />
            <button className="btn-primary" onClick={nowe}>
              <Plus size={17} /> Dodaj wydarzenie
            </button>
          </>
        }
      />

      {/* Filtry */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select className="max-w-[200px]" value={filtrPracownik} onChange={(e) => setFiltrPracownik(e.target.value)}>
          <option value="">Wszyscy pracownicy</option>
          {b.pracownicy.map((p) => (
            <option key={p.id} value={p.id}>
              {p.imie}
            </option>
          ))}
        </Select>
        <Select className="max-w-[180px]" value={filtrTyp} onChange={(e) => setFiltrTyp(e.target.value)}>
          <option value="">Wszystkie typy</option>
          {TYPY.map((x) => (
            <option key={x.typ} value={x.typ}>
              {x.nazwa}
            </option>
          ))}
        </Select>
        <div className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1">
          {TYPY.map((x) => (
            <span key={x.typ} className="flex items-center gap-1.5 text-[12px] text-stone-500">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: x.kolor }} />
              {x.nazwa}
            </span>
          ))}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        {/* Siatka miesiaca */}
        <Card className="xl:col-span-2">
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[16px] font-display font-semibold capitalize text-ink">
                {fmtMonthYear(`${rok}-${String(mies + 1).padStart(2, '0')}-01`)}
              </h3>
              <div className="flex items-center gap-1.5">
                <button className="btn-ghost !px-2" onClick={poprzedni} aria-label="Poprzedni miesiąc">
                  <ChevronLeft size={18} />
                </button>
                <button className="btn-outline btn-sm" onClick={dzis}>
                  Dziś
                </button>
                <button className="btn-ghost !px-2" onClick={nastepny} aria-label="Następny miesiąc">
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {DNI_SKROT.map((d) => (
                <div
                  key={d}
                  className="pb-1 text-center text-[11px] font-semibold uppercase tracking-wide text-stone-400"
                >
                  {d}
                </div>
              ))}
              {komorki.map((c) => {
                const ev = wgDnia.get(c.iso) || []
                const wybrany = c.iso === wybranyDzien
                return (
                  <button
                    key={c.iso}
                    onClick={() => setWybranyDzien(c.iso)}
                    className={cx(
                      'flex min-h-[76px] flex-col rounded-xl border p-1.5 text-left transition',
                      wybrany ? 'border-brand-500 bg-brand-50' : 'border-stone-100 hover:border-stone-300',
                      !c.wMiesiacu && 'opacity-40',
                    )}
                  >
                    <span
                      className={cx(
                        'mb-1 grid h-6 w-6 place-items-center rounded-full text-[12px] font-semibold',
                        c.dzis ? 'bg-white/10 text-white' : 'text-stone-600',
                      )}
                    >
                      {c.dzien}
                    </span>
                    <div className="flex flex-col gap-0.5 overflow-hidden">
                      {ev.slice(0, 3).map((w) => (
                        <span
                          key={w.id}
                          className={cx(
                            'truncate rounded px-1 py-0.5 text-[10.5px] font-medium text-white',
                            w.zrobione && 'line-through opacity-60',
                          )}
                          style={{ background: typInfo(w.typ).kolor }}
                        >
                          {w.godzina ? `${w.godzina} ` : ''}
                          {w.tytul}
                        </span>
                      ))}
                      {ev.length > 3 && (
                        <span className="px-1 text-[10px] text-stone-400">+{ev.length - 3} więcej</span>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </CardBody>
        </Card>

        {/* Lista wydarzen wybranego dnia */}
        <Card>
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-semibold capitalize text-ink">{dayName(wybranyDzien)}</h3>
                <p className="text-[12.5px] text-stone-500">{fmtDate(wybranyDzien)}</p>
              </div>
              <button className="btn-outline btn-sm" onClick={nowe}>
                <Plus size={15} /> Dodaj
              </button>
            </div>

            {dzienWydarzenia.length === 0 ? (
              <EmptyState
                icon={<CalendarDays size={26} />}
                title="Brak wydarzeń"
                desc="Nie zaplanowano nic na ten dzień."
              />
            ) : (
              <div className="space-y-2.5">
                {dzienWydarzenia.map((w) => {
                  const ti = typInfo(w.typ)
                  const k = b.klienci.find((x) => x.id === w.klientId)
                  const prac = b.pracownicy.find((x) => x.id === w.pracownikId)
                  return (
                    <div
                      key={w.id}
                      className={cx('rounded-2xl border border-stone-200 p-3', w.zrobione && 'bg-stone-25 opacity-70')}
                      style={{ borderLeft: `4px solid ${ti.kolor}` }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge tone={ti.tone}>{ti.nazwa}</Badge>
                            {w.godzina && (
                              <span className="flex items-center gap-1 text-[12px] text-stone-500">
                                <Clock size={12} /> {w.godzina}
                              </span>
                            )}
                          </div>
                          <div className={cx('mt-1 text-[14px] font-semibold text-ink', w.zrobione && 'line-through')}>
                            {w.tytul}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <button className="btn-ghost !px-1.5" onClick={() => edytuj(w)} aria-label="Edytuj">
                            <Pencil size={15} />
                          </button>
                          <button className="btn-ghost !px-1.5 text-red-600" onClick={() => usun(w)} aria-label="Usuń">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-1.5 space-y-1 text-[12.5px] text-stone-500">
                        {k && (
                          <div className="flex items-center gap-1.5">
                            <User size={13} /> {klientNazwa(k)}
                          </div>
                        )}
                        {prac && (
                          <div className="flex items-center gap-1.5">
                            <User size={13} /> {prac.imie}
                          </div>
                        )}
                        {w.adres && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={13} /> {w.adres}
                          </div>
                        )}
                        {w.notatki && <div className="text-stone-400">{w.notatki}</div>}
                      </div>
                      <div className="mt-2 border-t border-stone-100 pt-2">
                        <Toggle checked={w.zrobione} onChange={(v) => przelaczZrobione(w, v)} label="Zrobione" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Modal dodawania / edycji */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={edycja ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}
        footer={
          <>
            <button className="btn-outline" onClick={() => setModalOpen(false)}>
              Anuluj
            </button>
            <button className="btn-primary" onClick={zapisz}>
              {edycja ? 'Zapisz' : 'Dodaj'}
            </button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Data" required>
            <Input type="date" value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })} />
          </Field>
          <Field label="Godzina">
            <Input
              type="time"
              value={draft.godzina || ''}
              onChange={(e) => setDraft({ ...draft, godzina: e.target.value })}
            />
          </Field>
          <Field label="Typ" className="col-span-2">
            <Select value={draft.typ} onChange={(e) => setDraft({ ...draft, typ: e.target.value as WydarzenieTyp })}>
              {TYPY.map((x) => (
                <option key={x.typ} value={x.typ}>
                  {x.nazwa}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tytuł" required className="col-span-2">
            <Input
              value={draft.tytul}
              onChange={(e) => setDraft({ ...draft, tytul: e.target.value })}
              placeholder="np. Pomiar blatów – kuchnia"
            />
          </Field>
          <Field label="Klient" className="col-span-2">
            <Select value={draft.klientId || ''} onChange={(e) => setDraft({ ...draft, klientId: e.target.value })}>
              <option value="">– brak –</option>
              {b.klienci.map((k) => (
                <option key={k.id} value={k.id}>
                  {klientNazwa(k)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Pracownik" className="col-span-2">
            <Select
              value={draft.pracownikId || ''}
              onChange={(e) => setDraft({ ...draft, pracownikId: e.target.value })}
            >
              <option value="">– brak –</option>
              {b.pracownicy.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.imie}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Adres" className="col-span-2">
            <Input
              value={draft.adres || ''}
              onChange={(e) => setDraft({ ...draft, adres: e.target.value })}
              placeholder="Adres realizacji / spotkania"
            />
          </Field>
          <Field label="Notatki" className="col-span-2">
            <Textarea value={draft.notatki || ''} onChange={(e) => setDraft({ ...draft, notatki: e.target.value })} />
          </Field>
        </div>
      </Modal>

      {confirmNode}
    </div>
  )
}

// ============================================================================
// Dokument: plan tygodnia do wydruku (inline doc-sheet)
// ============================================================================
function PlanTygodniaDoc({
  firma,
  logoDataUrl,
  dni,
  b,
  wybranyDzien,
}: {
  firma: import('../lib/types').Firma
  logoDataUrl?: string
  dni: { iso: string; wydarzenia: Wydarzenie[] }[]
  b: import('../lib/types').Baza
  wybranyDzien: string
}) {
  const od = dni[0]?.iso
  const doD = dni[dni.length - 1]?.iso
  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '16pt',
            color: '#12233a',
            letterSpacing: '0.03em',
          }}
        >
          PLAN PRACY
        </div>
        <div style={{ fontSize: '9pt', color: '#6b6459', marginTop: 2 }}>
          Tydzień {fmtDate(od)} – {fmtDate(doD)}
        </div>
      </div>

      {dni.map((d) => (
        <div
          key={d.iso}
          style={{ marginBottom: 8, border: '1px solid #d3cfc2', borderRadius: 8, overflow: 'hidden' }}
          className="avoid-break"
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              background: d.iso === wybranyDzien ? '#12233a' : '#f0ede6',
              color: d.iso === wybranyDzien ? '#fff' : '#12130f',
              padding: '3px 9px',
              fontSize: '8.5pt',
              fontWeight: 700,
              textTransform: 'capitalize',
            }}
          >
            <span>{dayName(d.iso)}</span>
            <span>{fmtDate(d.iso)}</span>
          </div>
          {d.wydarzenia.length === 0 ? (
            <div style={{ padding: '4px 9px', fontSize: '8pt', color: '#a9a496' }}>–</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt' }}>
              <tbody>
                {d.wydarzenia.map((w) => {
                  const ti = typInfo(w.typ)
                  const k = b.klienci.find((x) => x.id === w.klientId)
                  const prac = b.pracownicy.find((x) => x.id === w.pracownikId)
                  return (
                    <tr key={w.id} style={{ borderTop: '1px solid #e6e2d8' }}>
                      <td style={{ padding: '3px 6px', width: 42, fontWeight: 600, color: '#12233a' }}>
                        {w.godzina || '–'}
                      </td>
                      <td style={{ padding: '3px 6px', width: 66 }}>
                        <span style={{ color: ti.kolor, fontWeight: 700 }}>{ti.nazwa}</span>
                      </td>
                      <td style={{ padding: '3px 6px' }}>
                        <span style={{ fontWeight: 600 }}>{w.tytul}</span>
                        {k ? ` · ${klientNazwa(k)}` : ''}
                        {w.adres ? ` · ${w.adres}` : ''}
                        {prac ? ` · ${prac.imie}` : ''}
                        {w.zrobione ? ' · zrobione' : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </DocSheet>
  )
}
