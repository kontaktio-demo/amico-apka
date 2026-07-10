import { useState, useMemo } from 'react'
import { ScanLine, Search, FileText, Printer, Send, Download, Trash2, Link2, X, Plus } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, SearchInput, Select, EmptyState, Badge, Modal, Field, Input, Textarea, useToast, useConfirm, cx } from '../components/ui'
import { Skaner } from '../components/Skaner'
import type { Skan, SkanKategoria } from '../lib/types'
import { fmtDate } from '../lib/format'
import { klientNazwa } from '../lib/helpers'
import { drukujPdf, udostepnijPdf, pobierzPdf } from '../lib/pdf'

const KAT: Record<SkanKategoria, string> = {
  umowa: 'Umowa',
  protokol: 'Protokół',
  faktura: 'Faktura',
  pomiar: 'Pomiar / szablon',
  projekt: 'Projekt',
  kosztorys: 'Kosztorys',
  zdjecie: 'Zdjęcie',
  inne: 'Inne',
}

export default function Skany() {
  const b = useStore((s) => s.baza)
  const remove = useStore((s) => s.remove)
  const upsert = useStore((s) => s.upsert)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [skanerOtwarty, setSkanerOtwarty] = useState(false)
  const [szukaj, setSzukaj] = useState('')
  const [katFiltr, setKatFiltr] = useState<string>('')
  const [podglad, setPodglad] = useState<Skan | null>(null)

  const skany = useMemo(() => {
    return b.skany
      .filter((s) => !katFiltr || s.kategoria === katFiltr)
      .filter((s) => {
        if (!szukaj) return true
        const zl = b.zlecenia.find((z) => z.id === s.zlecenieId)
        const kl = b.klienci.find((k) => k.id === s.klientId)
        const hay = `${s.nazwa} ${s.notatka || ''} ${zl?.numer || ''} ${zl?.tytul || ''} ${kl ? klientNazwa(kl) : ''}`.toLowerCase()
        return hay.includes(szukaj.toLowerCase())
      })
      .sort((a, c) => c.utworzono.localeCompare(a.utworzono))
  }, [b.skany, b.zlecenia, b.klienci, katFiltr, szukaj])

  return (
    <div>
      <PageHeader
        title="Skany / Archiwum"
        subtitle="Skanuj dokumenty i kartki, przypnij do zlecenia, przeglądaj i wysyłaj jako PDF"
        icon={<ScanLine size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setSkanerOtwarty(true)}>
            <ScanLine size={17} /> Skanuj dokument
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj: nazwa, zlecenie, klient…" />
        </div>
        <Select className="w-auto" value={katFiltr} onChange={(e) => setKatFiltr(e.target.value)}>
          <option value="">Wszystkie kategorie</option>
          {Object.entries(KAT).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
      </div>

      {skany.length === 0 ? (
        <EmptyState
          icon={<ScanLine size={28} />}
          title="Brak skanów"
          desc="Zeskanuj dokument, umowę, protokół albo kartkę z pomiaru — jak w Adobe Scan. Zapisze się jako PDF i przypniesz do zlecenia."
          action={<button className="btn-primary" onClick={() => setSkanerOtwarty(true)}><ScanLine size={16} /> Skanuj dokument</button>}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {skany.map((s) => {
            const zl = b.zlecenia.find((z) => z.id === s.zlecenieId)
            const kl = b.klienci.find((k) => k.id === s.klientId)
            return (
              <button key={s.id} onClick={() => setPodglad(s)} className="card overflow-hidden text-left transition hover:border-white/20">
                <div className="relative aspect-[3/4] bg-white">
                  <img src={s.strony[0]} alt={s.nazwa} className="h-full w-full object-cover" />
                  {s.strony.length > 1 && (
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">
                      {s.strony.length} str.
                    </span>
                  )}
                </div>
                <div className="p-2.5">
                  <div className="truncate text-[13.5px] font-medium text-ink">{s.nazwa}</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <Badge tone="stone">{KAT[s.kategoria]}</Badge>
                  </div>
                  {(zl || kl) && (
                    <div className="mt-1.5 flex items-center gap-1 truncate text-[11.5px] text-stone-400">
                      <Link2 size={11} /> {zl ? zl.numer : klientNazwa(kl)}
                    </div>
                  )}
                  <div className="mt-1 text-[11px] text-stone-500">{fmtDate(s.utworzono)}</div>
                </div>
              </button>
            )
          })}
        </div>
      )}

      <Skaner open={skanerOtwarty} onClose={() => setSkanerOtwarty(false)} />

      {podglad && (
        <PodgladSkanu
          skan={podglad}
          zlecenia={b.zlecenia.map((z) => ({ id: z.id, label: `${z.numer} · ${z.tytul}` }))}
          klienci={b.klienci.map((k) => ({ id: k.id, label: klientNazwa(k) }))}
          onClose={() => setPodglad(null)}
          onZapisz={(s) => {
            upsert('skany', s)
            setPodglad(s)
            push('Zapisano zmiany')
          }}
          onUsun={async () => {
            if (await confirm(`Usunąć skan „${podglad.nazwa}"?`)) {
              remove('skany', podglad.id)
              setPodglad(null)
              push('Usunięto skan', 'info')
            }
          }}
          push={push}
        />
      )}
      {confirmNode}
    </div>
  )
}

function PodgladSkanu({
  skan,
  zlecenia,
  klienci,
  onClose,
  onZapisz,
  onUsun,
  push,
}: {
  skan: Skan
  zlecenia: { id: string; label: string }[]
  klienci: { id: string; label: string }[]
  onClose: () => void
  onZapisz: (s: Skan) => void
  onUsun: () => void
  push: (m: string, t?: 'ok' | 'err' | 'info') => void
}) {
  const [d, setD] = useState<Skan>(skan)
  const set = (p: Partial<Skan>) => setD({ ...d, ...p })

  async function wyslij() {
    const r = await udostepnijPdf(d.strony, d.nazwa, d.notatka)
    push(r === 'shared' ? 'Udostępniono PDF' : 'Pobrano PDF (dołącz do wiadomości)', 'ok')
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={skan.nazwa}
      size="xl"
      footer={
        <>
          <button className="btn-ghost text-red-400 mr-auto" onClick={onUsun}>
            <Trash2 size={16} /> Usuń
          </button>
          <button className="btn-outline" onClick={() => pobierzPdf(d.strony, d.nazwa)}>
            <Download size={16} /> PDF
          </button>
          <button className="btn-outline" onClick={() => drukujPdf(d.strony)}>
            <Printer size={16} /> Drukuj
          </button>
          <button className="btn-primary" onClick={wyslij}>
            <Send size={16} /> Wyślij
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-xl bg-black/20 p-3">
          {d.strony.map((s, i) => (
            <div key={i} className="relative">
              <img src={s} alt={`Strona ${i + 1}`} className="w-full rounded-lg bg-white" />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">{i + 1} / {d.strony.length}</span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Field label="Nazwa">
            <Input value={d.nazwa} onChange={(e) => set({ nazwa: e.target.value })} />
          </Field>
          <Field label="Przypisz do zlecenia">
            <Select value={d.zlecenieId || ''} onChange={(e) => set({ zlecenieId: e.target.value || undefined })}>
              <option value="">— brak —</option>
              {zlecenia.map((z) => (
                <option key={z.id} value={z.id}>{z.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Przypisz do klienta">
            <Select value={d.klientId || ''} onChange={(e) => set({ klientId: e.target.value || undefined })}>
              <option value="">— brak —</option>
              {klienci.map((k) => (
                <option key={k.id} value={k.id}>{k.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Notatka">
            <Textarea rows={3} value={d.notatka || ''} onChange={(e) => set({ notatka: e.target.value })} />
          </Field>
          <button className="btn-outline w-full" onClick={() => onZapisz(d)}>
            Zapisz zmiany
          </button>
        </div>
      </div>
    </Modal>
  )
}
