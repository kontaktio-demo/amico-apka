import { useEffect } from 'react'
import { Routes, Route } from 'react-router-dom'
import { AppShell } from './components/AppShell'
import { PrintProvider } from './lib/print'
import { ToastProvider } from './components/ui'
import { ErrorBoundary } from './components/ErrorBoundary'
import { PWAReloadPrompt } from './components/PWAReloadPrompt'
import { AuthProvider } from './components/Auth'
import { useStore } from './lib/store'
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

export default function App() {
  const init = useStore((s) => s.init)
  const hydrated = useStore((s) => s.hydrated)

  useEffect(() => {
    init()
  }, [init])

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
            <Route path="/klienci" element={<Klienci />} />
            <Route path="/klienci/:id" element={<Klienci />} />
            <Route path="/zlecenia" element={<Zlecenia />} />
            <Route path="/zlecenia/:id" element={<Zlecenia />} />
            <Route path="/kalendarz" element={<Kalendarz />} />
            <Route path="/wyceny" element={<Wyceny />} />
            <Route path="/wyceny/:id" element={<Wyceny />} />
            <Route path="/umowy" element={<Umowy />} />
            <Route path="/umowy/:id" element={<Umowy />} />
            <Route path="/faktury" element={<Faktury />} />
            <Route path="/faktury/:id" element={<Faktury />} />
            <Route path="/dokumenty" element={<Dokumenty />} />
            <Route path="/kontrahenci" element={<Kontrahenci />} />
            <Route path="/produkty" element={<Produkty />} />
            <Route path="/ekspozycje" element={<Ekspozycje />} />
            <Route path="/finanse" element={<Finanse />} />
            <Route path="/odprawa" element={<Odprawa />} />
            <Route path="/ustawienia" element={<Ustawienia />} />
            <Route path="*" element={<Pulpit />} />
          </Routes>
          </ErrorBoundary>
        </AppShell>
        <PWAReloadPrompt />
        </AuthProvider>
      </PrintProvider>
    </ToastProvider>
  )
}
