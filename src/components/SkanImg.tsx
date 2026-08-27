import { useEffect, useState } from 'react'
import { skanUrl, czyBase64Strona } from '../lib/cloud'

// Wyswietla strone skanu niezaleznie od tego, czy to base64 (jeszcze w bazie / offline),
// czy sciezka w magazynie plikow (Storage) - wtedy pobiera podpisany URL (z cache).
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
  const bezposrednio = czyBase64Strona(strona)
  const [src, setSrc] = useState(bezposrednio ? strona : '')

  useEffect(() => {
    let alive = true
    if (czyBase64Strona(strona)) {
      setSrc(strona)
      return
    }
    setSrc('')
    skanUrl(strona).then((u) => {
      if (alive) setSrc(u || '')
    })
    return () => {
      alive = false
    }
  }, [strona])

  if (!src) return <div className={className} aria-label={alt} />
  // KRYTYCZNE (pamiec iPhone): domyslnie loading="lazy" + decoding="async". Skany to duze
  // obrazy (~2200 px, ~15 MB zdekodowanej bitmapy/strone). Bez tego siatka/podglad dekoduje
  // WSZYSTKIE naraz -> iPhone (PWA) ubija karte ("Wielokrotnie wystapil problem"). Z lazy
  // WebKit dekoduje tylko to, co blisko ekranu, i zwalnia reszte pod presja pamieci.
  return <img src={src} alt={alt} className={className} loading={loading || 'lazy'} decoding="async" />
}
