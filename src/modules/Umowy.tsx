import { useState } from 'react'
import { useParams, useNavigate, Navigate, Link } from 'react-router-dom'
import {
  FileSignature,
  Plus,
  Trash2,
  ArrowLeft,
  ChevronRight,
  PenLine,
  Building2,
  User,
  Eraser,
} from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  SectionCard,
  Field,
  Input,
  Textarea,
  Select,
  SearchInput,
  Badge,
  EmptyState,
  Modal,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { SignatureField, SignatureModal } from '../components/SignaturePad'
import { UmowaDoc } from '../documents/Umowa'
import { klientNazwa, klientAdres, UMOWA_TYPY, umowaStatusInfo } from '../lib/helpers'
import { fmtPLN, fmtDate, today, nowISO, parseNum, kwotaSlownie } from '../lib/format'
import { uid } from '../lib/id'
import type { Umowa, UmowaTyp, UmowaStatus } from '../lib/types'

const STATUSY: UmowaStatus[] = ['szkic', 'do_podpisu', 'podpisana', 'anulowana']

function typNazwa(t: UmowaTyp): string {
  return UMOWA_TYPY.find((x) => x.typ === t)?.nazwa || t
}

// ============================================================================
// Modul UMOWY – lista + edytor (route /umowy oraz /umowy/:id)
// ============================================================================
export default function Umowy() {
  const { id } = useParams()
  const b = useStore((s) => s.baza)

  const stored = id ? b.umowy.find((u) => u.id === id) : undefined
  if (id && !stored) return <Navigate to="/umowy" replace />
  if (stored) return <Edytor key={stored.id} umowaId={stored.id} />
  return <Lista />
}

// ============================================================================
// LISTA UMOW
// ============================================================================
function Lista() {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const kolejnyNumer = useStore((s) => s.kolejnyNumer)
  const firma = useStore((s) => s.aktywnaFirma)()
  const nav = useNavigate()
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [szukaj, setSzukaj] = useState('')
  const [filtrTyp, setFiltrTyp] = useState<'wszystkie' | UmowaTyp>('wszystkie')
  const [filtrStatus, setFiltrStatus] = useState<'wszystkie' | UmowaStatus>('wszystkie')
  const [pickerOpen, setPickerOpen] = useState(false)

  const q = szukaj.trim().toLowerCase()
  const lista = b.umowy
    .filter((u) => (filtrTyp === 'wszystkie' ? true : u.typ === filtrTyp))
    .filter((u) => (filtrStatus === 'wszystkie' ? true : u.status === filtrStatus))
    .filter((u) =>
      !q
        ? true
        : [u.numer, u.zamawiajacyNazwa, typNazwa(u.typ)].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
    .slice()
    .sort((a, c) => c.utworzono.localeCompare(a.utworzono))

  const utworz = (typ: UmowaTyp) => {
    const nowa: Umowa = {
      id: uid('um'),
      numer: kolejnyNumer('UM'),
      typ,
      firmaId: firma.id,
      miejscowoscZawarcia: firma.miasto || '',
      dataZawarcia: today(),
      pola: {},
      status: 'szkic',
      zalaczniki: [],
      utworzono: nowISO(),
      zaktualizowano: nowISO(),
    }
    upsert('umowy', nowa)
    setPickerOpen(false)
    nav(`/umowy/${nowa.id}`)
  }

  const usun = async (u: Umowa) => {
    if (await confirm(`Usunąć umowę ${u.numer}? Tej operacji nie można cofnąć.`)) {
      remove('umowy', u.id)
      push('Umowa usunięta', 'info')
    }
  }

  return (
    <div>
      <PageHeader
        title="Umowy"
        subtitle={`${b.umowy.length} umów · podmiot: ${firma.nazwa}`}
        icon={<FileSignature size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setPickerOpen(true)}>
            <Plus size={17} /> Nowa umowa
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-3">
        <div className="max-w-md">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj po numerze lub zamawiającym…" />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={filtrTyp === 'wszystkie'} onClick={() => setFiltrTyp('wszystkie')}>
            Wszystkie typy
          </Chip>
          {UMOWA_TYPY.map((t) => (
            <Chip key={t.typ} active={filtrTyp === t.typ} onClick={() => setFiltrTyp(t.typ as UmowaTyp)}>
              {t.nazwa}
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Chip active={filtrStatus === 'wszystkie'} onClick={() => setFiltrStatus('wszystkie')}>
            Każdy status
          </Chip>
          {STATUSY.map((s) => (
            <Chip key={s} active={filtrStatus === s} onClick={() => setFiltrStatus(s)}>
              {umowaStatusInfo(s).label}
            </Chip>
          ))}
        </div>
      </div>

      {lista.length === 0 ? (
        <EmptyState
          icon={<FileSignature size={26} />}
          title="Brak umów"
          desc="Utwórz pierwszą umowę — wybierz typ, uzupełnij dane i zbierz podpisy."
          action={
            <button className="btn-primary" onClick={() => setPickerOpen(true)}>
              <Plus size={17} /> Nowa umowa
            </button>
          }
        />
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead>
                <tr>
                  <th className="th text-left">Numer</th>
                  <th className="th text-left">Typ</th>
                  <th className="th text-left">Zamawiający</th>
                  <th className="th">Data</th>
                  <th className="th text-right">Wynagrodzenie</th>
                  <th className="th">Status</th>
                  <th className="th"></th>
                </tr>
              </thead>
              <tbody>
                {lista.map((u) => {
                  const si = umowaStatusInfo(u.status)
                  return (
                    <tr
                      key={u.id}
                      className="row-hover cursor-pointer"
                      onClick={() => nav(`/umowy/${u.id}`)}
                    >
                      <td className="td font-semibold text-brand-700">{u.numer}</td>
                      <td className="td">{typNazwa(u.typ)}</td>
                      <td className="td">{u.zamawiajacyNazwa || '—'}</td>
                      <td className="td text-center whitespace-nowrap">{fmtDate(u.dataZawarcia) || '—'}</td>
                      <td className="td text-right whitespace-nowrap">
                        {u.wynagrodzenieBrutto != null ? fmtPLN(u.wynagrodzenieBrutto) : '—'}
                      </td>
                      <td className="td text-center">
                        <Badge tone={si.tone as any}>{si.label}</Badge>
                      </td>
                      <td className="td text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          className="btn-ghost !px-2 text-stone-400 hover:text-red-600"
                          onClick={() => usun(u)}
                          title="Usuń"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Wybor typu umowy */}
      <Modal open={pickerOpen} onClose={() => setPickerOpen(false)} title="Nowa umowa — wybierz typ" size="lg">
        <div className="grid gap-2 sm:grid-cols-2">
          {UMOWA_TYPY.map((t) => (
            <button
              key={t.typ}
              onClick={() => utworz(t.typ as UmowaTyp)}
              className="flex items-start gap-3 rounded-2xl border border-stone-200 p-4 text-left transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-700">
                <FileSignature size={18} />
              </span>
              <span className="min-w-0">
                <span className="block text-[14px] font-semibold text-ink">{t.nazwa}</span>
                <span className="mt-0.5 block text-[12.5px] text-stone-500">{t.opis}</span>
              </span>
              <ChevronRight size={18} className="ml-auto mt-1 shrink-0 text-stone-300" />
            </button>
          ))}
        </div>
      </Modal>

      {confirmNode}
    </div>
  )
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1.5 text-[12.5px] font-medium transition',
        active ? 'border-brand-700 bg-white/10 text-white' : 'border-white/10 bg-white/[0.03] text-stone-600 hover:bg-stone-50',
      )}
    >
      {children}
    </button>
  )
}

// ============================================================================
// EDYTOR UMOWY
// ============================================================================
function Edytor({ umowaId }: { umowaId: string }) {
  const u = useStore((s) => s.baza.umowy.find((x) => x.id === umowaId))
  const firmy = useStore((s) => s.baza.firmy)
  const klienci = useStore((s) => s.baza.klienci)
  const ustawienia = useStore((s) => s.baza.ustawienia)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const nav = useNavigate()
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()
  const [sigOpen, setSigOpen] = useState<null | 'zamawiajacy' | 'wykonawca'>(null)

  if (!u) return <Navigate to="/umowy" replace />

  const firmaUmowy = firmy.find((f) => f.id === u.firmaId) || firmy[0]

  const set = (patch: Partial<Umowa>) => {
    upsert('umowy', { ...u, ...patch, zaktualizowano: nowISO() })
  }

  const wybierzKlienta = (kid: string) => {
    if (!kid) {
      set({ klientId: undefined })
      return
    }
    const k = klienci.find((x) => x.id === kid)
    if (!k) return
    set({
      klientId: k.id,
      zamawiajacyNazwa: klientNazwa(k),
      zamawiajacyAdres: klientAdres(k),
      zamawiajacyPesel: k.pesel || '',
      zamawiajacyNip: k.nip || '',
      zamawiajacyTelefon: k.telefon || '',
      zamawiajacyEmail: k.email || '',
    })
  }

  const usun = async () => {
    if (await confirm(`Usunąć umowę ${u.numer}? Tej operacji nie można cofnąć.`)) {
      remove('umowy', u.id)
      push('Umowa usunięta', 'info')
      nav('/umowy')
    }
  }

  const pokazPowierzchnia = u.typ === 'dzielo_8_23' || u.typ === 'dzielo_8'
  const si = umowaStatusInfo(u.status)

  const share = {
    title: `${typNazwa(u.typ)} ${u.numer}`,
    text: `Przesyłam ${typNazwa(u.typ).toLowerCase()} nr ${u.numer}${u.zamawiajacyNazwa ? ` dla ${u.zamawiajacyNazwa}` : ''}. W razie pytań pozostaję do dyspozycji.`,
    to: u.zamawiajacyEmail,
    phone: u.zamawiajacyTelefon,
  }

  return (
    <div>
      <PageHeader
        title={`${typNazwa(u.typ)}`}
        subtitle={`${u.numer} · zawarta ${fmtDate(u.dataZawarcia) || '—'}`}
        icon={<FileSignature size={22} />}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link to="/umowy" className="btn-ghost">
              <ArrowLeft size={17} /> Umowy
            </Link>
            <Badge tone={si.tone as any}>{si.label}</Badge>
            <PrintSendBar
              getPrintNode={() => (
                <UmowaDoc
                  u={u}
                  firma={firmaUmowy}
                  klauzulaPodpis={ustawienia.klauzulaPodpis}
                  klauzulaRodo={ustawienia.klauzulaRodo}
                  logoDataUrl={ustawienia.logoDataUrl}
                />
              )}
              share={share}
            />
          </div>
        }
      />

      <div className="grid gap-5 lg:grid-cols-2">
        {/* --- Kolumna 1 --- */}
        <div className="space-y-5">
          <SectionCard title="Podstawowe dane" icon={<FileSignature size={17} />}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Typ umowy">
                <Select value={u.typ} onChange={(e) => set({ typ: e.target.value as UmowaTyp })}>
                  {UMOWA_TYPY.map((t) => (
                    <option key={t.typ} value={t.typ}>
                      {t.nazwa}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={u.status} onChange={(e) => set({ status: e.target.value as UmowaStatus })}>
                  {STATUSY.map((s) => (
                    <option key={s} value={s}>
                      {umowaStatusInfo(s).label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Miejscowość zawarcia">
                <Input
                  value={u.miejscowoscZawarcia || ''}
                  onChange={(e) => set({ miejscowoscZawarcia: e.target.value })}
                  placeholder="np. Łódź"
                />
              </Field>
              <Field label="Data zawarcia">
                <Input type="date" value={u.dataZawarcia || ''} onChange={(e) => set({ dataZawarcia: e.target.value })} />
              </Field>
            </div>
            <Field label="Podmiot (Wykonawca)" className="mt-3">
              <Select value={u.firmaId} onChange={(e) => set({ firmaId: e.target.value })}>
                {firmy.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.nazwa}
                  </option>
                ))}
              </Select>
            </Field>
          </SectionCard>

          <SectionCard title="Zamawiający" icon={<User size={17} />} desc="Uzupełnij z bazy klientów lub wpisz ręcznie">
            <Field label="Wybierz z bazy klientów">
              <Select value={u.klientId || ''} onChange={(e) => wybierzKlienta(e.target.value)}>
                <option value="">— wpis ręczny —</option>
                {klienci.map((k) => (
                  <option key={k.id} value={k.id}>
                    {klientNazwa(k)}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="mt-3 grid gap-3">
              <Field label="Nazwa / imię i nazwisko">
                <Input
                  value={u.zamawiajacyNazwa || ''}
                  onChange={(e) => set({ zamawiajacyNazwa: e.target.value })}
                  placeholder="np. Jan Kowalski"
                />
              </Field>
              <Field label="Adres">
                <Input
                  value={u.zamawiajacyAdres || ''}
                  onChange={(e) => set({ zamawiajacyAdres: e.target.value })}
                  placeholder="ul. Przykładowa 1, 00-000 Miasto"
                />
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="PESEL">
                  <Input value={u.zamawiajacyPesel || ''} onChange={(e) => set({ zamawiajacyPesel: e.target.value })} />
                </Field>
                <Field label="NIP">
                  <Input value={u.zamawiajacyNip || ''} onChange={(e) => set({ zamawiajacyNip: e.target.value })} />
                </Field>
                <Field label="Telefon">
                  <Input value={u.zamawiajacyTelefon || ''} onChange={(e) => set({ zamawiajacyTelefon: e.target.value })} />
                </Field>
                <Field label="E-mail">
                  <Input
                    type="email"
                    value={u.zamawiajacyEmail || ''}
                    onChange={(e) => set({ zamawiajacyEmail: e.target.value })}
                  />
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>

        {/* --- Kolumna 2 --- */}
        <div className="space-y-5">
          <SectionCard title="Przedmiot i realizacja" icon={<Building2 size={17} />}>
            <div className="grid gap-3">
              <Field label="Adres realizacji">
                <Input
                  value={u.adresRealizacji || ''}
                  onChange={(e) => set({ adresRealizacji: e.target.value })}
                  placeholder="Miejsce montażu / wykonania prac"
                />
              </Field>
              <Field label="Przedmiot umowy">
                <Textarea
                  value={u.przedmiot || ''}
                  onChange={(e) => set({ przedmiot: e.target.value })}
                  placeholder="np. blaty kuchenne z konglomeratu, parapety…"
                />
              </Field>
              {pokazPowierzchnia && (
                <Field label="Powierzchnia (m²)" hint="Istotna przy stawce 8/23% VAT (limit 300/150 m²)">
                  <Input
                    value={u.powierzchniaM2 || ''}
                    onChange={(e) => set({ powierzchniaM2: e.target.value })}
                    placeholder="np. 180"
                  />
                </Field>
              )}
            </div>
          </SectionCard>

          <SectionCard title="Terminy">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Termin rozpoczęcia">
                <Input
                  type="date"
                  value={u.terminRozpoczecia || ''}
                  onChange={(e) => set({ terminRozpoczecia: e.target.value })}
                />
              </Field>
              <Field label="Termin zakończenia">
                <Input
                  type="date"
                  value={u.terminZakonczenia || ''}
                  onChange={(e) => set({ terminZakonczenia: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Deklarowany termin ustawienia mebli / przygotowania podłoża" className="mt-3">
              <Input
                value={u.terminUstawieniaMebli || ''}
                onChange={(e) => set({ terminUstawieniaMebli: e.target.value })}
                placeholder="np. do 3 tygodni od podpisania"
              />
            </Field>
          </SectionCard>

          <SectionCard title="Wynagrodzenie">
            <div className="grid gap-3">
              <Field label="Wynagrodzenie brutto (zł)">
                <KwotaInput value={u.wynagrodzenieBrutto} onChange={(n) => set({ wynagrodzenieBrutto: n })} />
                {u.wynagrodzenieBrutto != null && (
                  <span className="mt-1 block text-[12px] italic text-stone-500">
                    słownie: {kwotaSlownie(u.wynagrodzenieBrutto)}
                  </span>
                )}
              </Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Zadatek (zł)">
                  <KwotaInput value={u.zadatek} onChange={(n) => set({ zadatek: n })} />
                </Field>
                <Field label="Próg prac dodatkowych (zł)" hint="Bez zgody Zamawiającego">
                  <KwotaInput value={u.progPracDodatkowych} onChange={(n) => set({ progPracDodatkowych: n })} />
                </Field>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* --- Podpisy --- */}
      <SectionCard title="Podpisy" icon={<PenLine size={17} />} className="mt-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <SignatureField
              sig={u.podpisZamawiajacego}
              onSign={() => setSigOpen('zamawiajacy')}
              label="Zamawiający"
              rola="Zamawiający"
            />
            {u.podpisZamawiajacego && (
              <button
                className="btn-ghost mt-2 text-[12.5px] text-stone-400 hover:text-red-600"
                onClick={() => set({ podpisZamawiajacego: undefined })}
              >
                <Eraser size={14} /> Usuń podpis
              </button>
            )}
          </div>
          <div>
            <SignatureField
              sig={u.podpisWykonawcy}
              onSign={() => setSigOpen('wykonawca')}
              label="Wykonawca"
              rola="Wykonawca"
            />
            {u.podpisWykonawcy && (
              <button
                className="btn-ghost mt-2 text-[12.5px] text-stone-400 hover:text-red-600"
                onClick={() => set({ podpisWykonawcy: undefined })}
              >
                <Eraser size={14} /> Usuń podpis
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {/* --- Stopka akcji --- */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <button className="btn-danger" onClick={usun}>
          <Trash2 size={16} /> Usuń umowę
        </button>
        <PrintSendBar
          getPrintNode={() => (
            <UmowaDoc
              u={u}
              firma={firmaUmowy}
              klauzulaPodpis={ustawienia.klauzulaPodpis}
              klauzulaRodo={ustawienia.klauzulaRodo}
              logoDataUrl={ustawienia.logoDataUrl}
            />
          )}
          share={share}
        />
      </div>

      <SignatureModal
        open={sigOpen !== null}
        onClose={() => setSigOpen(null)}
        onSave={(sig) =>
          set(sigOpen === 'zamawiajacy' ? { podpisZamawiajacego: sig } : { podpisWykonawcy: sig })
        }
        rola={sigOpen === 'zamawiajacy' ? 'Zamawiający' : 'Wykonawca'}
        domyslnyPodpisujacy={sigOpen === 'zamawiajacy' ? u.zamawiajacyNazwa || '' : firmaUmowy.wlasciciel || ''}
        dokumentId={u.id}
        klauzula={ustawienia.klauzulaPodpis}
      />

      {confirmNode}
    </div>
  )
}

// Pole kwoty z wlasnym buforem tekstu (obsluga przecinka / czyszczenia)
function KwotaInput({ value, onChange }: { value?: number; onChange: (n: number | undefined) => void }) {
  const [txt, setTxt] = useState(value != null ? String(value).replace('.', ',') : '')
  return (
    <Input
      inputMode="decimal"
      value={txt}
      placeholder="0,00"
      onChange={(e) => {
        const v = e.target.value
        setTxt(v)
        onChange(v.trim() ? parseNum(v) : undefined)
      }}
    />
  )
}
