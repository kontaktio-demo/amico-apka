// Sprawia, ze PWA zachowuje sie jak natywna apka: brak przyblizania/oddalania,
// brak przypadkowego zaznaczania i menu long-press na elementach interfejsu.
export function enableNativeFeel() {
  const prevent = (e: Event) => e.preventDefault()

  // iOS Safari / standalone – gesty pinch-zoom
  document.addEventListener('gesturestart', prevent, { passive: false })
  document.addEventListener('gesturechange', prevent, { passive: false })
  document.addEventListener('gestureend', prevent, { passive: false })

  // Desktop – Ctrl/Cmd + kółko myszy = zoom przegladarki
  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault()
    },
    { passive: false },
  )

  // Desktop – Ctrl/Cmd + (+ / - / 0) = zoom przegladarki
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && ['+', '-', '=', '0', 'Add', 'Subtract'].includes(e.key)) {
      e.preventDefault()
    }
  })

  // Podwojne stukniecie = zoom (dodatkowo do touch-action)
  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300 && e.cancelable) {
        // nie blokuj pojedynczego tapniecia w pola formularza
        const t = e.target as HTMLElement
        if (!t.closest('input, textarea, select, [contenteditable], canvas')) e.preventDefault()
      }
      lastTouchEnd = now
    },
    { passive: false },
  )
}
