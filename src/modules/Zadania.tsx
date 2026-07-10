import { useState, useMemo } from 'react'
import { ListTodo, Plus, Trash2, Flag, User, Link2, Calendar, Check } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, Field, Input, Textarea, Select, Modal, Badge, EmptyState, useToast, cx } from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { useAuth } from '../components/Auth'
import { DocSheet } from '../documents/DocShell'
import type { Zadanie, ZadanieStatus, ZadaniePriorytet } from '../lib/types'
import { uid } from '../lib/id'
import { nowISO, today, fmtDate } from '../lib/format'
import { klientNazwa } from '../lib/helpers'

const STATUSY: { k: ZadanieStatus; label: string; tone: string }[] = [
  { k: 'do_zrobienia', label: 'Do zrobienia', tone: 'stone' },
  { k: 'w_trakcie', label: 'W trakcie', tone: 'amber' },
  { k: 'zrobione', label: 'Zrobione', tone: 'green' },
]
const PRIORYTETY: { k: ZadaniePriorytet; label: string; tone: string }[] = [
  { k: 'wysoki', label: 'Wysoki', tone: 'red' },
  { k: 'sredni', label: 'Średni', tone: 'amber' },
  { k: 'niski', label: 'Niski', tone: 'stone' },
]

export default function Zadania() {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { user } = useAuth()
  const montaz = user?.rola === 'montazysta'

  const [edycja, setEdycja] = useState<Zadanie | null>(null)
  const [tylkoMoje, setTylkoMoje] = useState(montaz)
  const firma = useStore((s) => s.aktywnaFirma)()

  // lista osob do przypisania (uzytkownicy + zespol)
  const osoby = useMemo(() => {
    const u = b.uzytkownicy.map((x) => ({ id: x.id, nazwa: x.imie }))
    const p = b.pracownicy.map((x) => ({ id: x.id, nazwa: `${x.imie} (zespół)` }))
    return [...u, ...p]
  }, [b.uzytkownicy, b.pracownicy])
  const nazwaOsoby = (id?: string) => osoby.find((o) => o.id === id)?.nazwa || '—'

  const widoczne = b.zadania.filter((z) => !tylkoMoje || z.przypisanyDo === user?.id)

  function nowe() {
    setEdycja({
      id: uid('zad'),
      tytul: '',
      priorytet: 'sredni',
      status: 'do_zrobienia',
      termin: today(),
      przypisanyDo: montaz ? user?.id : undefined,
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    })
  }
  function zapisz(z: Zadanie) {
    upsert('zadania', { ...z, zaktualizowano: nowISO() })
    setEdycja(null)
    push('Zapisano zadanie')
  }
  function ustawStatus(z: Zadanie, status: ZadanieStatus) {
    upsert('zadania', { ...z, status, zaktualizowano: nowISO() })
  }

  return (
    <div>
      <PageHeader
        title="Zadania"
        subtitle={montaz ? 'Twoje zadania i zlecenia' : 'Przydzielaj pracę zespołowi i śledź postęp'}
        icon={<ListTodo size={22} />}
        actions={
          <>
            {!montaz && (
              <button
                className={cx('btn-outline', tylkoMoje && '!border-brand-400 !text-brand-700')}
                onClick={() => setTylkoMoje((v) => !v)}
              >
                <User size={16} /> Moje
              </button>
            )}
            <PrintSendBar
              getPrintNode={() => <ZadaniaDruk zadania={widoczne} nazwaOsoby={nazwaOsoby} firma={firma} />}
              share={{ title: 'Lista zadań AMICO', text: widoczne.map((z) => `• ${z.tytul} — ${nazwaOsoby(z.przypisanyDo)} (${fmtDate(z.termin)})`).join('\n') }}
              size="sm"
            />
            <button className="btn-primary" onClick={nowe}>
              <Plus size={17} /> Nowe zadanie
            </button>
          </>
        }
      />

      {widoczne.length === 0 ? (
        <EmptyState icon={<ListTodo size={26} />} title="Brak zadań" desc="Dodaj pierwsze zadanie i przypisz je do osoby z zespołu." action={<button className="btn-primary" onClick={nowe}><Plus size={16} /> Nowe zadanie</button>} />
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          {STATUSY.map((st) => {
            const kol = widoczne.filter((z) => z.status === st.k)
            return (
              <div key={st.k} className="rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3">
                <div className="mb-2.5 flex items-center justify-between px-1">
                  <span className="flex items-center gap-2 text-[13px] font-semibold text-stone-300">
                    <Badge tone={st.tone as any}>{kol.length}</Badge> {st.label}
                  </span>
                </div>
                <div className="space-y-2">
                  {kol.map((z) => {
                    const pr = PRIORYTETY.find((p) => p.k === z.priorytet)!
                    const zl = b.zlecenia.find((x) => x.id === z.zlecenieId)
                    const kl = b.klienci.find((x) => x.id === z.klientId)
                    const spozniony = z.termin && z.status !== 'zrobione' && z.termin < today()
                    return (
                      <div key={z.id} className="card card-pad !p-3.5 cursor-pointer" onClick={() => setEdycja(z)}>
                        <div className="flex items-start justify-between gap-2">
                          <span className="text-[14px] font-medium text-ink leading-snug">{z.tytul}</span>
                          <span className={cx('mt-0.5 shrink-0', `text-${pr.tone === 'red' ? 'red' : pr.tone === 'amber' ? 'amber' : 'stone'}-400`)}>
                            <Flag size={14} />
                          </span>
                        </div>
                        {z.opis && <p className="mt-1 line-clamp-2 text-[12.5px] text-stone-500">{z.opis}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11.5px] text-stone-400">
                          <span className="inline-flex items-center gap-1"><User size={12} /> {nazwaOsoby(z.przypisanyDo)}</span>
                          {z.termin && (
                            <span className={cx('inline-flex items-center gap-1', spozniony && 'text-red-400')}>
                              <Calendar size={12} /> {fmtDate(z.termin)}
                            </span>
                          )}
                          {zl && <span className="inline-flex items-center gap-1"><Link2 size={12} /> {zl.numer}</span>}
                          {kl && !zl && <span className="inline-flex items-center gap-1"><Link2 size={12} /> {klientNazwa(kl)}</span>}
                        </div>
                        <div className="mt-2.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
                          {STATUSY.filter((s) => s.k !== z.status).map((s) => (
                            <button key={s.k} onClick={() => ustawStatus(z, s.k)} className="rounded-md border border-white/10 px-2 py-1 text-[11px] text-stone-400 hover:bg-white/5 hover:text-white">
                              → {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {edycja && (
        <EdytorZadania
          z={edycja}
          osoby={osoby}
          zlecenia={b.zlecenia.map((x) => ({ id: x.id, label: `${x.numer} · ${x.tytul}` }))}
          klienci={b.klienci.map((x) => ({ id: x.id, label: klientNazwa(x) }))}
          onClose={() => setEdycja(null)}
          onZapisz={zapisz}
          onUsun={() => {
            remove('zadania', edycja.id)
            setEdycja(null)
            push('Usunięto zadanie', 'info')
          }}
        />
      )}
    </div>
  )
}

function EdytorZadania({
  z,
  osoby,
  zlecenia,
  klienci,
  onClose,
  onZapisz,
  onUsun,
}: {
  z: Zadanie
  osoby: { id: string; nazwa: string }[]
  zlecenia: { id: string; label: string }[]
  klienci: { id: string; label: string }[]
  onClose: () => void
  onZapisz: (z: Zadanie) => void
  onUsun: () => void
}) {
  const [d, setD] = useState<Zadanie>(z)
  const set = (p: Partial<Zadanie>) => setD({ ...d, ...p })
  const istnieje = z.tytul !== ''
  return (
    <Modal
      open
      onClose={onClose}
      title={istnieje ? 'Zadanie' : 'Nowe zadanie'}
      size="md"
      footer={
        <>
          {istnieje && (
            <button className="btn-ghost text-red-400 mr-auto" onClick={onUsun}>
              <Trash2 size={16} /> Usuń
            </button>
          )}
          <button className="btn-ghost" onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={() => d.tytul.trim() && onZapisz(d)}>
            <Check size={16} /> Zapisz
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Tytuł zadania" required>
          <Input value={d.tytul} onChange={(e) => set({ tytul: e.target.value })} placeholder="np. Pomiar u klienta – ul. Piotrkowska" autoFocus />
        </Field>
        <Field label="Opis">
          <Textarea rows={2} value={d.opis || ''} onChange={(e) => set({ opis: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Przypisz do">
            <Select value={d.przypisanyDo || ''} onChange={(e) => set({ przypisanyDo: e.target.value || undefined })}>
              <option value="">— nikt —</option>
              {osoby.map((o) => (
                <option key={o.id} value={o.id}>{o.nazwa}</option>
              ))}
            </Select>
          </Field>
          <Field label="Priorytet">
            <Select value={d.priorytet} onChange={(e) => set({ priorytet: e.target.value as ZadaniePriorytet })}>
              {PRIORYTETY.map((p) => (
                <option key={p.k} value={p.k}>{p.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Termin">
            <Input type="date" value={d.termin || ''} onChange={(e) => set({ termin: e.target.value })} />
          </Field>
          <Field label="Godzina">
            <Input type="time" value={d.godzina || ''} onChange={(e) => set({ godzina: e.target.value })} />
          </Field>
          <Field label="Zlecenie">
            <Select value={d.zlecenieId || ''} onChange={(e) => set({ zlecenieId: e.target.value || undefined })}>
              <option value="">— brak —</option>
              {zlecenia.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Klient">
            <Select value={d.klientId || ''} onChange={(e) => set({ klientId: e.target.value || undefined })}>
              <option value="">— brak —</option>
              {klienci.map((x) => (
                <option key={x.id} value={x.id}>{x.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Status" className="col-span-2">
            <Select value={d.status} onChange={(e) => set({ status: e.target.value as ZadanieStatus })}>
              {STATUSY.map((s) => (
                <option key={s.k} value={s.k}>{s.label}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>
    </Modal>
  )
}

function ZadaniaDruk({ zadania, nazwaOsoby, firma }: { zadania: Zadanie[]; nazwaOsoby: (id?: string) => string; firma: any }) {
  return (
    <DocSheet firma={firma}>
      <h1 style={{ textAlign: 'center', fontSize: '15pt', fontWeight: 600, marginBottom: 12 }}>Lista zadań</h1>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#f0ede6' }}>
            <th style={cellH}>Zadanie</th>
            <th style={cellH}>Osoba</th>
            <th style={cellH}>Termin</th>
            <th style={cellH}>Priorytet</th>
            <th style={cellH}>Status</th>
          </tr>
        </thead>
        <tbody>
          {zadania.map((z) => (
            <tr key={z.id}>
              <td style={cell}>{z.tytul}</td>
              <td style={cell}>{nazwaOsoby(z.przypisanyDo)}</td>
              <td style={cell}>{fmtDate(z.termin)}</td>
              <td style={cell}>{z.priorytet}</td>
              <td style={cell}>{z.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </DocSheet>
  )
}
const cellH: React.CSSProperties = { border: '1px solid #d3cfc2', padding: '4px 6px', textAlign: 'left', fontWeight: 700, fontSize: '8pt' }
const cell: React.CSSProperties = { border: '1px solid #d3cfc2', padding: '4px 6px' }
