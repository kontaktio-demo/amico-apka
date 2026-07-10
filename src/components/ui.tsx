import React, { createContext, useContext, useState, useCallback, useEffect } from 'react'
import { clsx } from 'clsx'
import { X, Search, Check, AlertTriangle, Info, Loader2 } from 'lucide-react'

export const cx = clsx

// ---------- Naglowek strony ----------
export function PageHeader({
  title,
  subtitle,
  icon,
  actions,
}: {
  title: string
  subtitle?: string
  icon?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-3">
        {icon && <div className="grid h-11 w-11 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</div>}
        <div>
          <h1 className="text-[26px] font-display font-semibold text-ink leading-tight">{title}</h1>
          {subtitle && <p className="text-[14px] text-stone-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

// ---------- Karta ----------
export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('card', className)}>{children}</div>
}
export function CardBody({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cx('card-pad', className)}>{children}</div>
}
export function SectionCard({
  title,
  icon,
  desc,
  actions,
  children,
  className,
}: {
  title?: string
  icon?: React.ReactNode
  desc?: string
  actions?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <div className={cx('card card-pad', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            {icon && <span className="text-brand-700">{icon}</span>}
            <div>
              {title && <h3 className="text-[15px] font-semibold text-ink">{title}</h3>}
              {desc && <p className="text-[12.5px] text-stone-500">{desc}</p>}
            </div>
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  )
}

// ---------- Pola formularza ----------
export function Field({
  label,
  children,
  hint,
  error,
  required,
  className,
}: {
  label?: string
  children: React.ReactNode
  hint?: string
  error?: string
  required?: boolean
  className?: string
}) {
  return (
    <label className={cx('block', className)}>
      {label && (
        <span className="label">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </span>
      )}
      {children}
      {hint && !error && <span className="mt-1 block text-[12px] text-stone-400">{hint}</span>}
      {error && <span className="mt-1 block text-[12px] text-red-600">{error}</span>}
    </label>
  )
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...p }, ref) => <input ref={ref} className={cx('input', className)} {...p} />,
)
Input.displayName = 'Input'

export function Textarea({ className, ...p }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('textarea', className)} rows={3} {...p} />
}

export function Select({ className, children, ...p }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx('select', className)} {...p}>
      {children}
    </select>
  )
}

export function Checkbox({
  label,
  checked,
  onChange,
  className,
}: {
  label?: React.ReactNode
  checked?: boolean
  onChange?: (v: boolean) => void
  className?: string
}) {
  return (
    <label className={cx('flex items-start gap-2.5 cursor-pointer select-none', className)}>
      <span
        className={cx(
          'mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border transition',
          checked ? 'border-brand-700 bg-brand-700 text-white' : 'border-stone-300 bg-white',
        )}
        onClick={() => onChange?.(!checked)}
      >
        {checked && <Check size={14} strokeWidth={3} />}
      </span>
      {label && <span className="text-[14px] text-stone-700 leading-snug">{label}</span>}
    </label>
  )
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <label className="flex items-center gap-2.5 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={cx('relative h-6 w-11 rounded-full transition', checked ? 'bg-brand-700' : 'bg-stone-300')}
      >
        <span className={cx('absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition', checked ? 'left-[22px]' : 'left-0.5')} />
      </span>
      {label && <span className="text-[14px] text-stone-700">{label}</span>}
    </label>
  )
}

// ---------- Wyszukiwarka ----------
export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="relative">
      <Search size={17} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || 'Szukaj…'}
        className="input pl-10"
      />
    </div>
  )
}

// ---------- Odznaki ----------
export function Badge({ tone = 'stone', children }: { tone?: 'green' | 'stone' | 'amber' | 'blue' | 'red'; children: React.ReactNode }) {
  return <span className={`badge-${tone}`}>{children}</span>
}

// ---------- Pusty stan ----------
export function EmptyState({ icon, title, desc, action }: { icon?: React.ReactNode; title: string; desc?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-300 bg-stone-25 px-6 py-14 text-center">
      {icon && <div className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-stone-100 text-stone-400">{icon}</div>}
      <h3 className="text-[16px] font-semibold text-stone-700">{title}</h3>
      {desc && <p className="mt-1 max-w-sm text-[13.5px] text-stone-500">{desc}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

// ---------- Statystyka ----------
export function Stat({ label, value, sub, tone = 'stone', icon }: { label: string; value: React.ReactNode; sub?: string; tone?: string; icon?: React.ReactNode }) {
  return (
    <div className="card card-pad">
      <div className="flex items-center justify-between">
        <span className="text-[12.5px] font-medium uppercase tracking-wide text-stone-500">{label}</span>
        {icon && <span className="text-stone-300">{icon}</span>}
      </div>
      <div className={cx('mt-2 text-[26px] font-display font-semibold', tone === 'green' ? 'text-brand-700' : 'text-ink')}>{value}</div>
      {sub && <div className="mt-1 text-[12.5px] text-stone-400">{sub}</div>}
    </div>
  )
}

// ---------- Modal ----------
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl'
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  const w = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl', xl: 'max-w-5xl' }[size]
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:p-8" onClick={onClose}>
      <div className={cx('card w-full animate-scale-in my-auto', w)} onClick={(e) => e.stopPropagation()}>
        {title && (
          <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4">
            <h2 className="text-[18px] font-display font-semibold text-ink">{title}</h2>
            <button className="btn-ghost -mr-2 !px-2" onClick={onClose}>
              <X size={20} />
            </button>
          </div>
        )}
        <div className="px-6 py-5">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-6 py-4">{footer}</div>}
      </div>
    </div>
  )
}

// ---------- Toast / powiadomienia ----------
type Toast = { id: string; msg: string; tone: 'ok' | 'err' | 'info' }
const ToastCtx = createContext<{ push: (msg: string, tone?: Toast['tone']) => void }>({ push: () => {} })
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((msg: string, tone: Toast['tone'] = 'ok') => {
    const id = Math.random().toString(36).slice(2)
    setItems((s) => [...s, { id, msg, tone }])
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), 3200)
  }, [])
  return (
    <ToastCtx.Provider value={{ push }}>
      {children}
      <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 flex-col items-center gap-2 no-print">
        {items.map((t) => (
          <div
            key={t.id}
            className={cx(
              'flex items-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium text-white shadow-pop animate-fade-in',
              t.tone === 'ok' && 'bg-emerald-600',
              t.tone === 'err' && 'bg-red-600',
              t.tone === 'info' && 'bg-[#181b26] border border-white/10',
            )}
          >
            {t.tone === 'ok' && <Check size={16} />}
            {t.tone === 'err' && <AlertTriangle size={16} />}
            {t.tone === 'info' && <Info size={16} />}
            {t.msg}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}

// ---------- Potwierdzenie ----------
export function useConfirm() {
  const [state, setState] = useState<{ open: boolean; msg: string; resolve?: (v: boolean) => void }>({ open: false, msg: '' })
  const confirm = useCallback((msg: string) => new Promise<boolean>((resolve) => setState({ open: true, msg, resolve })), [])
  const node = (
    <Modal
      open={state.open}
      onClose={() => {
        state.resolve?.(false)
        setState({ open: false, msg: '' })
      }}
      title="Potwierdzenie"
      footer={
        <>
          <button
            className="btn-outline"
            onClick={() => {
              state.resolve?.(false)
              setState({ open: false, msg: '' })
            }}
          >
            Anuluj
          </button>
          <button
            className="btn-danger"
            onClick={() => {
              state.resolve?.(true)
              setState({ open: false, msg: '' })
            }}
          >
            Tak, kontynuuj
          </button>
        </>
      }
    >
      <p className="text-[15px] text-stone-600">{state.msg}</p>
    </Modal>
  )
  return { confirm, confirmNode: node }
}

export function Spinner() {
  return <Loader2 className="animate-spin" size={18} />
}
