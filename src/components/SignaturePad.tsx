import { useRef, useEffect, useState, useCallback } from 'react'
import { Eraser, PenLine, Check, RotateCcw } from 'lucide-react'
import { Modal, Field, Input } from './ui'
import type { Signature } from '../lib/types'
import { nowISO, fmtDateTime } from '../lib/format'

// ---------- Plotno podpisu (pointer events, HiDPI, touch-action none) ----------
function useSignatureCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef<{ x: number; y: number } | null>(null)
  const [empty, setEmpty] = useState(true)

  const setup = useCallback(() => {
    const c = canvasRef.current
    if (!c) return
    const dpr = window.devicePixelRatio || 1
    const rect = c.getBoundingClientRect()
    c.width = rect.width * dpr
    c.height = rect.height * dpr
    const ctx = c.getContext('2d')!
    ctx.scale(dpr, dpr)
    ctx.lineWidth = 2.4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#12261c'
  }, [])

  useEffect(() => {
    setup()
    const onResize = () => setup()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [setup])

  const pos = (e: React.PointerEvent) => {
    const c = canvasRef.current!
    const r = c.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = (e: React.PointerEvent) => {
    e.preventDefault()
    drawing.current = true
    last.current = pos(e)
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return
    const ctx = canvasRef.current!.getContext('2d')!
    const p = pos(e)
    ctx.beginPath()
    ctx.moveTo(last.current!.x, last.current!.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (empty) setEmpty(false)
  }
  const up = () => {
    drawing.current = false
    last.current = null
  }
  const clear = () => {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')!
    ctx.clearRect(0, 0, c.width, c.height)
    setEmpty(true)
  }
  const toDataURL = () => canvasRef.current?.toDataURL('image/png') || ''

  return { canvasRef, down, move, up, clear, empty, toDataURL }
}

export function SignatureModal({
  open,
  onClose,
  onSave,
  domyslnyPodpisujacy = '',
  rola,
  dokumentId,
  klauzula,
}: {
  open: boolean
  onClose: () => void
  onSave: (sig: Signature) => void
  domyslnyPodpisujacy?: string
  rola?: string
  dokumentId?: string
  klauzula?: string
}) {
  const pad = useSignatureCanvas()
  const [signer, setSigner] = useState(domyslnyPodpisujacy)
  useEffect(() => {
    if (open) {
      setSigner(domyslnyPodpisujacy)
      setTimeout(() => pad.clear(), 30)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, domyslnyPodpisujacy])

  const zapisz = () => {
    if (pad.empty) return
    onSave({
      dataUrl: pad.toDataURL(),
      signedAt: nowISO(),
      signer: signer.trim(),
      role: rola,
      urzadzenie: navigator.userAgent,
      dokumentId,
    })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={rola ? `Podpis – ${rola}` : 'Podpis'}
      size="lg"
      footer={
        <>
          <button className="btn-outline" onClick={pad.clear}>
            <Eraser size={16} /> Wyczyść
          </button>
          <div className="flex-1" />
          <button className="btn-ghost" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={zapisz} disabled={pad.empty}>
            <Check size={16} /> Zatwierdź podpis
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="Imię i nazwisko podpisującego">
          <Input value={signer} onChange={(e) => setSigner(e.target.value)} placeholder="np. Jan Kowalski" />
        </Field>
        {klauzula && (
          <p className="rounded-xl bg-stone-50 p-3 text-[12px] leading-relaxed text-stone-500">{klauzula}</p>
        )}
        <div>
          <div className="mb-1.5 flex items-center gap-2 text-[13px] font-medium text-stone-500">
            <PenLine size={15} /> Złóż podpis palcem lub rysikiem w polu poniżej
          </div>
          <canvas
            ref={pad.canvasRef}
            onPointerDown={pad.down}
            onPointerMove={pad.move}
            onPointerUp={pad.up}
            onPointerLeave={pad.up}
            className="h-56 w-full touch-none rounded-2xl border-2 border-dashed border-stone-300 bg-white"
            style={{ touchAction: 'none' }}
          />
        </div>
      </div>
    </Modal>
  )
}

// ---------- Podglad zapisanego podpisu ----------
export function SignatureView({ sig, label }: { sig?: Signature; label?: string }) {
  if (!sig)
    return (
      <div
        style={{
          display: 'flex',
          height: 76,
          alignItems: 'flex-end',
          justifyContent: 'center',
          borderBottom: '1px solid #a9a496',
          paddingBottom: 3,
          fontSize: '11px',
          color: '#a9a496',
        }}
      >
        {label || '(brak podpisu)'}
      </div>
    )
  return (
    <div style={{ textAlign: 'center' }}>
      <img src={sig.dataUrl} alt="podpis" style={{ margin: '0 auto', height: 66, objectFit: 'contain' }} />
      <div style={{ borderTop: '1px solid #4a463f', paddingTop: 3, fontSize: '11px', color: '#4a463f' }}>
        {sig.signer || label}
        <div style={{ fontSize: '9.5px', color: '#8a8478' }}>podpisano {fmtDateTime(sig.signedAt)}</div>
      </div>
    </div>
  )
}

// ---------- Przycisk uruchamiajacy podpis + slot na podpis ----------
export function SignatureField({
  sig,
  onSign,
  label,
  rola,
}: {
  sig?: Signature
  onSign: () => void
  label: string
  rola?: string
}) {
  return (
    <div className="rounded-2xl border border-stone-200 p-4 text-center">
      <div className="mb-2 text-[12px] font-medium uppercase tracking-wide text-stone-500">{label}</div>
      {sig ? (
        <button onClick={onSign} className="w-full">
          <img src={sig.dataUrl} alt="podpis" className="mx-auto h-16 object-contain" />
          <div className="mt-1 text-[12px] text-stone-600">{sig.signer}</div>
        </button>
      ) : (
        <button className="btn-outline w-full" onClick={onSign}>
          <PenLine size={16} /> Podpisz {rola ? `– ${rola}` : ''}
        </button>
      )}
    </div>
  )
}
