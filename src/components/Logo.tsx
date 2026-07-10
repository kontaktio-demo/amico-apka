import { clsx } from 'clsx'

// Oryginalne wektory logo AMICO (ze strony amico.kontaktio.pl)
const WORDMARK_PATHS = [
  'M602.5,245.7c-13.5,0-24.4,14-24.4,31.3s10.9,31.3,24.4,31.3,24.4-14,24.4-31.3-10.9-31.3-24.4-31.3M651.5,277c0,34.7-21.9,62.8-49,62.8s-49-28.1-49-62.8,21.9-62.8,49-62.8,49,28.1,49,62.8',
  'M211,272.6c0,1.7,1,2.8,2.8,2.8,2.6,0,16.8-3.8,29.6-3.8s7.4-.7,7.4-4.8c0-9-10.8-28-16.3-28-7.9,0-23.5,23.2-23.5,33.8M249.3,337.3c-1.3,0-5.5.4-5.5-1.7,0-4.1,11.2-18.6,11.2-35.3s-6.3-9-12.8-9c-13.3,0-34.4,2.3-34.4,18.9s9.5,23.9,9.5,26.1-.9,1-2.8,1h-20.8c-7.4,0-9.5-13.1-9.5-32.1,0-62.4,43.3-91.3,49.7-91.3s42.4,20.8,42.4,88.4-6.3,35-10.6,35h-16.3Z',
  'M379.2,337.3c-1.8,0-5.2.4-5.2-2.2s2.9-10.8,5.2-26.2c1.7-10.8,3.1-24.5,3.1-40.1s.4-21-4.4-21-9.8,14.4-11.2,17.9c-12.2,29.9-10.2,36.6-16.7,36.6s-7.8-6.7-20.8-36.6c-1.5-3.2-6.3-17.9-10.8-17.9s-4.7,17.9-4.7,21c0,38,9.2,64.3,9.2,66.3s-3.5,2.2-5.2,2.2c-3.6,0-23.6,2.8-23.6-51.9s21-69.3,23.5-69.3c5.7,0,7.7,0,14.9,9.8,13.7,18.8,14.6,29.4,17.5,29.4s3.1-10.6,18.5-29.4c8.2-9.9,10.3-9.8,16-9.8s21.4-2.6,21.4,69.3-23,51.9-26.7,51.9Z',
  'M431.7,337.8c-3.6,0-8,2.8-8-51.9s7.6-69.3,10.1-69.3h15.7c1.9,0,5.5-.4,5.5,2.3s-7.7,25.8-7.7,53.9,7.3,61.3,7.3,63.4-.9,1.6-2.2,1.6h-20.7Z',
  'M460.1,280.1c0-31.6,17.8-66.1,53.2-66.1s32.2,5.4,32.2,21.1-5.8,13.3-15,13.3,2-13.7-16.5-13.7-30.3,21.7-30.3,39.9c0,27.8,18.9,39,31.6,39,23.7,0,25.8-21.3,27.1-21.3,2,0,3.2,11.7,3.2,13.1,0,21.6-16.6,34.1-37,34.1-33.1,0-48.5-30-48.5-59.4',
]
const M_PATH =
  'M379.2,337.3c-1.8,0-5.2.4-5.2-2.2s2.9-10.8,5.2-26.2c1.7-10.8,3.1-24.5,3.1-40.1s.4-21-4.4-21-9.8,14.4-11.2,17.9c-12.2,29.9-10.2,36.6-16.7,36.6s-7.8-6.7-20.8-36.6c-1.5-3.2-6.3-17.9-10.8-17.9s-4.7,17.9-4.7,21c0,38,9.2,64.3,9.2,66.3s-3.5,2.2-5.2,2.2c-3.6,0-23.6,2.8-23.6-51.9s21-69.3,23.5-69.3c5.7,0,7.7,0,14.9,9.8,13.7,18.8,14.6,29.4,17.5,29.4s3.1-10.6,18.5-29.4c8.2-9.9,10.3-9.8,16-9.8s21.4-2.6,21.4,69.3-23,51.9-26.7,51.9Z'

// Pełny znak słowny AMICO – kolor przez currentColor
export function AmicoWordmark({ className, height = 26 }: { className?: string; height?: number }) {
  return (
    <svg viewBox="181 205 474 145" height={height} className={className} role="img" aria-label="AMICO" style={{ display: 'block' }}>
      {WORDMARK_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
    </svg>
  )
}

// Kafelek-ikona (granatowe tło + białe „M") – jak favicon
export function LogoMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="263.4 191.4 172.9 172.9" className={className} aria-hidden>
      <rect x="263.4" y="191.4" width="172.9" height="172.9" rx="20.7" ry="20.7" fill="#0e1533" />
      <path fill="#ffffff" d={M_PATH} />
    </svg>
  )
}

export function Logo({
  variant = 'full',
  className,
  tone = 'light',
}: {
  variant?: 'full' | 'compact'
  className?: string
  tone?: 'dark' | 'light'
}) {
  const color = tone === 'light' ? 'text-white' : 'text-ink'
  const sub = tone === 'light' ? 'text-white/45' : 'text-stone-500'
  return (
    <div className={clsx('flex items-center gap-3', className)}>
      <LogoMark size={variant === 'full' ? 38 : 32} className="rounded-[9px]" />
      <div className="leading-none">
        <AmicoWordmark height={variant === 'full' ? 20 : 17} className={color} />
        {variant === 'full' && (
          <div className={clsx('mt-1.5 text-[9px] font-medium uppercase tracking-[0.24em]', sub)}>Pracownia Kamieniarska</div>
        )}
      </div>
    </div>
  )
}
