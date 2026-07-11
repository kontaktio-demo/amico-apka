import type { Pozycja, VatRate } from './types'

// ---------- Liczby / waluta ----------
export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

export function fmtPLN(n: number | undefined | null, opts: { symbol?: boolean } = {}): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0
  const s = v.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return opts.symbol === false ? s : `${s} zł`
}

export function fmtNum(n: number | undefined | null, dec = 2): string {
  const v = Number.isFinite(n as number) ? (n as number) : 0
  return v.toLocaleString('pl-PL', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

export function parseNum(s: string | number | undefined): number {
  if (typeof s === 'number') return s
  if (!s) return 0
  const cleaned = String(s).replace(/\s/g, '').replace(/zł/gi, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

// ---------- Daty ----------
const MIESIACE = [
  'stycznia',
  'lutego',
  'marca',
  'kwietnia',
  'maja',
  'czerwca',
  'lipca',
  'sierpnia',
  'września',
  'października',
  'listopada',
  'grudnia',
]
const MIESIACE_M = [
  'styczeń',
  'luty',
  'marzec',
  'kwiecień',
  'maj',
  'czerwiec',
  'lipiec',
  'sierpień',
  'wrzesień',
  'październik',
  'listopad',
  'grudzień',
]
const DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota']

export function today(): string {
  const d = new Date()
  return toISO(d)
}
export function nowISO(): string {
  return new Date().toISOString()
}
export function toISO(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
export function fmtDate(iso?: string): string {
  if (!iso) return ''
  const [y, m, d] = iso.split('T')[0].split('-')
  if (!y || !m || !d) return iso
  return `${d}.${m}.${y}`
}
export function fmtDateLong(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${d.getDate()} ${MIESIACE[d.getMonth()]} ${d.getFullYear()} r.`
}
export function fmtMonthYear(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return `${MIESIACE_M[d.getMonth()]} ${d.getFullYear()}`
}
export function dayName(iso: string): string {
  const d = new Date(iso)
  return DNI[d.getDay()]
}
export function fmtDateTime(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return `${fmtDate(toISO(d))}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export function addDays(iso: string, days: number): string {
  const d = new Date(iso)
  d.setDate(d.getDate() + days)
  return toISO(d)
}

// ---------- Kosztorys ----------
export interface Podsumowanie {
  netto: number
  vat: number
  brutto: number
  wgStawek: Record<string, { netto: number; vat: number; brutto: number }>
}
export function pozycjaNetto(p: Pozycja): number {
  const base = (p.ilosc || 0) * (p.cenaNetto || 0)
  const rab = p.rabat ? base * (1 - p.rabat / 100) : base
  return round2(rab)
}
export function podsumuj(pozycje: Pozycja[]): Podsumowanie {
  const wgStawek: Podsumowanie['wgStawek'] = {}
  let netto = 0
  let vat = 0
  for (const p of pozycje) {
    const n = pozycjaNetto(p)
    const v = round2(n * (p.vat / 100))
    netto += n
    vat += v
    const key = String(p.vat)
    if (!wgStawek[key]) wgStawek[key] = { netto: 0, vat: 0, brutto: 0 }
    wgStawek[key].netto += n
    wgStawek[key].vat += v
    wgStawek[key].brutto += n + v
  }
  netto = round2(netto)
  vat = round2(vat)
  return { netto, vat, brutto: round2(netto + vat), wgStawek }
}
export function bruttoZNetto(netto: number, vat: VatRate): number {
  return round2(netto * (1 + vat / 100))
}
export function nettoZBrutto(brutto: number, vat: VatRate): number {
  return round2(brutto / (1 + vat / 100))
}

// ---------- Numer konta (NRB / IBAN PL) ----------
export function cleanKonto(s: string): string {
  return (s || '').replace(/\s/g, '').replace(/^PL/i, '')
}
export function fmtKonto(s: string): string {
  const c = cleanKonto(s)
  if (c.length !== 26) return s
  return c.replace(/(\d{2})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})(\d{4})/, '$1 $2 $3 $4 $5 $6 $7')
}
export function validNRB(s: string): boolean {
  const c = cleanKonto(s)
  if (!/^\d{26}$/.test(c)) return false
  // IBAN: przenies PL (2521) na koniec, dopisz kod kraju 2521 + 00, mod 97 == 1
  const rearranged = c + '252100'
  let rem = 0
  for (const ch of rearranged) {
    rem = (rem * 10 + (ch.charCodeAt(0) - 48)) % 97
  }
  return rem === 1
}

// ---------- Walidacja NIP / PESEL ----------
export function validNIP(s: string): boolean {
  const c = (s || '').replace(/[\s-]/g, '')
  if (!/^\d{10}$/.test(c)) return false
  const w = [6, 5, 7, 2, 3, 4, 5, 6, 7]
  const sum = w.reduce((a, x, i) => a + x * +c[i], 0)
  return sum % 11 === +c[9]
}
export function validPESEL(s: string): boolean {
  const c = (s || '').replace(/\s/g, '')
  if (!/^\d{11}$/.test(c)) return false
  const w = [1, 3, 7, 9, 1, 3, 7, 9, 1, 3]
  const sum = w.reduce((a, x, i) => a + x * +c[i], 0)
  return (10 - (sum % 10)) % 10 === +c[10]
}
export function fmtNIP(s: string): string {
  const c = (s || '').replace(/[\s-]/g, '')
  if (c.length !== 10) return s
  return c.replace(/(\d{3})(\d{3})(\d{2})(\d{2})/, '$1-$2-$3-$4')
}

// ---------- Kwota slownie (PLN) ----------
const JEDNOSTKI = ['', 'jeden', 'dwa', 'trzy', 'cztery', 'pięć', 'sześć', 'siedem', 'osiem', 'dziewięć']
const NASCIE = [
  'dziesięć',
  'jedenaście',
  'dwanaście',
  'trzynaście',
  'czternaście',
  'piętnaście',
  'szesnaście',
  'siedemnaście',
  'osiemnaście',
  'dziewiętnaście',
]
const DZIESIATKI = [
  '',
  '',
  'dwadzieścia',
  'trzydzieści',
  'czterdzieści',
  'pięćdziesiąt',
  'sześćdziesiąt',
  'siedemdziesiąt',
  'osiemdziesiąt',
  'dziewięćdziesiąt',
]
const SETKI = [
  '',
  'sto',
  'dwieście',
  'trzysta',
  'czterysta',
  'pięćset',
  'sześćset',
  'siedemset',
  'osiemset',
  'dziewięćset',
]

function grupaSlownie(n: number): string {
  const parts: string[] = []
  const s = Math.floor(n / 100)
  const d = Math.floor((n % 100) / 10)
  const j = n % 10
  if (s) parts.push(SETKI[s])
  if (d === 1) {
    parts.push(NASCIE[j])
  } else {
    if (d) parts.push(DZIESIATKI[d])
    if (j) parts.push(JEDNOSTKI[j])
  }
  return parts.join(' ')
}
function odmiana(n: number, formy: [string, string, string]): string {
  if (n === 1) return formy[0]
  const d = n % 10
  const s = n % 100
  if (d >= 2 && d <= 4 && !(s >= 12 && s <= 14)) return formy[1]
  return formy[2]
}
export function kwotaSlownie(kwota: number): string {
  const zl = Math.floor(round2(kwota))
  const gr = Math.round((round2(kwota) - zl) * 100)
  const grupy: [string, [string, string, string]][] = [
    ['', ['', '', '']],
    ['tysiąc', ['tysiąc', 'tysiące', 'tysięcy']],
    ['milion', ['milion', 'miliony', 'milionów']],
    ['miliard', ['miliard', 'miliardy', 'miliardów']],
  ]
  if (zl === 0) {
    return `zero złotych ${String(gr).padStart(2, '0')}/100`
  }
  let reszta = zl
  const seg: number[] = []
  while (reszta > 0) {
    seg.push(reszta % 1000)
    reszta = Math.floor(reszta / 1000)
  }
  const slowa: string[] = []
  for (let i = seg.length - 1; i >= 0; i--) {
    const g = seg[i]
    if (g === 0) continue
    slowa.push(grupaSlownie(g))
    if (i > 0) slowa.push(odmiana(g, grupy[i][1]))
  }
  const zlForma = odmiana(zl, ['złoty', 'złote', 'złotych'])
  return `${slowa.join(' ')} ${zlForma} ${String(gr).padStart(2, '0')}/100`.replace(/\s+/g, ' ').trim()
}

// ---------- Inne ----------
export function initials(s: string): string {
  return (s || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0]?.toUpperCase())
    .join('')
}
export function pluralPL(n: number, formy: [string, string, string]): string {
  return odmiana(n, formy)
}
