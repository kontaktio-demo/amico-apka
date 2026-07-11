import type { ProduktKategoria } from './types'

// Proceduralne "przepisy" kamienia do wizualizacji (SVG feTurbulence).
export interface StonePreset {
  base: string // kolor bazowy
  base2: string // drugi ton (gradient)
  vein: string // kolor zyl/ziarna
  freqX: number
  freqY: number
  octaves: number
  kontrast: number // 0..1 sila tekstury
  polysk: number // 0..1 polysk/refleks
}

const KATEGORIA_PRESET: Record<ProduktKategoria, StonePreset> = {
  marmur: {
    base: '#f2efe9',
    base2: '#e6e1d7',
    vein: '#a9a294',
    freqX: 0.012,
    freqY: 0.05,
    octaves: 5,
    kontrast: 0.55,
    polysk: 0.5,
  },
  granit: {
    base: '#3c3d42',
    base2: '#2b2c31',
    vein: '#5a5c63',
    freqX: 0.85,
    freqY: 0.85,
    octaves: 2,
    kontrast: 0.7,
    polysk: 0.35,
  },
  kwarc: {
    base: '#edeae4',
    base2: '#e2ded6',
    vein: '#c3bdb2',
    freqX: 1.1,
    freqY: 1.1,
    octaves: 2,
    kontrast: 0.3,
    polysk: 0.4,
  },
  konglomerat: {
    base: '#ecebe7',
    base2: '#dedcd5',
    vein: '#c0bcb2',
    freqX: 1.2,
    freqY: 1.2,
    octaves: 2,
    kontrast: 0.32,
    polysk: 0.45,
  },
  spiek: {
    base: '#d7d7d8',
    base2: '#c7c7c9',
    vein: '#a9a9ac',
    freqX: 0.6,
    freqY: 0.6,
    octaves: 2,
    kontrast: 0.28,
    polysk: 0.55,
  },
  dekton: {
    base: '#cfd0d1',
    base2: '#bfc0c2',
    vein: '#a2a3a6',
    freqX: 0.55,
    freqY: 0.55,
    octaves: 2,
    kontrast: 0.28,
    polysk: 0.6,
  },
  trawertyn: {
    base: '#d8c6a6',
    base2: '#cbb790',
    vein: '#a98f66',
    freqX: 0.05,
    freqY: 0.55,
    octaves: 3,
    kontrast: 0.5,
    polysk: 0.25,
  },
  onyks: {
    base: '#e2d3ab',
    base2: '#d0bd8b',
    vein: '#a98a52',
    freqX: 0.008,
    freqY: 0.06,
    octaves: 4,
    kontrast: 0.6,
    polysk: 0.7,
  },
  usluga: {
    base: '#e8e8e8',
    base2: '#dcdcdc',
    vein: '#c4c4c4',
    freqX: 0.8,
    freqY: 0.8,
    octaves: 2,
    kontrast: 0.2,
    polysk: 0.3,
  },
  akcesorium: {
    base: '#e8e8e8',
    base2: '#dcdcdc',
    vein: '#c4c4c4',
    freqX: 0.8,
    freqY: 0.8,
    octaves: 2,
    kontrast: 0.2,
    polysk: 0.3,
  },
}

// Znane kolory/nazwy handlowe -> nadpisania
const NAZWA_PRESET: { test: RegExp; p: Partial<StonePreset> }[] = [
  { test: /nero|assoluto|czarn/i, p: { base: '#1c1c20', base2: '#111114', vein: '#34343a' } },
  { test: /calacatta|calacata/i, p: { base: '#f6f4ef', base2: '#ece8df', vein: '#b9ae97' } },
  { test: /carrara|bianco carrara/i, p: { base: '#eef0f1', base2: '#e2e5e6', vein: '#a7aeb1' } },
  { test: /steel|grey|szar/i, p: { base: '#71747a', base2: '#5c5f64', vein: '#4a4d52' } },
  { test: /bianco|biał|white|cristal/i, p: { base: '#eeece7', base2: '#e2dfd8', vein: '#c6c0b4' } },
  { test: /silestone|caesarstone|technistone/i, p: { base: '#ecebe6', base2: '#e0ded6' } },
  { test: /laminam|neolith/i, p: { base: '#d3d3d5', base2: '#c3c3c6', vein: '#a6a6aa' } },
]

export function stonePreset(kategoria: ProduktKategoria | undefined, nazwa = ''): StonePreset {
  const baza = KATEGORIA_PRESET[kategoria || 'kwarc'] || KATEGORIA_PRESET.kwarc
  let p = { ...baza }
  for (const n of NAZWA_PRESET) if (n.test.test(nazwa)) p = { ...p, ...n.p }
  return p
}

export function czyCiemny(p: StonePreset): boolean {
  const c = p.base.replace('#', '')
  const r = parseInt(c.slice(0, 2), 16),
    g = parseInt(c.slice(2, 4), 16),
    bl = parseInt(c.slice(4, 6), 16)
  return 0.299 * r + 0.587 * g + 0.114 * bl < 110
}
