import { useState, useEffect, useRef, useCallback } from 'react'
import { ScanLine, FileText, Printer, Send, Download, Trash2, Link2, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/store'
import {
  PageHeader,
  SearchInput,
  Select,
  EmptyState,
  Badge,
  Modal,
  Field,
  Input,
  Textarea,
  useToast,
  useConfirm,
  cx,
} from '../components/ui'
import { Skaner } from '../components/Skaner'
import { SkanImg } from '../components/SkanImg'
import { rozwinStrony } from '../lib/cloud'
import { listaSkanow, policzSkany, zapiszMetaSkanu, usunSkan, subskrybujSkany, STRONA_ROZMIAR } from '../lib/skanyDb'
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
  const b = useStore((s) => s.baza) // tylko do etykiet: numer zlecenia / nazwa klienta
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [skanerOtwarty, setSkanerOtwarty] = useState(false)
  const [szukaj, setSzukaj] = useState('')
  const [katFiltr, setKatFiltr] = useState<string>('')
  const [podglad, setPodglad] = useState<Skan | null>(null)

  const [skany, setSkany] = useState<Skan[]>([])
  const [ladowanie, setLadowanie] = useState(true)
  const [jestWiecej, setJestWiecej] = useState(false)
  const [laczna, setLaczna] = useState<number | null>(null)
  const [blad, setBlad] = useState(false) // blad wczytywania (offline) - NIE mylic z pusta lista
  const reqRef = useRef(0)

  // Ile skanow jest teraz wczytanych (ref - zeby realtime odswiezal ZACHOWUJAC pozycje,
  // a nie zwijal listy do pierwszych 60 po kazdej zmianie).
  const widoczneRef = useRef(0)
  useEffect(() => {
    widoczneRef.current = skany.length
  }, [skany.length])

  // Zaladuj od poczatku `ile` pozycji (reqRef odrzuca spoznione, nieaktualne zapytania).
  const zaladujOd0 = useCallback(
    async (ile: number) => {
      const nr = ++reqRef.current
      setLadowanie(true)
      try {
        const { skany: s, jestWiecej: w } = await listaSkanow({ kategoria: katFiltr, szukaj, offset: 0, limit: ile })
        if (nr !== reqRef.current) return // starsze zapytanie - pomin
        setSkany(s)
        setJestWiecej(w)
        setBlad(false)
      } catch {
        if (nr === reqRef.current) {
          setSkany([])
          setBlad(true)
        }
      } finally {
        if (nr === reqRef.current) setLadowanie(false)
      }
    },
    [katFiltr, szukaj],
  )
  const zaladujPierwsza = useCallback(() => zaladujOd0(STRONA_ROZMIAR), [zaladujOd0])

  useEffect(() => {
    const t = setTimeout(zaladujPierwsza, szukaj ? 300 : 0)
    return () => clearTimeout(t)
  }, [zaladujPierwsza, szukaj])

  // Licznik wszystkich skanow (do rozroznienia "brak skanow" vs "brak wynikow")
  useEffect(() => {
    policzSkany().then(setLaczna).catch(() => setLaczna(null))
  }, [])

  // Realtime: zmiana skanu (tez z innego urzadzenia) -> odswiez, ale ZACHOWAJ ile wczytano.
  useEffect(() => {
    const off = subskrybujSkany(() => {
      zaladujOd0(Math.max(STRONA_ROZMIAR, widoczneRef.current))
      policzSkany().then(setLaczna).catch(() => {})
    })
    return off
  }, [zaladujOd0])

  async function zaladujWiecej() {
    const nr = reqRef.current // kontynuacja biezacej listy - NIE inkrementujemy
    try {
      const { skany: s, jestWiecej: w } = await listaSkanow({ kategoria: katFiltr, szukaj, offset: skany.length })
      if (nr !== reqRef.current) return // filtr/szukanie zmienilo sie w miedzyczasie - pomin
      setSkany((prev) => {
        const znane = new Set(prev.map((x) => x.id)) // dedup po id (bezpiecznie przy realtime)
        return [...prev, ...s.filter((x) => !znane.has(x.id))]
      })
      setJestWiecej(w)
    } catch {
      /* brak sieci - mozna kliknac "Pokaz wiecej" ponownie; nic nie ginie */
    }
  }

  function poZapisaniuSkanu() {
    zaladujOd0(Math.max(STRONA_ROZMIAR, widoczneRef.current)) // zachowaj wczytana liczbe, nie zwijaj do 60
    policzSkany().then(setLaczna).catch(() => {})
  }

  return (
    <div>
      <PageHeader
        title="Skany / Archiwum"
        subtitle={`${laczna != null && laczna > 0 ? `${laczna} w archiwum · ` : ''}Skanuj, przypnij do zlecenia, wyślij jako PDF`}
        icon={<ScanLine size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setSkanerOtwarty(true)}>
            <ScanLine size={17} /> Skanuj dokument
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <div className="min-w-[220px] flex-1">
          <SearchInput value={szukaj} onChange={setSzukaj} placeholder="Szukaj: nazwa, notatka..." />
        </div>
        <Select className="w-auto" value={katFiltr} onChange={(e) => setKatFiltr(e.target.value)}>
          <option value="">Wszystkie kategorie</option>
          {Object.entries(KAT).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </Select>
      </div>

      {ladowanie && skany.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-stone-400">
          <Loader2 size={22} className="mr-2 animate-spin" /> Wczytywanie skanów...
        </div>
      ) : blad && skany.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle size={28} />}
          title="Nie udało się wczytać skanów"
          desc="Sprawdź połączenie z internetem. Skany są bezpieczne w chmurze - spróbuj ponownie."
          action={
            <button className="btn-outline" onClick={zaladujPierwsza}>
              Spróbuj ponownie
            </button>
          }
        />
      ) : skany.length === 0 ? (
        szukaj.trim() || katFiltr ? (
          <EmptyState
            icon={<ScanLine size={28} />}
            title="Brak wyników"
            desc="Żaden skan nie pasuje do wyszukiwania lub wybranej kategorii. Zmień kryteria powyżej."
          />
        ) : (
          <EmptyState
            icon={<ScanLine size={28} />}
            title="Brak skanów"
            desc="Zeskanuj dokument, umowę, protokół albo kartkę z pomiaru - jak w Adobe Scan. Zapisze się jako PDF i przypniesz do zlecenia."
            action={
              <button className="btn-primary" onClick={() => setSkanerOtwarty(true)}>
                <ScanLine size={16} /> Skanuj dokument
              </button>
            }
          />
        )
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {skany.map((s) => {
              const zl = b.zlecenia.find((z) => z.id === s.zlecenieId)
              const kl = b.klienci.find((k) => k.id === s.klientId)
              return (
                <button
                  key={s.id}
                  onClick={() => setPodglad(s)}
                  className="card overflow-hidden text-left transition hover:border-white/20"
                >
                  <div className="relative aspect-[3/4] bg-white">
                    <SkanImg strona={s.strony[0]} alt={s.nazwa} className="h-full w-full object-cover" />
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
          {jestWiecej && (
            <div className="mt-5 flex justify-center">
              <button className="btn-outline" onClick={zaladujWiecej}>
                <Plus size={16} /> Pokaż więcej
              </button>
            </div>
          )}
        </>
      )}

      <Skaner open={skanerOtwarty} onClose={() => setSkanerOtwarty(false)} onZapisano={poZapisaniuSkanu} />

      {podglad && (
        <PodgladSkanu
          skan={podglad}
          zlecenia={b.zlecenia.map((z) => ({ id: z.id, label: `${z.numer} · ${z.tytul}` }))}
          klienci={b.klienci.map((k) => ({ id: k.id, label: klientNazwa(k) }))}
          onClose={() => setPodglad(null)}
          onZapisz={async (s) => {
            try {
              await zapiszMetaSkanu(s.id, {
                nazwa: s.nazwa,
                kategoria: s.kategoria,
                zlecenieId: s.zlecenieId,
                klientId: s.klientId,
                notatka: s.notatka,
              })
              setPodglad(s)
              setSkany((prev) => prev.map((x) => (x.id === s.id ? { ...x, ...s, strony: x.strony } : x)))
              push('Zapisano zmiany')
            } catch {
              push('Nie udało się zapisać zmian - sprawdź internet i spróbuj ponownie.', 'err')
            }
          }}
          onUsun={async () => {
            if (await confirm(`Usunąć skan "${podglad.nazwa}"?`)) {
              try {
                await usunSkan(podglad.id)
                setSkany((prev) => prev.filter((x) => x.id !== podglad.id))
                setLaczna((n) => (n == null ? n : Math.max(0, n - 1)))
                setPodglad(null)
                push('Usunięto skan', 'info')
              } catch {
                push('Nie udało się usunąć - sprawdź internet i spróbuj ponownie.', 'err')
              }
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
  const [zajety, setZajety] = useState<'' | 'pdf' | 'druk' | 'wyslij'>('')
  const [zapisuje, setZapisuje] = useState(false)

  // Rozwija strony do base64; OSTRZEGA, gdy ktorejs nie da sie pobrac (PDF bylby niepelny).
  async function rozwinBezpiecznie(): Promise<string[] | null> {
    const strony = await rozwinStrony(d.strony)
    if (strony.length < d.strony.length) {
      push(`Nie pobrano ${d.strony.length - strony.length} z ${d.strony.length} stron (słaby internet?). Spróbuj ponownie.`, 'err')
      if (strony.length === 0) return null
    }
    return strony
  }
  async function wyslij() {
    if (zajety) return
    setZajety('wyslij')
    try {
      const strony = await rozwinBezpiecznie()
      if (!strony) return
      const r = await udostepnijPdf(strony, d.nazwa, d.notatka)
      push(r === 'shared' ? 'Udostępniono PDF' : 'Pobrano PDF (dołącz do wiadomości)', 'ok')
    } catch {
      push('Nie udało się przygotować PDF - spróbuj ponownie.', 'err')
    } finally {
      setZajety('')
    }
  }
  async function pobierz() {
    if (zajety) return
    setZajety('pdf')
    try {
      const strony = await rozwinBezpiecznie()
      if (strony) pobierzPdf(strony, d.nazwa)
    } catch {
      push('Nie udało się przygotować PDF - spróbuj ponownie.', 'err')
    } finally {
      setZajety('')
    }
  }
  async function drukuj() {
    if (zajety) return
    setZajety('druk')
    try {
      const strony = await rozwinBezpiecznie()
      if (!strony) return
      const okno = drukujPdf(strony, d.nazwa)
      if (!okno) push('Zapisano PDF - otwórz go, aby wydrukować', 'ok')
    } catch {
      push('Nie udało się przygotować wydruku - spróbuj ponownie.', 'err')
    } finally {
      setZajety('')
    }
  }
  async function zapiszZmiany() {
    if (zapisuje) return
    setZapisuje(true)
    try {
      await onZapisz(d)
    } finally {
      setZapisuje(false)
    }
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
          <button className="btn-outline" onClick={pobierz} disabled={!!zajety}>
            {zajety === 'pdf' ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} PDF
          </button>
          <button className="btn-outline" onClick={drukuj} disabled={!!zajety}>
            {zajety === 'druk' ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} Drukuj
          </button>
          <button className="btn-primary" onClick={wyslij} disabled={!!zajety}>
            {zajety === 'wyslij' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} Wyślij
          </button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[1fr_260px]">
        <div className="max-h-[60vh] space-y-3 overflow-y-auto rounded-xl bg-black/20 p-3">
          {d.strony.map((s, i) => (
            <div key={i} className="relative min-h-[30vh]">
              <SkanImg strona={s} alt={`Strona ${i + 1}`} className="w-full rounded-lg bg-white" />
              <span className="absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                {i + 1} / {d.strony.length}
              </span>
            </div>
          ))}
        </div>
        <div className="space-y-3">
          <Field label="Nazwa">
            <Input value={d.nazwa} onChange={(e) => set({ nazwa: e.target.value })} />
          </Field>
          <Field label="Kategoria">
            <Select value={d.kategoria} onChange={(e) => set({ kategoria: e.target.value as SkanKategoria })}>
              {Object.entries(KAT).map(([k, label]) => (
                <option key={k} value={k}>
                  {label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Przypisz do zlecenia">
            <Select value={d.zlecenieId || ''} onChange={(e) => set({ zlecenieId: e.target.value || undefined })}>
              <option value="">- brak -</option>
              {zlecenia.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Przypisz do klienta">
            <Select value={d.klientId || ''} onChange={(e) => set({ klientId: e.target.value || undefined })}>
              <option value="">- brak -</option>
              {klienci.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notatka">
            <Textarea rows={3} value={d.notatka || ''} onChange={(e) => set({ notatka: e.target.value })} />
          </Field>
          <button className="btn-outline w-full" onClick={zapiszZmiany} disabled={zapisuje}>
            {zapisuje ? 'Zapisywanie...' : 'Zapisz zmiany'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
