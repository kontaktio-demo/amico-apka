import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PrintProvider } from './lib/print'
import { ToastProvider } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PWAReloadPrompt } from './components/PWAReloadPrompt'
import { AuthProvider } from './components/Auth'
import { sesjaChmury, startSync } from './lib/cloud'
import { useStore } from './lib/store'
import { czyDesktop, most } from './lib/desktop'
import { LogoMark } from './components/Logo'

import Pulpit from './modules/Pulpit'
import Klienci from './modules/Klienci'
import Zlecenia from './modules/Zlecenia'
import Kalendarz from './modules/Kalendarz'
import Wyceny from './modules/Wyceny'
import Umowy from './modules/Umowy'
import Faktury from './modules/Faktury'
import Dokumenty from './modules/Dokumenty'
import Kontrahenci from './modules/Kontrahenci'
import Produkty from './modules/Produkty'
import Ekspozycje from './modules/Ekspozycje'
import Finanse from './modules/Finanse'
import Odprawa from './modules/Odprawa'
import Ustawienia from './modules/Ustawienia'
import Zadania from './modules/Zadania'
import Skany from './modules/Skany'
import Wizualizacja from './modules/Wizualizacja'
import Pomoc from './modules/Pomoc'
import { RoleGuard } from './components/RoleGuard'

export default function App() {
  const init = useStore((s) => s.init)
  const hydrated = useStore((s) => s.hydrated)

  useEffect(() => {
    init()
  }, [init])

  // Po wczytaniu lokalnej bazy: jesli jest sesja w chmurze – wlacz synchronizacje
  useEffect(() => {
    if (!hydrated) return
    sesjaChmury()
      .then((s) => {
        if (s) return startSync()
      })
      .catch(() => {})
  }, [hydrated])

  // Menu aplikacji desktopowej -> Pomoc -> Poradnik
  useEffect(() => {
    if (!czyDesktop()) return
    return most()?.naOtworzPoradnik(() => {
      window.location.hash = '#/pomoc'
    })
  }, [])

  if (!hydrated) {
    return (
      <div className="grid h-full place-items-center bg-stone-50">
        <div className="flex flex-col items-center gap-3 animate-fade-in">
          <LogoMark size={56} />
          <div className="text-[13px] font-medium text-stone-400">Wczytywanie AMICO…</div>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <PrintProvider>
        <AuthProvider>
          <AppShell>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<Pulpit />} />
                <Route
                  path="/klienci"
                  element={
                    <RoleGuard path="/klienci">
                      <Klienci />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/klienci/:id"
                  element={
                    <RoleGuard path="/klienci">
                      <Klienci />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/zlecenia"
                  element={
                    <RoleGuard path="/zlecenia">
                      <Zlecenia />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/zlecenia/:id"
                  element={
                    <RoleGuard path="/zlecenia">
                      <Zlecenia />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/kalendarz"
                  element={
                    <RoleGuard path="/kalendarz">
                      <Kalendarz />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/zadania"
                  element={
                    <RoleGuard path="/zadania">
                      <Zadania />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/wyceny"
                  element={
                    <RoleGuard path="/wyceny">
                      <Wyceny />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/wyceny/:id"
                  element={
                    <RoleGuard path="/wyceny">
                      <Wyceny />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/umowy"
                  element={
                    <RoleGuard path="/umowy">
                      <Umowy />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/umowy/:id"
                  element={
                    <RoleGuard path="/umowy">
                      <Umowy />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/faktury"
                  element={
                    <RoleGuard path="/faktury">
                      <Faktury />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/faktury/:id"
                  element={
                    <RoleGuard path="/faktury">
                      <Faktury />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/dokumenty"
                  element={
                    <RoleGuard path="/dokumenty">
                      <Dokumenty />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/skany"
                  element={
                    <RoleGuard path="/skany">
                      <Skany />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/wizualizacja"
                  element={
                    <RoleGuard path="/wizualizacja">
                      <Wizualizacja />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/kontrahenci"
                  element={
                    <RoleGuard path="/kontrahenci">
                      <Kontrahenci />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/produkty"
                  element={
                    <RoleGuard path="/produkty">
                      <Produkty />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/ekspozycje"
                  element={
                    <RoleGuard path="/ekspozycje">
                      <Ekspozycje />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/finanse"
                  element={
                    <RoleGuard path="/finanse">
                      <Finanse />
                    </RoleGuard>
                  }
                />
                <Route
                  path="/odprawa"
                  element={
                    <RoleGuard path="/odprawa">
                      <Odprawa />
                    </RoleGuard>
                  }
                />
                <Route path="/pomoc" element={<Pomoc />} />
                <Route
                  path="/ustawienia"
                  element={
                    <RoleGuard path="/ustawienia">
                      <Ustawienia />
                    </RoleGuard>
                  }
                />
                <Route path="*" element={<Pulpit />} />
              </Routes>
            </ErrorBoundary>
          </AppShell>
          {/* Service worker i "nowa wersja" to sprawy przegladarki.
              W wersji desktopowej aktualizuje sie ja instalatorem. */}
          {!czyDesktop() && <PWAReloadPrompt />}
        </AuthProvider>
      </PrintProvider>
    </ToastProvider>
  )
}
