import { useMemo, useRef, useState } from 'react'
import { Sparkles, Save, Layers, Home, SquareStack } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, CardBody, Field, Input, Select, Toggle, Badge, useToast, cx } from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { DocSheet } from '../documents/DocShell'
import { stonePreset, czyCiemny, type StonePreset } from '../lib/stone'
import type { ProduktKategoria, Skan } from '../lib/types'
import { uid } from '../lib/id'
import { nowISO, fmtNum } from '../lib/format'
import { klientNazwa } from '../lib/helpers'

const KATEGORIE: { k: ProduktKategoria; label: string }[] = [
  { k: 'granit', label: 'Granit' },
  { k: 'marmur', label: 'Marmur' },
  { k: 'kwarc', label: 'Konglomerat kwarcowy' },
  { k: 'konglomerat', label: 'Konglomerat' },
  { k: 'spiek', label: 'Spiek kwarcowy' },
  { k: 'dekton', label: 'Dekton' },
  { k: 'trawertyn', label: 'Trawertyn' },
  { k: 'onyks', label: 'Onyks' },
]

// ---------- Proceduralna tekstura kamienia (SVG) ----------
function StoneDefs({ id, p }: { id: string; p: StonePreset }) {
  return (
    <defs>
      <linearGradient id={`${id}-g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={p.base} />
        <stop offset="0.55" stopColor={p.base2} />
        <stop offset="1" stopColor={p.base} />
      </linearGradient>
      <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
        <stop offset="0.4" stopColor="#ffffff" stopOpacity="0" />
        <stop offset="1" stopColor="#000000" stopOpacity="0.12" />
      </linearGradient>
      <filter id={`${id}-tex`} x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency={`${p.freqX} ${p.freqY}`} numOctaves={p.octaves} seed="7" stitchTiles="stitch" result="n" />
        <feColorMatrix in="n" type="saturate" values="0" result="g" />
        <feComposite in="g" in2="SourceAlpha" operator="in" />
      </filter>
    </defs>
  )
}
function StonePath({ d, id, p }: { d: string; id: string; p: StonePreset }) {
  return (
    <g>
      <path d={d} fill={`url(#${id}-g)`} />
      <path d={d} fill="#808080" filter={`url(#${id}-tex)`} opacity={p.kontrast} style={{ mixBlendMode: czyCiemny(p) ? 'screen' : 'overlay' }} />
      <path d={d} fill={`url(#${id}-sheen)`} opacity={0.35 + p.polysk * 0.35} />
    </g>
  )
}
function StoneRect({ x, y, w, h, id, p, rx = 0 }: { x: number; y: number; w: number; h: number; id: string; p: StonePreset; rx?: number }) {
  const d = `M${x + rx},${y} h${w - 2 * rx} a${rx},${rx} 0 0 1 ${rx},${rx} v${h - 2 * rx} a${rx},${rx} 0 0 1 ${-rx},${rx} h${-(w - 2 * rx)} a${rx},${rx} 0 0 1 ${-rx},${-rx} v${-(h - 2 * rx)} a${rx},${rx} 0 0 1 ${rx},${-rx} z`
  return <StonePath d={rx ? d : `M${x},${y} h${w} v${h} h${-w} z`} id={id} p={p} />
}

export default function Wizualizacja() {
  const b = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const firma = useStore((s) => s.aktywnaFirma)()
  const { push } = useToast()

  const [kat, setKat] = useState<ProduktKategoria>('marmur')
  const [nazwaKamienia, setNazwaKamienia] = useState('Calacatta')
  const [ksztalt, setKsztalt] = useState<'prosty' | 'L'>('prosty')
  const [a, setA] = useState(300) // dlugosc cm
  const [b2, setB2] = useState(62) // glebokosc cm
  const [a2, setA2] = useState(180) // ramie L
  const [b3, setB3] = useState(62)
  const [grubosc, setGrubosc] = useState('3 cm')
  const [krawedz, setKrawedz] = useState('prosta')
  const [zlew, setZlew] = useState(true)
  const [plyta, setPlyta] = useState(true)
  const [widok, setWidok] = useState<'blat' | 'kuchnia'>('kuchnia')
  const [klientId, setKlientId] = useState('')
  const [zlecenieId, setZlecenieId] = useState('')
  const svgRef = useRef<SVGSVGElement>(null)

  const preset = useMemo(() => stonePreset(kat, nazwaKamienia), [kat, nazwaKamienia])
  const idBase = 'stone'

  const pow = ksztalt === 'prosty' ? (a * b2) / 10000 : (a * b2 + a2 * b3) / 10000
  const obwod = ksztalt === 'prosty' ? (2 * (a + b2)) / 100 : (a + b2 + a2 + b3 + Math.abs(a - a2) + Math.abs(b2 - b3)) / 100

  async function zapiszDoArchiwum() {
    const svg = svgRef.current
    if (!svg) return
    try {
      const png = await svgNaPng(svg, 1400)
      const skan: Skan = {
        id: uid('skan'),
        nazwa: `Wizualizacja – ${nazwaKamienia}`,
        kategoria: 'projekt',
        strony: [png],
        klientId: klientId || undefined,
        zlecenieId: zlecenieId || undefined,
        notatka: `${nazwaKamienia} · ${ksztalt === 'prosty' ? `${a}×${b2} cm` : 'blat w kształcie L'} · ${fmtNum(pow, 2)} m²`,
        utworzono: nowISO(),
      }
      upsert('skany', skan)
      push('Wizualizacja zapisana w Archiwum')
    } catch {
      push('Nie udało się zapisać wizualizacji', 'err')
    }
  }

  return (
    <div>
      <PageHeader
        title="Wizualizacja projektu"
        subtitle="Podgląd blatu w wybranym kamieniu — pokaż klientowi efekt „na żywo”"
        icon={<Sparkles size={22} />}
        actions={
          <>
            <button className="btn-outline" onClick={zapiszDoArchiwum}>
              <Save size={16} /> Zapisz
            </button>
            <PrintSendBar
              getPrintNode={() => (
                <WizualizacjaDoc firma={firma} nazwaKamienia={nazwaKamienia} kat={kat} preset={preset} ksztalt={ksztalt} a={a} b={b2} a2={a2} b3={b3} grubosc={grubosc} krawedz={krawedz} zlew={zlew} plyta={plyta} pow={pow} obwod={obwod} />
              )}
              share={{ title: `Wizualizacja – ${nazwaKamienia}`, text: `Wizualizacja blatu: ${nazwaKamienia}, ${fmtNum(pow, 2)} m², wykończenie krawędzi: ${krawedz}.` }}
              size="sm"
            />
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr]">
        {/* Panel ustawien */}
        <Card>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Rodzaj kamienia">
                <Select value={kat} onChange={(e) => setKat(e.target.value as ProduktKategoria)}>
                  {KATEGORIE.map((k) => (
                    <option key={k.k} value={k.k}>{k.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Nazwa / kolor">
                <Input value={nazwaKamienia} onChange={(e) => setNazwaKamienia(e.target.value)} placeholder="np. Nero Assoluto" />
              </Field>
            </div>
            <Field label="Kształt blatu">
              <div className="flex gap-2">
                {(['prosty', 'L'] as const).map((k) => (
                  <button key={k} onClick={() => setKsztalt(k)} className={cx('flex-1 rounded-lg border px-3 py-2 text-[13px] font-medium', ksztalt === k ? 'border-white/20 bg-white/10 text-white' : 'border-white/10 text-stone-400 hover:bg-white/5')}>
                    {k === 'prosty' ? 'Prosty' : 'Kształt L'}
                  </button>
                ))}
              </div>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Długość A (cm)"><Input type="number" value={a} onChange={(e) => setA(+e.target.value)} /></Field>
              <Field label="Głębokość (cm)"><Input type="number" value={b2} onChange={(e) => setB2(+e.target.value)} /></Field>
            </div>
            {ksztalt === 'L' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Ramię B (cm)"><Input type="number" value={a2} onChange={(e) => setA2(+e.target.value)} /></Field>
                <Field label="Głębokość B (cm)"><Input type="number" value={b3} onChange={(e) => setB3(+e.target.value)} /></Field>
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grubość"><Input value={grubosc} onChange={(e) => setGrubosc(e.target.value)} /></Field>
              <Field label="Krawędź">
                <Select value={krawedz} onChange={(e) => setKrawedz(e.target.value)}>
                  {['prosta', 'fazowana', 'zaokrąglona', 'półwałek', 'skośna'].map((k) => <option key={k}>{k}</option>)}
                </Select>
              </Field>
            </div>
            <div className="flex gap-4">
              <Toggle checked={zlew} onChange={setZlew} label="Wycięcie na zlew" />
              <Toggle checked={plyta} onChange={setPlyta} label="Płyta grzewcza" />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-white/10 pt-3">
              <Field label="Klient">
                <Select value={klientId} onChange={(e) => setKlientId(e.target.value)}>
                  <option value="">— brak —</option>
                  {b.klienci.map((k) => <option key={k.id} value={k.id}>{klientNazwa(k)}</option>)}
                </Select>
              </Field>
              <Field label="Zlecenie">
                <Select value={zlecenieId} onChange={(e) => setZlecenieId(e.target.value)}>
                  <option value="">— brak —</option>
                  {b.zlecenia.map((z) => <option key={z.id} value={z.id}>{z.numer}</option>)}
                </Select>
              </Field>
            </div>
          </CardBody>
        </Card>

        {/* Podglad */}
        <div>
          <div className="mb-3 flex gap-2">
            <button onClick={() => setWidok('kuchnia')} className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium', widok === 'kuchnia' ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5')}><Home size={15} /> Wizualizacja kuchni</button>
            <button onClick={() => setWidok('blat')} className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium', widok === 'blat' ? 'bg-white/10 text-white' : 'text-stone-400 hover:bg-white/5')}><SquareStack size={15} /> Rzut blatu</button>
          </div>
          <Card className="overflow-hidden">
            <div className="bg-[#0e0f16] p-4">
              {widok === 'kuchnia' ? (
                <SceneKuchnia refEl={svgRef} idBase={idBase} preset={preset} zlew={zlew} plyta={plyta} nazwa={nazwaKamienia} />
              ) : (
                <RzutBlatu refEl={svgRef} idBase={idBase} preset={preset} ksztalt={ksztalt} a={a} b={b2} a2={a2} b3={b3} zlew={zlew} plyta={plyta} />
              )}
            </div>
          </Card>
          {/* Info */}
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Info label="Materiał" value={nazwaKamienia} />
            <Info label="Powierzchnia" value={`${fmtNum(pow, 2)} m²`} />
            <Info label="Obwód" value={`${fmtNum(obwod, 2)} mb`} />
            <Info label="Grubość / krawędź" value={`${grubosc} · ${krawedz}`} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="card card-pad !p-3">
      <div className="text-[11px] uppercase tracking-wide text-stone-500">{label}</div>
      <div className="mt-0.5 text-[14px] font-semibold text-ink">{value}</div>
    </div>
  )
}

// ---------- Scena kuchni ----------
function SceneKuchnia({ refEl, idBase, preset, zlew, plyta, nazwa }: { refEl: React.Ref<SVGSVGElement>; idBase: string; preset: StonePreset; zlew: boolean; plyta: boolean; nazwa: string }) {
  return (
    <svg ref={refEl} viewBox="0 0 800 480" className="w-full" style={{ display: 'block' }}>
      <StoneDefs id={idBase} p={preset} />
      {/* sciana */}
      <rect x="0" y="0" width="800" height="480" fill="#e9e6df" />
      <rect x="0" y="0" width="800" height="300" fill="#efece6" />
      {/* okno */}
      <rect x="520" y="60" width="210" height="150" rx="4" fill="#cfe0e6" stroke="#b9c3c7" strokeWidth="3" />
      <line x1="625" y1="60" x2="625" y2="210" stroke="#b9c3c7" strokeWidth="3" />
      <line x1="520" y1="135" x2="730" y2="135" stroke="#b9c3c7" strokeWidth="3" />
      {/* szafki gorne */}
      {[60, 190, 320].map((x) => (
        <g key={x}>
          <rect x={x} y="70" width="120" height="120" rx="4" fill="#f3f1ec" stroke="#ddd8cf" strokeWidth="2" />
          <rect x={x + 54} y="130" width="12" height="34" rx="4" fill="#c2bcb0" />
        </g>
      ))}
      {/* plyta ochronna (backsplash) */}
      <rect x="40" y="250" width="720" height="42" fill={`url(#${idBase}-g)`} opacity="0.9" />
      <rect x="40" y="250" width="720" height="42" fill="#808080" filter={`url(#${idBase}-tex)`} opacity={preset.kontrast * 0.7} style={{ mixBlendMode: czyCiemny(preset) ? 'screen' : 'overlay' }} />
      {/* BLAT (hero) */}
      <g>
        <StoneRect x={40} y={292} w={720} h={26} id={idBase} p={preset} />
        <rect x="40" y="316" width="720" height="6" fill="#000" opacity="0.18" />
      </g>
      {/* front szafek dolnych */}
      <rect x="40" y="322" width="720" height="150" fill="#eae6de" />
      {[60, 190, 320, 450, 580, 665].map((x, i) => (
        <g key={x}>
          <rect x={x} y="330" width={i === 5 ? 90 : 120} height="134" rx="4" fill="#f0ede6" stroke="#ddd8cf" strokeWidth="2" />
          <rect x={x + (i === 5 ? 40 : 54)} y="360" width="12" height="34" rx="4" fill="#c2bcb0" />
        </g>
      ))}
      {/* zlew */}
      {zlew && (
        <g>
          <rect x="150" y="298" width="120" height="14" rx="6" fill="#00000022" />
          <rect x="158" y="300" width="104" height="10" rx="5" fill="#c9ccd0" />
          <rect x="205" y="276" width="8" height="26" rx="4" fill="#b7bcc2" />
          <circle cx="209" cy="274" r="7" fill="#c9ccd0" />
        </g>
      )}
      {/* plyta grzewcza */}
      {plyta && <rect x="470" y="300" width="150" height="12" rx="4" fill="#1c1c22" opacity="0.85" />}
      {/* podpis materialu */}
      <g>
        <rect x="40" y="430" width="210" height="34" rx="8" fill="#12130f" opacity="0.85" />
        <text x="56" y="452" fill="#fff" fontFamily="Inter, sans-serif" fontSize="15" fontWeight="600">{nazwa}</text>
      </g>
    </svg>
  )
}

// ---------- Rzut blatu z gory ----------
function RzutBlatu({ refEl, idBase, preset, ksztalt, a, b, a2, b3, zlew, plyta }: { refEl: React.Ref<SVGSVGElement>; idBase: string; preset: StonePreset; ksztalt: 'prosty' | 'L'; a: number; b: number; a2: number; b3: number; zlew: boolean; plyta: boolean }) {
  const pad = 70
  const maxW = 660, maxH = 340
  const totalW = ksztalt === 'prosty' ? a : Math.max(a, b3)
  const totalH = ksztalt === 'prosty' ? b : Math.max(b, a2)
  const s = Math.min(maxW / totalW, maxH / totalH)
  const W = totalW * s, H = totalH * s
  const ink = '#3a3a3a'

  let d: string
  if (ksztalt === 'prosty') {
    d = `M${pad},${pad} h${a * s} v${b * s} h${-a * s} z`
  } else {
    d = `M${pad},${pad} h${a * s} v${b * s} h${-(a - b3) * s} v${(a2 - b) * s} h${-b3 * s} z`
  }

  return (
    <svg ref={refEl} viewBox={`0 0 ${W + pad * 2} ${H + pad * 2}`} className="mx-auto w-full max-w-[720px]" style={{ display: 'block' }}>
      <StoneDefs id={idBase} p={preset} />
      <rect x="0" y="0" width={W + pad * 2} height={H + pad * 2} fill="#0e0f16" />
      {/* cien */}
      <path d={d} transform="translate(6,8)" fill="#000" opacity="0.35" />
      <StonePath d={d} id={idBase} p={preset} />
      <path d={d} fill="none" stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1.5" />

      {/* wyciecia */}
      {zlew && <rect x={pad + 0.18 * a * s} y={pad + 0.28 * b * s} width={0.16 * a * s} height={0.42 * b * s} rx={8} fill="#0e0f16" stroke="#ffffff55" strokeWidth="1.5" />}
      {plyta && <rect x={pad + 0.55 * a * s} y={pad + 0.28 * b * s} width={0.18 * a * s} height={0.42 * b * s} rx={4} fill="#0e0f16" stroke="#ffffff55" strokeWidth="1.5" />}

      {/* wymiary */}
      <Wymiar x1={pad} y1={pad - 22} x2={pad + a * s} y2={pad - 22} label={`${a} cm`} ink="#c9ccd6" />
      <Wymiar x1={pad - 22} y1={pad} x2={pad - 22} y2={pad + b * s} label={`${b} cm`} pion ink="#c9ccd6" />
    </svg>
  )
}

function Wymiar({ x1, y1, x2, y2, label, pion, ink }: { x1: number; y1: number; x2: number; y2: number; label: string; pion?: boolean; ink: string }) {
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
  return (
    <g stroke={ink} fill={ink} fontFamily="Inter, sans-serif" fontSize="12">
      <line x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth="1" />
      <line x1={x1} y1={y1 - (pion ? 0 : 5)} x2={x1} y2={y1 + (pion ? 0 : 5)} />
      <line x1={x2} y1={y2 - (pion ? 0 : 5)} x2={x2} y2={y2 + (pion ? 0 : 5)} />
      <text x={pion ? mx - 8 : mx} y={pion ? my : my - 6} textAnchor="middle" transform={pion ? `rotate(-90 ${mx - 8} ${my})` : undefined} stroke="none">{label}</text>
    </g>
  )
}

// ---------- Eksport SVG -> PNG ----------
function svgNaPng(svg: SVGSVGElement, szer = 1400): Promise<string> {
  return new Promise((res, rej) => {
    const xml = new XMLSerializer().serializeToString(svg)
    const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const vb = svg.viewBox.baseVal
      const ratio = vb.height / vb.width || 0.6
      const c = document.createElement('canvas')
      c.width = szer
      c.height = Math.round(szer * ratio)
      const ctx = c.getContext('2d')!
      ctx.fillStyle = '#0e0f16'
      ctx.fillRect(0, 0, c.width, c.height)
      ctx.drawImage(img, 0, 0, c.width, c.height)
      res(c.toDataURL('image/jpeg', 0.85))
    }
    img.onerror = rej
    img.src = svg64
  })
}

// ---------- Dokument do druku ----------
function WizualizacjaDoc({ firma, nazwaKamienia, preset, ksztalt, a, b, a2, b3, grubosc, krawedz, zlew, plyta, pow, obwod }: any) {
  const id = 'stonep'
  return (
    <DocSheet firma={firma}>
      <h1 style={{ textAlign: 'center', fontFamily: "'Inter Tight', serif", fontSize: '16pt', fontWeight: 600, margin: '4px 0 2px' }}>Wizualizacja projektu</h1>
      <div style={{ textAlign: 'center', color: '#6b6459', fontSize: '9pt', marginBottom: 14 }}>Materiał: {nazwaKamienia}</div>
      <div style={{ border: '1px solid #d3cfc2', borderRadius: 10, overflow: 'hidden', marginBottom: 14 }}>
        <svg viewBox="0 0 800 300" style={{ width: '100%', display: 'block' }}>
          <StoneDefs id={id} p={preset} />
          <rect x="0" y="0" width="800" height="300" fill="#eeece7" />
          <rect x="40" y="150" width="720" height="26" fill={`url(#${id}-g)`} />
          <StoneRect x={40} y={176} w={720} h={26} id={id} p={preset} />
          <rect x="40" y="202" width="720" height="70" fill="#eae6de" />
          {[60, 240, 420, 600].map((x) => <rect key={x} x={x} y="208" width="150" height="60" rx="4" fill="#f0ede6" stroke="#ddd8cf" strokeWidth="2" />)}
        </svg>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9.5pt' }}>
        <tbody>
          {[
            ['Materiał', nazwaKamienia],
            ['Kształt', ksztalt === 'prosty' ? `prosty ${a}×${b} cm` : `kształt L (${a}×${b} + ${a2}×${b3} cm)`],
            ['Powierzchnia', `${fmtNum(pow, 2)} m²`],
            ['Obwód (obróbki)', `${fmtNum(obwod, 2)} mb`],
            ['Grubość', grubosc],
            ['Wykończenie krawędzi', krawedz],
            ['Wycięcia', [zlew && 'zlew', plyta && 'płyta grzewcza'].filter(Boolean).join(', ') || '—'],
          ].map(([k, v]) => (
            <tr key={k as string}>
              <td style={{ border: '1px solid #d3cfc2', padding: '5px 8px', fontWeight: 600, width: 180, background: '#f5f3ee' }}>{k}</td>
              <td style={{ border: '1px solid #d3cfc2', padding: '5px 8px' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p style={{ fontSize: '7.6pt', color: '#8a8478', marginTop: 10 }}>
        Wizualizacja poglądowa. Kamień naturalny cechuje niepowtarzalny rysunek i odcień — rzeczywisty wygląd może różnić się od podglądu.
      </p>
    </DocSheet>
  )
}
