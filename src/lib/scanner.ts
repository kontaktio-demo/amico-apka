// ============================================================================
// AMICO – silnik skanera dokumentow (jak Adobe/Apple Scan)
// Kadrowanie perspektywiczne (4 rogi -> prostokat) + filtry dokumentowe.
// Wszystko lokalnie w przegladarce (Canvas), bez wysylania na zewnatrz.
// ============================================================================

export interface Punkt {
  x: number
  y: number
}
export interface Rogi {
  tl: Punkt
  tr: Punkt
  br: Punkt
  bl: Punkt
}
export type FiltrSkanu = 'auto' | 'kolor' | 'szary' | 'bw' | 'oryginal'

// ---------- Wczytanie obrazu do canvas (z ograniczeniem rozmiaru) ----------
export function zaladujObraz(src: string, maxDim = 2200): Promise<HTMLCanvasElement> {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img
      const skala = Math.min(1, maxDim / Math.max(width, height))
      width = Math.round(width * skala)
      height = Math.round(height * skala)
      const c = document.createElement('canvas')
      c.width = width
      c.height = height
      c.getContext('2d')!.drawImage(img, 0, 0, width, height)
      res(c)
    }
    img.onerror = rej
    img.src = src
  })
}

// ---------- Wspolczynniki odwzorowania kwadrat jednostkowy -> czworokat ----------
// Metoda Heckberta. Rogi w kolejnosci: (0,0)=tl (1,0)=tr (1,1)=br (0,1)=bl
function kwadratNaCzworokat(r: Rogi) {
  const x0 = r.tl.x,
    y0 = r.tl.y
  const x1 = r.tr.x,
    y1 = r.tr.y
  const x2 = r.br.x,
    y2 = r.br.y
  const x3 = r.bl.x,
    y3 = r.bl.y
  const dx1 = x1 - x2,
    dx2 = x3 - x2,
    dx3 = x0 - x1 + x2 - x3
  const dy1 = y1 - y2,
    dy2 = y3 - y2,
    dy3 = y0 - y1 + y2 - y3
  let a, b, c, d, e, f, g, h
  if (Math.abs(dx3) < 1e-9 && Math.abs(dy3) < 1e-9) {
    a = x1 - x0
    b = x2 - x1
    c = x0
    d = y1 - y0
    e = y2 - y1
    f = y0
    g = 0
    h = 0
  } else {
    const den = dx1 * dy2 - dx2 * dy1
    g = (dx3 * dy2 - dx2 * dy3) / den
    h = (dx1 * dy3 - dx3 * dy1) / den
    a = x1 - x0 + g * x1
    b = x3 - x0 + h * x3
    c = x0
    d = y1 - y0 + g * y1
    e = y3 - y0 + h * y3
    f = y0
  }
  return { a, b, c, d, e, f, g, h }
}

// ---------- Kadrowanie perspektywiczne ----------
export function kadrujPerspektywe(src: HTMLCanvasElement, rogi: Rogi, maxWynik = 1700): HTMLCanvasElement {
  // rozmiar docelowy ~ srednia dlugosc bokow, proporcje A4 zachowane naturalnie
  const dist = (p: Punkt, q: Punkt) => Math.hypot(p.x - q.x, p.y - q.y)
  const szerokosc = (dist(rogi.tl, rogi.tr) + dist(rogi.bl, rogi.br)) / 2
  const wysokosc = (dist(rogi.tl, rogi.bl) + dist(rogi.tr, rogi.br)) / 2
  let outW = Math.round(szerokosc)
  let outH = Math.round(wysokosc)
  const s = Math.min(1, maxWynik / Math.max(outW, outH))
  outW = Math.max(8, Math.round(outW * s))
  outH = Math.max(8, Math.round(outH * s))

  const sctx = src.getContext('2d')!
  const srcData = sctx.getImageData(0, 0, src.width, src.height)
  const sp = srcData.data
  const sw = src.width,
    sh = src.height

  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')!
  const outImg = octx.createImageData(outW, outH)
  const op = outImg.data

  const m = kwadratNaCzworokat(rogi)
  for (let y = 0; y < outH; y++) {
    const v = y / (outH - 1 || 1)
    for (let x = 0; x < outW; x++) {
      const u = x / (outW - 1 || 1)
      const w = m.g * u + m.h * v + 1
      const sx = (m.a * u + m.b * v + m.c) / w
      const sy = (m.d * u + m.e * v + m.f) / w
      const oi = (y * outW + x) * 4
      // interpolacja dwuliniowa
      if (sx < 0 || sy < 0 || sx >= sw - 1 || sy >= sh - 1) {
        op[oi] = op[oi + 1] = op[oi + 2] = 255
        op[oi + 3] = 255
        continue
      }
      const x0 = Math.floor(sx),
        y0 = Math.floor(sy)
      const fx = sx - x0,
        fy = sy - y0
      const i00 = (y0 * sw + x0) * 4
      const i10 = i00 + 4
      const i01 = i00 + sw * 4
      const i11 = i01 + 4
      for (let k = 0; k < 3; k++) {
        const top = sp[i00 + k] * (1 - fx) + sp[i10 + k] * fx
        const bot = sp[i01 + k] * (1 - fx) + sp[i11 + k] * fx
        op[oi + k] = top * (1 - fy) + bot * fy
      }
      op[oi + 3] = 255
    }
  }
  octx.putImageData(outImg, 0, 0)
  return out
}

// ---------- Filtry ----------
export function zastosujFiltr(canvas: HTMLCanvasElement, filtr: FiltrSkanu): HTMLCanvasElement {
  if (filtr === 'oryginal') return canvas
  const ctx = canvas.getContext('2d')!
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const w = canvas.width,
    h = canvas.height

  if (filtr === 'kolor' || filtr === 'auto') {
    // wzmocnienie: kontrast + jasnosc + lekka saturacja (dokument "czysty")
    const kontrast = filtr === 'auto' ? 1.35 : 1.18
    const jasnosc = filtr === 'auto' ? 14 : 6
    const sat = filtr === 'auto' ? 1.12 : 1.06
    for (let i = 0; i < d.length; i += 4) {
      let r = d[i],
        g = d[i + 1],
        b = d[i + 2]
      const avg = (r + g + b) / 3
      r = avg + (r - avg) * sat
      g = avg + (g - avg) * sat
      b = avg + (b - avg) * sat
      d[i] = clamp((r - 128) * kontrast + 128 + jasnosc)
      d[i + 1] = clamp((g - 128) * kontrast + 128 + jasnosc)
      d[i + 2] = clamp((b - 128) * kontrast + 128 + jasnosc)
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  }

  // szarosc
  const gray = new Uint8ClampedArray(w * h)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    gray[p] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
  }

  if (filtr === 'szary') {
    for (let i = 0, p = 0; i < d.length; i += 4, p++) {
      const g = clamp((gray[p] - 128) * 1.15 + 128 + 4)
      d[i] = d[i + 1] = d[i + 2] = g
    }
    ctx.putImageData(img, 0, 0)
    return canvas
  }

  // czarno-bialy – progowanie adaptacyjne (integral image)
  const bw = adaptiveThreshold(gray, w, h, Math.max(8, Math.round(Math.max(w, h) / 40)), 10)
  for (let i = 0, p = 0; i < d.length; i += 4, p++) {
    d[i] = d[i + 1] = d[i + 2] = bw[p]
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

function adaptiveThreshold(
  gray: Uint8ClampedArray,
  w: number,
  h: number,
  radius: number,
  C: number,
): Uint8ClampedArray {
  const W = w + 1
  const integ = new Float64Array(W * (h + 1))
  for (let y = 0; y < h; y++) {
    let rowsum = 0
    for (let x = 0; x < w; x++) {
      rowsum += gray[y * w + x]
      integ[(y + 1) * W + (x + 1)] = integ[y * W + (x + 1)] + rowsum
    }
  }
  const out = new Uint8ClampedArray(w * h)
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius),
      y1 = Math.min(h - 1, y + radius)
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - radius),
        x1 = Math.min(w - 1, x + radius)
      const area = (x1 - x0 + 1) * (y1 - y0 + 1)
      const sum =
        integ[(y1 + 1) * W + (x1 + 1)] - integ[y0 * W + (x1 + 1)] - integ[(y1 + 1) * W + x0] + integ[y0 * W + x0]
      const mean = sum / area
      out[y * w + x] = gray[y * w + x] > mean - C ? 255 : 0
    }
  }
  return out
}

function clamp(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v
}

// ---------- Eksport ----------
export function canvasNaJpeg(canvas: HTMLCanvasElement, jakosc = 0.82): string {
  return canvas.toDataURL('image/jpeg', jakosc)
}

// Auto-propozycja rogow (lekkie wciecie od krawedzi) gdy brak detekcji
export function domyslneRogi(w: number, h: number, margines = 0.04): Rogi {
  const mx = w * margines,
    my = h * margines
  return {
    tl: { x: mx, y: my },
    tr: { x: w - mx, y: my },
    br: { x: w - mx, y: h - my },
    bl: { x: mx, y: h - my },
  }
}
