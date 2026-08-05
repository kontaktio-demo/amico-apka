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

  // CELOWO nie blokujemy juz podwojnego tapniecia. preventDefault na 'touchend'
  // anulowal nastepujacy po nim 'click' na iOS, przez co co drugie szybkie tapniecie
  // w przycisk/wiersz bylo cicho polykane. Poza tym po usunieciu user-scalable=no
  // (WCAG - powiekszanie tekstu) podwojny tap-zoom i tak ma dzialac. Przypadkowy
  // pinch-zoom nadal tlumia handlery 'gesturestart' powyzej.
}
