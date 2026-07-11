import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

// ============================================================================
// Silnik DRUKU / PDF – renderuje dokument do #print-root i wywoluje window.print()
// Przegladarka pozwala "Zapisz jako PDF". Wysoka wiernosc, offline, polskie znaki.
// ============================================================================

function ensurePrintRoot(): HTMLElement {
  let el = document.getElementById('print-root')
  if (!el) {
    el = document.createElement('div')
    el.id = 'print-root'
    document.body.appendChild(el)
  }
  return el
}

type Zadanie = { node: React.ReactNode; tryb: 'druk' | 'pdf'; nazwa?: string }

const PrintCtx = createContext<{
  print: (node: React.ReactNode) => void
  // Desktop: zapisuje dokument prosto do pliku PDF (bez okna drukowania).
  zapiszPdf: (node: React.ReactNode, nazwa: string) => Promise<{ ok: boolean; anulowane?: boolean } | void>
}>({ print: () => {}, zapiszPdf: async () => {} })

export const usePrint = () => useContext(PrintCtx)

export function PrintProvider({ children }: { children: React.ReactNode }) {
  const [zadanie, setZadanie] = useState<Zadanie | null>(null)
  const [root] = useState(ensurePrintRoot)
  const wynikRef = React.useRef<((r: any) => void) | null>(null)

  const print = useCallback((n: React.ReactNode) => setZadanie({ node: n, tryb: 'druk' }), [])

  const zapiszPdf = useCallback((n: React.ReactNode, nazwa: string) => {
    return new Promise<any>((resolve) => {
      wynikRef.current = resolve
      setZadanie({ node: n, tryb: 'pdf', nazwa })
    })
  }, [])

  useEffect(() => {
    if (!zadanie) return
    let done = false
    const clear = (wynik?: any) => {
      if (done) return
      done = true
      setZadanie(null)
      wynikRef.current?.(wynik)
      wynikRef.current = null
    }

    const czekajNaRender = async () => {
      try {
        if (document.fonts?.ready) await document.fonts.ready
      } catch {
        /* ignore */
      }
      await new Promise((r) => setTimeout(r, 180))
    }

    const run = async () => {
      await czekajNaRender()

      if (zadanie.tryb === 'pdf' && window.amico?.desktop) {
        const r = await window.amico.zapiszPdf(zadanie.nazwa || 'dokument')
        clear(r)
        return
      }

      window.addEventListener('afterprint', () => clear(), { once: true })
      window.print()
      // Fallback gdy afterprint nie wystrzeli (niektore przegladarki mobilne)
      setTimeout(() => clear(), 1200)
    }
    run()
  }, [zadanie])

  return (
    <PrintCtx.Provider value={{ print, zapiszPdf }}>
      {children}
      {zadanie && createPortal(zadanie.node, root)}
    </PrintCtx.Provider>
  )
}

// ============================================================================
// WYSYLKA – Web Share API (priorytet), fallback mailto / sms / kopiuj
// ============================================================================

export function canShareFiles(): boolean {
  return typeof navigator !== 'undefined' && 'canShare' in navigator
}

export async function shareContent(opts: {
  title: string
  text: string
  url?: string
}): Promise<'shared' | 'unsupported' | 'error'> {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url })
      return 'shared'
    } catch (e: any) {
      if (e?.name === 'AbortError') return 'shared'
      return 'error'
    }
  }
  return 'unsupported'
}

export function mailtoLink(o: { to?: string; subject: string; body: string }): string {
  const q = new URLSearchParams()
  q.set('subject', o.subject)
  q.set('body', o.body)
  return `mailto:${o.to || ''}?${q.toString().replace(/\+/g, '%20')}`
}

export function smsLink(to: string, body?: string): string {
  return `sms:${to}${body ? `?&body=${encodeURIComponent(body)}` : ''}`
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

// Pobranie tekstu jako pliku (kopia zapasowa, eksport)
export function downloadFile(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

export function safeFilename(s: string): string {
  return s
    .replace(/[\/\\:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(
      /[ąćęłńóśźż]/gi,
      (c) =>
        (
          ({
            ą: 'a',
            ć: 'c',
            ę: 'e',
            ł: 'l',
            ń: 'n',
            ó: 'o',
            ś: 's',
            ź: 'z',
            ż: 'z',
            Ą: 'A',
            Ć: 'C',
            Ę: 'E',
            Ł: 'L',
            Ń: 'N',
            Ó: 'O',
            Ś: 'S',
            Ź: 'Z',
            Ż: 'Z',
          }) as any
        )[c] || c,
    )
    .slice(0, 80)
}
