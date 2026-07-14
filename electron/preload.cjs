// Jedyny most miedzy aplikacja a systemem. Strona NIE ma dostepu do Node.
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('amico', {
  desktop: true,
  // Natywny zapis PDF (okno "Zapisz jako", potem podswietlenie pliku w folderze)
  zapiszPdf: (nazwa) => ipcRenderer.invoke('amico:zapisz-pdf', { nazwa }),
  wersja: () => ipcRenderer.invoke('amico:wersja'),
  // Skroty z menu aplikacji
  naOtworzPoradnik: (cb) => {
    const h = () => cb()
    ipcRenderer.on('amico:otworz-poradnik', h)
    return () => ipcRenderer.removeListener('amico:otworz-poradnik', h)
  },
})
