import { useEffect, useRef, useState, useCallback } from 'react'
import { Camera, Upload, X, Check, RotateCcw, Trash2, Plus, ScanLine, FileText, ChevronLeft } from 'lucide-react'
import { useStore } from '../lib/store'
import { useToast, Field, Input, Select, Textarea } from './ui'
import type { Skan, SkanKategoria } from '../lib/types'
import { uid } from '../lib/id'
import { nowISO } from '../lib/format'
import { klientNazwa } from '../lib/helpers'
import {
  zaladujObraz,
  kadrujPerspektywe,
  zastosujFiltr,
  canvasNaJpeg,
  domyslneRogi,
  type Rogi,
  type FiltrSkanu,
} from '../lib/scanner'

interface Strona {
  id: string
  warp: string // wykadrowany oryginal (JPEG)
  filtr: FiltrSkanu
  wynik: string // po filtrze (JPEG)
}
type Etap = 'kamera' | 'kadr' | 'przeglad'

const FILTRY: { k: FiltrSkanu; label: string }[] = [
  { k: 'auto', label: 'Auto' },
  { k: 'kolor', label: 'Kolor' },
  { k: 'szary', label: 'Szarość' },
  { k: 'bw', label: 'Czarno-biały' },
  { k: 'oryginal', label: 'Oryginał' },
]
const KATEGORIE: { k: SkanKategoria; label: string }[] = [
  { k: 'umowa', label: 'Umowa' },
  { k: 'protokol', label: 'Protokół' },
  { k: 'faktura', label: 'Faktura' },
  { k: 'pomiar', label: 'Pomiar / szablon' },
  { k: 'projekt', label: 'Projekt' },
  { k: 'kosztorys', label: 'Kosztorys' },
  { k: 'zdjecie', label: 'Zdjęcie' },
  { k: 'inne', label: 'Inne' },
]

export function Skaner({
  open,
  onClose,
  zlecenieId,
  klientId,
  onZapisano,
}: {
  open: boolean
  onClose: () => void
  zlecenieId?: string
  klientId?: string
  onZapisano?: (skan: Skan) => void
}) {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const { push } = useToast()

  const [etap, setEtap] = useState<Etap>('kamera')
  const [strony, setStrony] = useState<Strona[]>([])
  const [captured, setCaptured] = useState<HTMLCanvasElement | null>(null)
  const [rogi, setRogi] = useState<Rogi>(domyslneRogi(1, 1)) // znormalizowane 0..1
  const [filtr, setFiltr] = useState<FiltrSkanu>('auto')
  const [busy, setBusy] = useState(false)

  const [nazwa, setNazwa] = useState('')
  const [kategoria, setKategoria] = useState<SkanKategoria>('inne')
  const [zlId, setZlId] = useState(zlecenieId || '')
  const [klId, setKlId] = useState(klientId || '')
  const [notatka, setNotatka] = useState('')

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [kamOk, setKamOk] = useState<boolean | null>(null)

  // reset przy otwarciu
  useEffect(() => {
    if (open) {
      setEtap('kamera')
      setStrony([])
      setCaptured(null)
      setNazwa('')
      setKategoria('inne')
      setZlId(zlecenieId || '')
      setKlId(klientId || '')
      setNotatka('')
    }
  }, [open, zlecenieId, klientId])

  // kamera
  const stopKamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }, [])

  useEffect(() => {
    let anulowane = false
    async function start() {
      if (!open || etap !== 'kamera') return
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (anulowane) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setKamOk(true)
      } catch {
        setKamOk(false)
      }
    }
    start()
    return () => {
      anulowane = true
      stopKamera()
    }
  }, [open, etap, stopKamera])

  useEffect(() => () => stopKamera(), [stopKamera])

  if (!open) return null

  // --- akcje ---
  function zrobZdjecie() {
    const v = videoRef.current
    if (!v || !v.videoWidth) return
    const c = document.createElement('canvas')
    const skala = Math.min(1, 2200 / Math.max(v.videoWidth, v.videoHeight))
    c.width = Math.round(v.videoWidth * skala)
    c.height = Math.round(v.videoHeight * skala)
    c.getContext('2d')!.drawImage(v, 0, 0, c.width, c.height)
    stopKamera()
    setCaptured(c)
    setRogi(domyslneRogi(1, 1))
    setEtap('kadr')
  }

  async function wgrajPlik(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setBusy(true)
    try {
      const url = await new Promise<string>((res, rej) => {
        const r = new FileReader()
        r.onload = () => res(String(r.result))
        r.onerror = rej
        r.readAsDataURL(f)
      })
      const canvas = await zaladujObraz(url)
      stopKamera()
      setCaptured(canvas)
      setRogi(domyslneRogi(1, 1))
      setEtap('kadr')
    } catch {
      push('Nie udało się wczytać pliku', 'err')
    } finally {
      setBusy(false)
    }
  }

  async function dodajStrone() {
    if (!captured) return
    setBusy(true)
    try {
      const rp: Rogi = {
        tl: { x: rogi.tl.x * captured.width, y: rogi.tl.y * captured.height },
        tr: { x: rogi.tr.x * captured.width, y: rogi.tr.y * captured.height },
        br: { x: rogi.br.x * captured.width, y: rogi.br.y * captured.height },
        bl: { x: rogi.bl.x * captured.width, y: rogi.bl.y * captured.height },
      }
      const warped = kadrujPerspektywe(captured, rp)
      const warpJpeg = canvasNaJpeg(warped, 0.9)
      const filtered = zastosujFiltr(warped, filtr)
      const wynik = canvasNaJpeg(filtered, 0.82)
      setStrony((s) => [...s, { id: uid('str'), warp: warpJpeg, filtr, wynik }])
      setCaptured(null)
      setEtap('przeglad')
    } finally {
      setBusy(false)
    }
  }

  async function zmienFiltrStrony(id: string, nowy: FiltrSkanu) {
    const str = strony.find((s) => s.id === id)
    if (!str) return
    const canvas = await zaladujObraz(str.warp)
    const wynik = canvasNaJpeg(zastosujFiltr(canvas, nowy), 0.82)
    setStrony((s) => s.map((x) => (x.id === id ? { ...x, filtr: nowy, wynik } : x)))
  }

  function zapisz() {
    if (strony.length === 0) return
    const skan: Skan = {
      id: uid('skan'),
      nazwa: nazwa.trim() || `Skan ${new Date().toLocaleDateString('pl-PL')}`,
      kategoria,
      strony: strony.map((s) => s.wynik),
      zlecenieId: zlId || undefined,
      klientId: klId || undefined,
      notatka: notatka.trim() || undefined,
      utworzono: nowISO(),
    }
    upsert('skany', skan)
    push(`Zapisano skan (${strony.length} str.)`)
    onZapisano?.(skan)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#070810] text-stone-100 no-print">
      {/* pasek gorny */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2 font-semibold">
          <ScanLine size={20} className="text-brand-400" /> Skaner dokumentów
        </div>
        <div className="flex items-center gap-2 text-[13px] text-stone-400">
          {strony.length > 0 && <span>{strony.length} str.</span>}
          <button className="btn-ghost !px-2" onClick={onClose}>
            <X size={22} />
          </button>
        </div>
      </div>

      {/* KAMERA */}
      {etap === 'kamera' && (
        <div className="relative flex flex-1 flex-col">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
            {kamOk !== false ? (
              <video ref={videoRef} playsInline muted className="max-h-full max-w-full" />
            ) : (
              <div className="max-w-sm p-8 text-center text-stone-400">
                <Camera size={40} className="mx-auto mb-3 opacity-50" />
                <p className="text-[14px]">Brak dostępu do kamery. Możesz wgrać zdjęcie dokumentu z pliku.</p>
              </div>
            )}
            <div className="pointer-events-none absolute inset-6 rounded-2xl border-2 border-white/25" />
          </div>
          <div className="flex items-center justify-center gap-6 border-t border-white/10 px-4 py-5">
            <button className="btn-outline !border-white/20 !text-white" onClick={() => fileRef.current?.click()}>
              <Upload size={18} /> Wgraj
            </button>
            <button
              onClick={zrobZdjecie}
              disabled={kamOk !== true}
              className="grid h-16 w-16 place-items-center rounded-full border-4 border-white bg-white/90 text-ink shadow-lg transition active:scale-95 disabled:opacity-30"
            >
              <Camera size={26} />
            </button>
            {strony.length > 0 ? (
              <button className="btn-outline !border-white/20 !text-white" onClick={() => setEtap('przeglad')}>
                <FileText size={18} /> Strony ({strony.length})
              </button>
            ) : (
              <span className="w-[92px]" />
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={wgrajPlik} />
        </div>
      )}

      {/* KADROWANIE */}
      {etap === 'kadr' && captured && (
        <div className="flex flex-1 flex-col">
          <KadrOverlay canvas={captured} rogi={rogi} onChange={setRogi} />
          <div className="border-t border-white/10 px-3 py-3">
            <div className="mb-3 flex justify-center gap-1.5 overflow-x-auto">
              {FILTRY.map((f) => (
                <button
                  key={f.k}
                  onClick={() => setFiltr(f.k)}
                  className={
                    'shrink-0 rounded-lg px-3 py-1.5 text-[13px] font-medium transition ' +
                    (filtr === f.k ? 'bg-white text-ink' : 'bg-white/10 text-stone-300 hover:bg-white/15')
                  }
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center justify-between gap-2">
              <button
                className="btn-ghost !text-stone-300"
                onClick={() => {
                  setCaptured(null)
                  setEtap('kamera')
                }}
              >
                <RotateCcw size={17} /> Ponów
              </button>
              <button className="btn-primary" onClick={dodajStrone} disabled={busy}>
                <Check size={18} /> Dodaj stronę
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PRZEGLAD STRON + ZAPIS */}
      {etap === 'przeglad' && (
        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="mx-auto max-w-2xl space-y-5">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {strony.map((s, i) => (
                <div key={s.id} className="group relative overflow-hidden rounded-xl border border-white/10 bg-white">
                  <img src={s.wynik} alt={`Strona ${i + 1}`} className="aspect-[3/4] w-full object-cover" />
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] text-white">{i + 1}</span>
                  <button
                    onClick={() => setStrony((x) => x.filter((y) => y.id !== s.id))}
                    className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-lg bg-black/60 text-white transition hover:bg-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                  <select
                    value={s.filtr}
                    onChange={(e) => zmienFiltrStrony(s.id, e.target.value as FiltrSkanu)}
                    className="absolute inset-x-1.5 bottom-1.5 rounded-md border-0 bg-black/70 px-1.5 py-1 text-[11px] text-white"
                  >
                    {FILTRY.map((f) => (
                      <option key={f.k} value={f.k}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
              <button
                onClick={() => setEtap('kamera')}
                className="grid aspect-[3/4] w-full place-items-center rounded-xl border-2 border-dashed border-white/20 text-stone-400 transition hover:border-white/40 hover:text-white"
              >
                <span className="text-center">
                  <Plus size={26} className="mx-auto" />
                  <span className="mt-1 block text-[12px]">Kolejna strona</span>
                </span>
              </button>
            </div>

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Nazwa dokumentu">
                  <Input value={nazwa} onChange={(e) => setNazwa(e.target.value)} placeholder="np. Umowa – Kowalski" />
                </Field>
                <Field label="Kategoria">
                  <Select value={kategoria} onChange={(e) => setKategoria(e.target.value as SkanKategoria)}>
                    {KATEGORIE.map((k) => (
                      <option key={k.k} value={k.k}>
                        {k.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Przypisz do zlecenia">
                  <Select value={zlId} onChange={(e) => setZlId(e.target.value)}>
                    <option value="">— brak —</option>
                    {b.zlecenia.map((z) => (
                      <option key={z.id} value={z.id}>
                        {z.numer} · {z.tytul}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Przypisz do klienta">
                  <Select value={klId} onChange={(e) => setKlId(e.target.value)}>
                    <option value="">— brak —</option>
                    {b.klienci.map((k) => (
                      <option key={k.id} value={k.id}>
                        {klientNazwa(k)}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Notatka" className="sm:col-span-2">
                  <Textarea rows={2} value={notatka} onChange={(e) => setNotatka(e.target.value)} />
                </Field>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <button className="btn-ghost !text-stone-300" onClick={() => setEtap('kamera')}>
                <ChevronLeft size={17} /> Skanuj dalej
              </button>
              <button className="btn-primary btn-lg" onClick={zapisz} disabled={strony.length === 0}>
                <Check size={18} /> Zapisz dokument ({strony.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ---------- Nakladka kadrowania (przeciaganie 4 rogow) ----------
function KadrOverlay({ canvas, rogi, onChange }: { canvas: HTMLCanvasElement; rogi: Rogi; onChange: (r: Rogi) => void }) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [src] = useState(() => canvas.toDataURL('image/jpeg', 0.9))
  const drag = useRef<keyof Rogi | null>(null)

  const move = (e: React.PointerEvent) => {
    if (!drag.current || !wrapRef.current) return
    const img = wrapRef.current.querySelector('img')!
    const r = img.getBoundingClientRect()
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width))
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))
    onChange({ ...rogi, [drag.current]: { x, y } })
  }

  const rogList: (keyof Rogi)[] = ['tl', 'tr', 'br', 'bl']

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black p-3" onPointerMove={move} onPointerUp={() => (drag.current = null)} onPointerLeave={() => (drag.current = null)}>
      <div ref={wrapRef} className="relative">
        <img src={src} alt="skan" className="max-h-[62vh] max-w-full select-none" draggable={false} />
        <svg className="pointer-events-none absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
          <polygon
            points={`${rogi.tl.x * 100},${rogi.tl.y * 100} ${rogi.tr.x * 100},${rogi.tr.y * 100} ${rogi.br.x * 100},${rogi.br.y * 100} ${rogi.bl.x * 100},${rogi.bl.y * 100}`}
            fill="rgba(110,130,180,0.18)"
            stroke="#aeb6d0"
            strokeWidth="0.6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        {rogList.map((k) => (
          <button
            key={k}
            onPointerDown={(e) => {
              e.preventDefault()
              drag.current = k
            }}
            className="absolute z-10 h-8 w-8 -translate-x-1/2 -translate-y-1/2 touch-none rounded-full border-2 border-white bg-brand-400/70 shadow"
            style={{ left: `${rogi[k].x * 100}%`, top: `${rogi[k].y * 100}%` }}
          />
        ))}
      </div>
    </div>
  )
}
