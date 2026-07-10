import { useEffect, useRef, useState } from 'react'
import {
  Settings,
  Building2,
  Users,
  Image as ImageIcon,
  FileText,
  Database,
  HardDrive,
  Trash2,
  Plus,
  Download,
  Upload,
  ShieldCheck,
  Star,
  AlertTriangle,
  Check,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { requestPersistence, storageInfo } from '../lib/db'
import { PageHeader, SectionCard, Field, Input, Textarea, Select, Toggle, Badge, useToast, useConfirm, cx } from '../components/ui'
import { downloadFile } from '../lib/print'
import { today, validNRB, fmtKonto, validNIP, fmtNIP } from '../lib/format'
import { uid } from '../lib/id'
import type { Firma, Pracownik, VatRate } from '../lib/types'
import { UzytkownicyPanel } from '../components/UzytkownicyPanel'

const VAT_STAWKI: VatRate[] = [0, 5, 8, 23]

const ROLE: { rola: Pracownik['rola']; nazwa: string }[] = [
  { rola: 'montaz', nazwa: 'Montaż' },
  { rola: 'pomiar', nazwa: 'Pomiar' },
  { rola: 'biuro', nazwa: 'Biuro' },
  { rola: 'kierownik', nazwa: 'Kierownik' },
  { rola: 'transport', nazwa: 'Transport' },
  { rola: 'inny', nazwa: 'Inny' },
]

function fmtBytes(n?: number): string {
  if (n === undefined || n === null) return '—'
  const mb = n / (1024 * 1024)
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  if (mb >= 1) return `${mb.toFixed(1)} MB`
  return `${(n / 1024).toFixed(0)} KB`
}

export default function Ustawienia() {
  const b = useStore((s) => s.baza)
  const updateUstawienia = useStore((s) => s.updateUstawienia)
  const setAktywnaFirma = useStore((s) => s.setAktywnaFirma)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const eksportJSON = useStore((s) => s.eksportJSON)
  const importJSON = useStore((s) => s.importJSON)
  const resetDemo = useStore((s) => s.resetDemo)
  const wyczyscWszystko = useStore((s) => s.wyczyscWszystko)

  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const u = b.ustawienia
  const importRef = useRef<HTMLInputElement>(null)
  const logoRef = useRef<HTMLInputElement>(null)

  const [info, setInfo] = useState<{ persisted: boolean; usage?: number; quota?: number } | null>(null)
  useEffect(() => {
    storageInfo().then(setInfo).catch(() => {})
  }, [])

  // ---------- Logo ----------
  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      push('Wybierz plik graficzny', 'err')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      updateUstawienia({ logoDataUrl: String(reader.result) })
      push('Zapisano logo')
    }
    reader.onerror = () => push('Nie udało się wczytać pliku', 'err')
    reader.readAsDataURL(file)
  }

  // ---------- Kopia ----------
  function onExport() {
    downloadFile(`AMICO_kopia_${today()}.json`, eksportJSON())
    push('Kopia zapasowa wyeksportowana')
  }
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const ok = importJSON(String(reader.result))
      push(ok ? 'Kopia wczytana — dane zostały zastąpione' : 'Nieprawidłowy plik kopii', ok ? 'ok' : 'err')
    }
    reader.onerror = () => push('Nie udało się odczytać pliku', 'err')
    reader.readAsText(file)
  }

  // ---------- Pamiec ----------
  async function onPersist() {
    const ok = await requestPersistence()
    push(ok ? 'Pamięć trwała włączona' : 'Przeglądarka nie potwierdziła pamięci trwałej', ok ? 'ok' : 'info')
    storageInfo().then(setInfo).catch(() => {})
  }

  // ---------- Dane ----------
  async function onDemo() {
    if (!(await confirm('Załadować dane demonstracyjne? Bieżące dane zostaną zastąpione przykładowymi.'))) return
    await resetDemo()
    push('Załadowano dane demo')
  }
  async function onWyczysc() {
    if (!(await confirm('Wyczyścić wszystkie dane? Ta operacja jest nieodwracalna. Zalecane jest wcześniejsze zrobienie kopii zapasowej.'))) return
    await wyczyscWszystko()
    push('Wyczyszczono wszystkie dane', 'info')
  }

  // ---------- Zespol ----------
  function dodajPracownika() {
    const nowy: Pracownik = { id: uid('pr'), imie: '', rola: 'montaz', aktywny: true }
    upsert('pracownicy', nowy)
  }

  // ---------- Uwagi wyceny ----------
  const uwagi = u.standardoweUwagiWyceny
  function setUwaga(i: number, v: string) {
    updateUstawienia({ standardoweUwagiWyceny: uwagi.map((x, idx) => (idx === i ? v : x)) })
  }
  function usunUwage(i: number) {
    updateUstawienia({ standardoweUwagiWyceny: uwagi.filter((_, idx) => idx !== i) })
  }
  function dodajUwage() {
    updateUstawienia({ standardoweUwagiWyceny: [...uwagi, ''] })
  }

  return (
    <div>
      <PageHeader title="Ustawienia" subtitle="Podmioty, zespół, teksty i kopia zapasowa" icon={<Settings size={22} />} />

      <div className="space-y-6">
        {/* 1. Podmioty */}
        <SectionCard title="Podmioty (firmy)" icon={<Building2 size={18} />} desc="Dane obu firm wykorzystywane na dokumentach. Zaznacz podmiot aktywny.">
          <div className="grid gap-4 lg:grid-cols-2">
            {b.firmy.map((f) => (
              <FirmaEditor
                key={f.id}
                firma={f}
                aktywna={f.id === u.aktywnaFirmaId}
                onSet={(fx) => upsert('firmy', fx)}
                onAktywna={() => {
                  setAktywnaFirma(f.id)
                  push(`Aktywny podmiot: ${f.nazwa}`)
                }}
              />
            ))}
          </div>
        </SectionCard>

        {/* 2. Zespol */}
        <SectionCard
          title="Zespół"
          icon={<Users size={18} />}
          desc="Osoby przypisywane do pomiarów, montaży i zdarzeń."
          actions={
            <button className="btn-outline" onClick={dodajPracownika}>
              <Plus size={16} /> Dodaj
            </button>
          }
        >
          {b.pracownicy.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-stone-400">Brak osób — dodaj pierwszą.</p>
          ) : (
            <div className="space-y-2">
              {b.pracownicy.map((p) => (
                <div key={p.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-stone-200 p-2.5">
                  <Input
                    className="min-w-[140px] flex-1"
                    placeholder="Imię / nazwa"
                    value={p.imie}
                    onChange={(e) => upsert('pracownicy', { ...p, imie: e.target.value })}
                  />
                  <Select
                    className="w-auto"
                    value={p.rola}
                    onChange={(e) => upsert('pracownicy', { ...p, rola: e.target.value as Pracownik['rola'] })}
                  >
                    {ROLE.map((r) => (
                      <option key={r.rola} value={r.rola}>
                        {r.nazwa}
                      </option>
                    ))}
                  </Select>
                  <Input
                    className="w-[150px]"
                    placeholder="Telefon"
                    value={p.telefon || ''}
                    onChange={(e) => upsert('pracownicy', { ...p, telefon: e.target.value })}
                  />
                  <Toggle checked={p.aktywny} onChange={(v) => upsert('pracownicy', { ...p, aktywny: v })} label="Aktywny" />
                  <button className="btn-ghost !px-2 text-red-600" onClick={() => remove('pracownicy', p.id)} title="Usuń">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        {/* 2b. Konto, zabezpieczenia i uzytkownicy */}
        <UzytkownicyPanel />

        {/* 3. Logo */}
        <SectionCard title="Logo" icon={<ImageIcon size={18} />} desc="Wyświetlane w nagłówku dokumentów (druk / PDF).">
          <div className="flex flex-wrap items-center gap-5">
            <div className="grid h-24 w-40 place-items-center rounded-xl border border-dashed border-stone-300 bg-stone-25 p-2">
              {u.logoDataUrl ? (
                <img src={u.logoDataUrl} alt="Logo" className="max-h-full max-w-full object-contain" />
              ) : (
                <span className="text-[12px] text-stone-400">Brak logo</span>
              )}
            </div>
            <div className="flex flex-col gap-2">
              <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={onLogo} />
              <button className="btn-outline" onClick={() => logoRef.current?.click()}>
                <Upload size={16} /> Wgraj logo
              </button>
              {u.logoDataUrl && (
                <button
                  className="btn-ghost text-red-600"
                  onClick={() => {
                    updateUstawienia({ logoDataUrl: undefined })
                    push('Usunięto logo', 'info')
                  }}
                >
                  <Trash2 size={16} /> Usuń logo
                </button>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 4. Teksty i klauzule */}
        <SectionCard title="Teksty i klauzule" icon={<FileText size={18} />} desc="Klauzule oraz standardowe uwagi wstawiane do wycen i umów.">
          <div className="space-y-4">
            <Field label="Klauzula RODO">
              <Textarea rows={5} value={u.klauzulaRodo} onChange={(e) => updateUstawienia({ klauzulaRodo: e.target.value })} />
            </Field>
            <Field label="Klauzula pod podpisem">
              <Textarea rows={4} value={u.klauzulaPodpis} onChange={(e) => updateUstawienia({ klauzulaPodpis: e.target.value })} />
            </Field>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="label !mb-0">Standardowe uwagi wyceny</span>
                <button className="btn-outline !py-1" onClick={dodajUwage}>
                  <Plus size={15} /> Dodaj uwagę
                </button>
              </div>
              {uwagi.length === 0 ? (
                <p className="py-4 text-center text-[13px] text-stone-400">Brak uwag.</p>
              ) : (
                <div className="space-y-2">
                  {uwagi.map((x, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <span className="mt-2.5 w-5 shrink-0 text-right text-[12px] text-stone-400">{i + 1}.</span>
                      <Textarea rows={2} value={x} onChange={(e) => setUwaga(i, e.target.value)} />
                      <button className="btn-ghost mt-1 !px-2 text-red-600" onClick={() => usunUwage(i)} title="Usuń">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionCard>

        {/* 5. Kopia zapasowa */}
        <SectionCard title="Kopia zapasowa" icon={<Database size={18} />} desc="Eksportuj dane do pliku lub przywróć z wcześniejszej kopii.">
          <div className="flex flex-wrap gap-2">
            <button className="btn-primary" onClick={onExport}>
              <Download size={16} /> Eksportuj kopię
            </button>
            <input ref={importRef} type="file" accept="application/json,.json" className="hidden" onChange={onImport} />
            <button className="btn-outline" onClick={() => importRef.current?.click()}>
              <Upload size={16} /> Wczytaj kopię
            </button>
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-[13px] text-amber-200">
            <AlertTriangle size={16} className="mt-0.5 shrink-0" />
            <span>Wczytanie kopii nadpisuje wszystkie bieżące dane. Zrób najpierw eksport, jeśli chcesz zachować obecny stan.</span>
          </div>
        </SectionCard>

        {/* 6. Pamiec i instalacja */}
        <SectionCard title="Pamięć i instalacja" icon={<HardDrive size={18} />} desc="Aplikacja działa offline, dane są zapisywane lokalnie w przeglądarce.">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-stone-200 p-3">
              <div className="text-[12px] uppercase tracking-wide text-stone-500">Pamięć trwała</div>
              <div className="mt-1">
                {info?.persisted ? (
                  <Badge tone="green">Włączona</Badge>
                ) : (
                  <Badge tone="amber">Wyłączona</Badge>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-stone-200 p-3">
              <div className="text-[12px] uppercase tracking-wide text-stone-500">Zajęte</div>
              <div className="mt-1 text-[16px] font-semibold text-ink">{fmtBytes(info?.usage)}</div>
            </div>
            <div className="rounded-xl border border-stone-200 p-3">
              <div className="text-[12px] uppercase tracking-wide text-stone-500">Dostępne (limit)</div>
              <div className="mt-1 text-[16px] font-semibold text-ink">{fmtBytes(info?.quota)}</div>
            </div>
          </div>
          <button className="btn-outline mt-3" onClick={onPersist}>
            <ShieldCheck size={16} /> Włącz pamięć trwałą
          </button>
          <p className="mt-2 text-[12px] text-stone-400">
            Pamięć trwała chroni dane przed automatycznym czyszczeniem przez przeglądarkę. Dodatkowo zalecamy regularny eksport kopii.
          </p>
        </SectionCard>

        {/* 7. Dane */}
        <SectionCard title="Dane aplikacji" icon={<Database size={18} />} desc="Operacje na całej bazie danych.">
          <div className="flex flex-wrap gap-2">
            <button className="btn-outline" onClick={onDemo}>
              <Database size={16} /> Załaduj dane demo
            </button>
            <button className="btn-danger" onClick={onWyczysc}>
              <Trash2 size={16} /> Wyczyść wszystko
            </button>
          </div>
        </SectionCard>
      </div>

      {confirmNode}
    </div>
  )
}

// ============================================================================
// Edytor pojedynczego podmiotu
// ============================================================================
function FirmaEditor({
  firma,
  aktywna,
  onSet,
  onAktywna,
}: {
  firma: Firma
  aktywna: boolean
  onSet: (f: Firma) => void
  onAktywna: () => void
}) {
  const set = (patch: Partial<Firma>) => onSet({ ...firma, ...patch })
  const kontoOk = !firma.konto || validNRB(firma.konto)
  const nipOk = !firma.nip || validNIP(firma.nip)

  return (
    <div className={cx('rounded-2xl border p-4', aktywna ? 'border-brand-300 bg-brand-50/40' : 'border-stone-200')}>
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[14px] font-semibold text-ink">{firma.nazwa || 'Podmiot'}</span>
          {aktywna && <Badge tone="green">Aktywny</Badge>}
        </div>
        {aktywna ? (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-brand-700">
            <Check size={14} /> Wybrany
          </span>
        ) : (
          <button className="btn-ghost !py-1 text-[13px]" onClick={onAktywna}>
            <Star size={14} /> Ustaw aktywny
          </button>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nazwa" className="sm:col-span-2">
          <Input value={firma.nazwa} onChange={(e) => set({ nazwa: e.target.value })} />
        </Field>
        <Field label="Właściciel">
          <Input value={firma.wlasciciel} onChange={(e) => set({ wlasciciel: e.target.value })} />
        </Field>
        <Field label="NIP" error={!nipOk ? 'Niepoprawny NIP' : undefined} hint={nipOk && firma.nip ? fmtNIP(firma.nip) : undefined}>
          <Input value={firma.nip} onChange={(e) => set({ nip: e.target.value })} />
        </Field>
        <Field label="Ulica" className="sm:col-span-2">
          <Input value={firma.ulica} onChange={(e) => set({ ulica: e.target.value })} />
        </Field>
        <Field label="Kod pocztowy">
          <Input value={firma.kod} onChange={(e) => set({ kod: e.target.value })} />
        </Field>
        <Field label="Miasto">
          <Input value={firma.miasto} onChange={(e) => set({ miasto: e.target.value })} />
        </Field>
        <Field label="Telefon">
          <Input value={firma.telefon} onChange={(e) => set({ telefon: e.target.value })} />
        </Field>
        <Field label="E-mail">
          <Input value={firma.email} onChange={(e) => set({ email: e.target.value })} />
        </Field>
        <Field label="WWW" className="sm:col-span-2">
          <Input value={firma.www || ''} onChange={(e) => set({ www: e.target.value })} />
        </Field>
        <Field label="Bank">
          <Input value={firma.bank || ''} onChange={(e) => set({ bank: e.target.value })} />
        </Field>
        <Field label="Domyślny VAT">
          <Select value={String(firma.domyslnyVat)} onChange={(e) => set({ domyslnyVat: Number(e.target.value) as VatRate })}>
            {VAT_STAWKI.map((v) => (
              <option key={v} value={v}>
                {v}%
              </option>
            ))}
          </Select>
        </Field>
        <Field
          label="Numer konta (NRB)"
          className="sm:col-span-2"
          error={!kontoOk ? 'Niepoprawny numer konta (suma kontrolna)' : undefined}
          hint={kontoOk && firma.konto ? fmtKonto(firma.konto) : undefined}
        >
          <Input value={firma.konto || ''} onChange={(e) => set({ konto: e.target.value })} />
        </Field>
      </div>
    </div>
  )
}
