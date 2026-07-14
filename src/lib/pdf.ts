import { jsPDF } from 'jspdf'
import { safeFilename } from './print'
import { czyDesktop } from './desktop'

// Sklejenie stron (obrazy JPEG dataURL) w jeden dokument PDF A4.
export function skanDoPdf(strony: string[]): jsPDF {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()
  const margin = 6
  strony.forEach((dataUrl, i) => {
    if (i > 0) pdf.addPage()
    try {
      const props = pdf.getImageProperties(dataUrl)
      const maxW = pw - margin * 2
      const maxH = ph - margin * 2
      const ratio = Math.min(maxW / props.width, maxH / props.height)
      const w = props.width * ratio
      const h = props.height * ratio
      pdf.addImage(dataUrl, 'JPEG', (pw - w) / 2, (ph - h) / 2, w, h, undefined, 'FAST')
    } catch {
      /* pomijamy uszkodzona strone */
    }
  })
  return pdf
}

export function pobierzPdf(strony: string[], nazwa: string) {
  skanDoPdf(strony).save(`${safeFilename(nazwa)}.pdf`)
}

export function pdfBlob(strony: string[]): Blob {
  return skanDoPdf(strony).output('blob')
}

// Druk PDF. Zwraca true, jesli udalo sie otworzyc okno druku; false, gdy zamiast
// tego plik zostal zapisany (wtedy warto o tym poinformowac uzytkownika).
export function drukujPdf(strony: string[], nazwa = 'skan'): boolean {
  // W aplikacji desktopowej okna z blob: sa blokowane (bezpieczenstwo), wiec zamiast
  // pustego okna zapisujemy plik - uzytkownik otworzy go i wydrukuje z czytnika PDF.
  if (czyDesktop()) {
    pobierzPdf(strony, nazwa)
    return false
  }
  const pdf = skanDoPdf(strony)
  const url = pdf.output('bloburl')
  const w = window.open(url as unknown as string, '_blank')
  if (!w) {
    // Wyskakujace okna zablokowane - zapisujemy plik jako plan awaryjny.
    pobierzPdf(strony, nazwa)
    return false
  }
  w.onload = () => {
    try {
      w.focus()
      w.print()
    } catch {
      /* ignore */
    }
  }
  return true
}

// Wyslanie PDF w zalaczniku – Web Share API (poziom 2), fallback: pobranie
export async function udostepnijPdf(strony: string[], nazwa: string, opis?: string): Promise<'shared' | 'downloaded'> {
  const blob = pdfBlob(strony)
  const file = new File([blob], `${safeFilename(nazwa)}.pdf`, { type: 'application/pdf' })
  const navAny = navigator as any
  if (navAny.canShare && navAny.canShare({ files: [file] }) && navigator.share) {
    try {
      await navigator.share({ files: [file], title: nazwa, text: opis })
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'shared'
    }
  }
  pobierzPdf(strony, nazwa)
  return 'downloaded'
}
