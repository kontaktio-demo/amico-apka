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

// ============================================================================
// Dopasowanie dokumentu do kartki
//
// Problem, ktory to rozwiazuje: dokument (np. wycena) bywa o kilka centymetrow
// wyzszy niz pole zadruku A4. Przegladarka spycha wtedy koncowke - blok podpisow
// i stopke - na DRUGA kartke, ktora poza tym jest pusta. Wyglada to tak, jakby
// "drukowal sie sam dol strony".
//
// Rozwiazanie: przed drukiem mierzymy arkusz w geometrii kartki i, jesli wystaje
// tylko o kawalek, delikatnie go zmniejszamy, zeby zmiescil sie w calosci.
// Uklad i proporcje dokumentu zostaja bez zmian - jest tylko odrobine mniejszy.
// ============================================================================

const MM_PX = 96 / 25.4
const MARGINES_MM = 10 // MUSI byc zgodne z @page w src/index.css
const SZER_POLA = (210 - 2 * MARGINES_MM) * MM_PX
const WYS_POLA = (297 - 2 * MARGINES_MM) * MM_PX
const MIN_SKALA = 0.75 // ponizej tego dokument bylby juz nieczytelny
const MAX_NADMIAR = 0.35 // wystaje o wiecej niz 1/3 strony -> to naprawde dluzszy dokument

function dopasujArkuszeDoStrony(root: HTMLElement) {
  const arkusze = Array.from(root.querySelectorAll<HTMLElement>('.doc-sheet'))
  if (!arkusze.length) return

  // #print-root jest ukryty (display: none), a ukrytego elementu nie da sie zmierzyc.
  // Na czas pomiaru wykladamy go poza ekranem - uklad sie liczy, ale nic nie miga.
  const styleWyjsciowy = root.getAttribute('style')
  root.style.cssText = 'display:block;position:fixed;left:-10000px;top:0;visibility:hidden;pointer-events:none;'

  for (const arkusz of arkusze) {
    const inner = arkusz.querySelector<HTMLElement>('.doc-inner')
    if (!inner) continue

    arkusz.style.removeProperty('--skala-druku')
    arkusz.style.removeProperty('--wys-druku')

    // Ustawiamy geometrie druku: szerokosc pola zadruku, bez wlasnych marginesow arkusza
    const zapas = {
      width: arkusz.style.width,
      padding: arkusz.style.padding,
      minHeight: arkusz.style.minHeight,
      height: arkusz.style.height,
    }
    arkusz.style.width = `${SZER_POLA}px`
    arkusz.style.padding = '0'
    arkusz.style.minHeight = '0'
    arkusz.style.height = 'auto'
    inner.style.width = '100%'
    inner.style.transform = 'none'

    const wysNaturalna = inner.getBoundingClientRect().height
    const stron = wysNaturalna / WYS_POLA
    const pelnych = Math.floor(stron)
    const nadmiar = stron - pelnych

    let skala: number | null = null
    // Skalujemy TYLKO gdy dokument wystaje o niewielki kawalek ponad JEDNA strone.
    // Przy dluzszych dokumentach (umowa, poradnik) zostawiamy naturalny podzial na
    // strony - transformacja rozciagnieta przez lamanie stron potrafi uciac tresc.
    if (pelnych === 1 && nadmiar > 0 && nadmiar <= MAX_NADMIAR) {
      // 2 px zapasu, zeby zaokraglenie nie wypchnelo dokumentu na kolejna kartke
      const kandydat = (WYS_POLA - 2) / wysNaturalna
      if (kandydat >= MIN_SKALA) skala = kandydat
    }

    if (skala) {
      // Po zmniejszeniu tresc uklada sie szerzej, wiec mierzymy jeszcze raz -
      // inaczej wysokosc pudelka nie zgadzalaby sie z tym, co widac na papierze.
      inner.style.width = `${SZER_POLA / skala}px`
      const wysPoPoszerzeniu = inner.getBoundingClientRect().height
      const wysKoncowa = Math.min(wysPoPoszerzeniu * skala, WYS_POLA - 2)
      arkusz.style.setProperty('--skala-druku', String(skala))
      arkusz.style.setProperty('--wys-druku', `${Math.ceil(wysKoncowa)}px`)
      // Zmniejszenie jest tylko wizualne - pudelko tresci DALEJ ma pelna wysokosc
      // i to ono wypychalo druga, prawie pusta kartke. Przycinamy je do arkusza.
      // Klasa jest wazna: przy dokumentach wielostronicowych (umowa, poradnik)
      // NIE skalujemy i NIE przycinamy, bo obcielibysmy tresc.
      arkusz.classList.add('doc-dopasowany')
    } else {
      arkusz.classList.remove('doc-dopasowany')
    }

    arkusz.style.width = zapas.width
    arkusz.style.padding = zapas.padding
    arkusz.style.minHeight = zapas.minHeight
    arkusz.style.height = zapas.height
    inner.style.width = ''
    inner.style.transform = ''
  }

  if (styleWyjsciowy === null) root.removeAttribute('style')
  else root.setAttribute('style', styleWyjsciowy)
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
      // Dokument, ktory wystaje o kawalek, zmniejszamy tak, by zmiescil sie na kartce
      dopasujArkuszeDoStrony(root)

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
  }, [zadanie, root])

  // Gdy ktos naciśnie Ctrl+P zamiast uzyc przycisku w aplikacji, #print-root jest
  // pusty i na papier poszlaby czysta kartka. Podpowiadamy, co zrobic.
  useEffect(() => {
    const naPrzedDrukiem = () => {
      if (root.childElementCount > 0) return
      root.dataset.podpowiedz = 'tak'
      root.innerHTML =
        '<div class="doc-sheet"><div class="doc-inner" style="padding:40mm 0;text-align:center;font-size:12pt;color:#12130f">' +
        'Aby wydrukować dokument, otwórz go w aplikacji i użyj przycisku <b>Drukuj / PDF</b>.' +
        '</div></div>'
    }
    const naPoDruku = () => {
      if (root.dataset.podpowiedz !== 'tak') return
      delete root.dataset.podpowiedz
      root.innerHTML = ''
    }
    window.addEventListener('beforeprint', naPrzedDrukiem)
    window.addEventListener('afterprint', naPoDruku)
    return () => {
      window.removeEventListener('beforeprint', naPrzedDrukiem)
      window.removeEventListener('afterprint', naPoDruku)
    }
  }, [root])

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
