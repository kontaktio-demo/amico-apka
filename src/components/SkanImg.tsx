import { useEffect, useState } from 'react'
import { skanUrl, czyBase64Strona } from '../lib/cloud'

// Wyswietla strone skanu niezaleznie od postaci referencji:
//  - "data:..."   -> base64 wprost (w bazie, jeszcze nie przeniesiony do chmury / offline),
//  - "<ws>/..jpg" -> sciezka w Supabase Storage -> podpisany URL (z cache).
export function SkanImg({
  strona,
  alt,
  className,
  loading,
}: {
  strona: string
  alt?: string
  className?: string
  loading?: 'lazy' | 'eager'
}) {
  const [src, setSrc] = useState(czyBase64Strona(strona) ? strona : '')

  useEffect(() => {
    let alive = true
    if (czyBase64Strona(strona)) {
      setSrc(strona)
      return
    }
    setSrc('')
    let timer: ReturnType<typeof setTimeout> | undefined
    let proby = 0
    // Podpisany URL moze chwilowo nie powstac (brak sieci po wznowieniu). Ponawiamy kilka
    // razy, zeby strona nie zostawala na zawsze pustym placeholderem po przelotnym bledzie.
    const sprobuj = () => {
      skanUrl(strona).then((u) => {
        if (!alive) return
        if (u) setSrc(u)
        else if (proby++ < 4) timer = setTimeout(sprobuj, 4000)
      })
    }
    sprobuj()
    return () => {
      alive = false
      if (timer) clearTimeout(timer)
    }
  }, [strona])

  if (!src) return <div className={className} aria-label={alt} />
  // KRYTYCZNE (pamiec iPhone): loading="lazy" + decoding="async". Skany to duze obrazy
  // (~2200 px, ~15 MB zdekodowanej bitmapy/strone). Bez tego siatka/podglad dekoduje
  // WSZYSTKIE naraz -> iPhone (PWA) ubija karte. Z lazy WebKit dekoduje tylko to, co blisko
  // ekranu, i zwalnia reszte pod presja pamieci.
  return <img src={src} alt={alt} className={className} loading={loading || 'lazy'} decoding="async" />
}
