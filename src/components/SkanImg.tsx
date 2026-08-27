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
  return <img src={src} alt={alt} className={className} loading={loading} />
}
