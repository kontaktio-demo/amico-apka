// ============================================================================
// AMICO – aplikacja desktopowa (Windows).
//
// Ta sama aplikacja co w przegladarce (ten sam kod z katalogu dist/), ten sam
// silnik Chromium, ta sama baza w chmurze. Roznice sa tylko tam, gdzie desktop
// pozwala zrobic cos LEPIEJ (natywny zapis PDF) albo gdzie cos nie ma sensu
// (instalacja PWA, service worker).
//
// Bezpieczenstwo:
//   - contextIsolation + sandbox, bez dostepu do Node z poziomu strony,
//   - pliki serwowane z wlasnego protokolu app://amico (a nie file://),
//     dzieki czemu dziala CSP, IndexedDB i localStorage maja staly origin,
//   - linki zewnetrzne otwieraja sie w przegladarce, nie w oknie aplikacji.
// ============================================================================

const { app, BrowserWindow, protocol, shell, dialog, ipcMain, Menu } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const DIST = path.join(__dirname, '..', 'dist')
const ORIGIN = 'app://amico'

// Typy plikow serwowanych z app://. Pliki lezą w archiwum app.asar, dlatego
// czytamy je przez fs (Electron rozumie asar), a NIE przez adresy file://,
// ktore do wnetrza archiwum nie zajrza.
const TYPY = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

// Wlasny protokol musi byc zadeklarowany PRZED app.whenReady()
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true },
  },
])

// ---------------------------------------------------------------------------
// Zapamietywanie rozmiaru i pozycji okna
// ---------------------------------------------------------------------------
const plikOkna = () => path.join(app.getPath('userData'), 'okno.json')

function wczytajOkno() {
  try {
    return JSON.parse(fs.readFileSync(plikOkna(), 'utf8'))
  } catch {
    return null
  }
}

function zapiszOkno(win) {
  try {
    if (!win || win.isDestroyed()) return
    const b = win.getBounds()
    fs.writeFileSync(plikOkna(), JSON.stringify({ ...b, zmaksymalizowane: win.isMaximized() }))
  } catch {
    /* nie blokujemy zamkniecia z powodu zapisu ustawien okna */
  }
}

// ---------------------------------------------------------------------------
// Okno glowne
// ---------------------------------------------------------------------------
let glowneOkno = null

function utworzOkno() {
  const zapisane = wczytajOkno()

  glowneOkno = new BrowserWindow({
    width: zapisane?.width || 1440,
    height: zapisane?.height || 900,
    x: zapisane?.x,
    y: zapisane?.y,
    minWidth: 1024,
    minHeight: 680,
    show: false,
    backgroundColor: '#0b0b10',
    title: 'AMICO – Pracownia Kamieniarska',
    autoHideMenuBar: true,
    icon: path.join(__dirname, 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged,
    },
  })

  if (zapisane?.zmaksymalizowane) glowneOkno.maximize()

  glowneOkno.once('ready-to-show', () => glowneOkno.show())
  glowneOkno.on('close', () => zapiszOkno(glowneOkno))
  glowneOkno.on('closed', () => {
    glowneOkno = null
  })

  // Zoom wylaczony – aplikacja ma wygladac dokladnie tak samo na kazdym komputerze
  glowneOkno.webContents.on('did-finish-load', () => {
    glowneOkno.webContents.setVisualZoomLevelLimits(1, 1)
    glowneOkno.webContents.setZoomFactor(1)
  })

  // Linki zewnetrzne (mailto:, sms:, https:) -> domyslny program systemowy
  const naZewnatrz = (url) => {
    if (/^(https?|mailto|sms|tel):/i.test(url)) shell.openExternal(url).catch(() => {})
  }
  glowneOkno.webContents.setWindowOpenHandler(({ url }) => {
    naZewnatrz(url)
    return { action: 'deny' }
  })
  glowneOkno.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault()
      naZewnatrz(url)
    }
  })

  glowneOkno.loadURL(`${ORIGIN}/index.html`)
}

// ---------------------------------------------------------------------------
// Menu (ukryte pod klawiszem Alt, zeby nie zaburzac wygladu)
// ---------------------------------------------------------------------------
function ustawMenu() {
  const menu = Menu.buildFromTemplate([
    {
      label: 'Plik',
      submenu: [
        {
          label: 'Zapisz PDF…',
          accelerator: 'CmdOrCtrl+S',
          click: () => glowneOkno?.webContents.send('amico:skrot-zapisz-pdf'),
        },
        { label: 'Drukuj…', accelerator: 'CmdOrCtrl+P', role: 'print' },
        { type: 'separator' },
        { label: 'Zamknij', accelerator: 'Alt+F4', role: 'quit' },
      ],
    },
    {
      label: 'Edycja',
      submenu: [
        { label: 'Cofnij', role: 'undo' },
        { label: 'Ponów', role: 'redo' },
        { type: 'separator' },
        { label: 'Wytnij', role: 'cut' },
        { label: 'Kopiuj', role: 'copy' },
        { label: 'Wklej', role: 'paste' },
        { label: 'Zaznacz wszystko', role: 'selectAll' },
      ],
    },
    {
      label: 'Widok',
      submenu: [
        { label: 'Odśwież', accelerator: 'F5', role: 'reload' },
        { label: 'Pełny ekran', accelerator: 'F11', role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [{ label: 'Narzędzia programisty', role: 'toggleDevTools' }]),
      ],
    },
    {
      label: 'Pomoc',
      submenu: [
        {
          label: 'Poradnik',
          click: () => glowneOkno?.webContents.send('amico:otworz-poradnik'),
        },
        {
          label: 'O programie',
          click: () => {
            dialog.showMessageBox(glowneOkno, {
              type: 'info',
              title: 'O programie',
              message: 'AMICO – Pracownia Kamieniarska',
              detail: `Wersja ${app.getVersion()}\n\nDane zapisują się na tym komputerze i – po zalogowaniu do chmury – synchronizują z pozostałymi urządzeniami.`,
              buttons: ['OK'],
            })
          },
        },
      ],
    },
  ])
  Menu.setApplicationMenu(menu)
}

// ---------------------------------------------------------------------------
// Serwowanie plikow aplikacji z app://amico
// ---------------------------------------------------------------------------
function zarejestrujProtokol() {
  protocol.handle('app', async (request) => {
    const url = new URL(request.url)
    let sciezka = decodeURIComponent(url.pathname)
    if (!sciezka || sciezka === '/') sciezka = '/index.html'

    const plik = path.normalize(path.join(DIST, sciezka))
    // Nie wypuszczamy nikogo poza katalog aplikacji
    if (!plik.startsWith(DIST)) return new Response('Brak dostępu', { status: 403 })

    // Nieznana sciezka -> index.html (routingiem zajmuje sie aplikacja)
    let docelowy = plik
    try {
      if (!fs.statSync(plik).isFile()) docelowy = path.join(DIST, 'index.html')
    } catch {
      docelowy = path.join(DIST, 'index.html')
    }

    try {
      const dane = fs.readFileSync(docelowy)
      const typ = TYPY[path.extname(docelowy).toLowerCase()] || 'application/octet-stream'
      return new Response(dane, { status: 200, headers: { 'content-type': typ } })
    } catch (e) {
      return new Response(`Nie znaleziono pliku: ${sciezka}`, { status: 404 })
    }
  })
}

// ---------------------------------------------------------------------------
// Natywny zapis PDF – przewaga desktopu nad przegladarka:
// jeden klik zamiast okna drukowania i "Zapisz jako PDF".
// ---------------------------------------------------------------------------
ipcMain.handle('amico:zapisz-pdf', async (zdarzenie, { nazwa }) => {
  const wc = zdarzenie.sender
  const okno = BrowserWindow.fromWebContents(wc)

  const { canceled, filePath } = await dialog.showSaveDialog(okno, {
    title: 'Zapisz dokument jako PDF',
    defaultPath: path.join(app.getPath('documents'), `${nazwa || 'dokument'}.pdf`),
    filters: [{ name: 'Dokument PDF', extensions: ['pdf'] }],
  })
  if (canceled || !filePath) return { ok: false, anulowane: true }

  try {
    const pdf = await wc.printToPDF({
      printBackground: true, // KONIECZNE: inaczej znikaja ciemne belki i kwoty na nich
      pageSize: 'A4',
      margins: { marginType: 'custom', top: 0.47, bottom: 0.47, left: 0.47, right: 0.47 },
    })
    fs.writeFileSync(filePath, pdf)
    shell.showItemInFolder(filePath)
    return { ok: true, sciezka: filePath }
  } catch (e) {
    return { ok: false, blad: String(e?.message || e) }
  }
})

ipcMain.handle('amico:wersja', () => app.getVersion())

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
// Jedna instancja – drugie uruchomienie tylko podnosi istniejace okno
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (glowneOkno) {
      if (glowneOkno.isMinimized()) glowneOkno.restore()
      glowneOkno.focus()
    }
  })

  app.whenReady().then(() => {
    zarejestrujProtokol()
    ustawMenu()
    utworzOkno()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) utworzOkno()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
