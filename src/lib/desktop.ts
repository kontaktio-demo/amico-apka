// ============================================================================
// Most do aplikacji desktopowej (Electron).
// W przegladarce window.amico nie istnieje i wszystko dziala jak dotad.
// ============================================================================

export interface MostDesktop {
  desktop: true
  zapiszPdf: (nazwa: string) => Promise<{ ok: boolean; sciezka?: string; anulowane?: boolean; blad?: string }>
  wersja: () => Promise<string>
  naOtworzPoradnik: (cb: () => void) => () => void
}

declare global {
  interface Window {
    amico?: MostDesktop
  }
}

export const czyDesktop = (): boolean => typeof window !== 'undefined' && window.amico?.desktop === true

export const most = (): MostDesktop | undefined => (typeof window !== 'undefined' ? window.amico : undefined)
