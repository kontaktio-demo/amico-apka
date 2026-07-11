import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'

export function PWAReloadPrompt() {
  const {
    offlineReady: [offlineReady, setOfflineReady],
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  const [showOffline, setShowOffline] = useState(false)
  useEffect(() => {
    if (offlineReady) {
      setShowOffline(true)
      const t = setTimeout(() => {
        setShowOffline(false)
        setOfflineReady(false)
      }, 3500)
      return () => clearTimeout(t)
    }
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !showOffline) return null

  return (
    <div className="fixed bottom-4 right-4 z-[70] no-print">
      {needRefresh ? (
        <div className="flex items-center gap-3 rounded-2xl bg-ink px-4 py-3 text-white shadow-pop animate-fade-in">
          <RefreshCw size={17} />
          <span className="text-[13.5px] font-medium">Dostępna nowa wersja aplikacji</span>
          <button
            className="rounded-lg bg-brand-600 px-3 py-1.5 text-[13px] font-semibold hover:bg-brand-500"
            onClick={() => updateServiceWorker(true)}
          >
            Odśwież
          </button>
          <button className="text-[13px] text-white/60 hover:text-white" onClick={() => setNeedRefresh(false)}>
            Później
          </button>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-2xl bg-brand-700 px-4 py-3 text-white shadow-pop animate-fade-in">
          <WifiOff size={16} /> <span className="text-[13.5px] font-medium">Gotowe do pracy offline</span>
        </div>
      )}
    </div>
  )
}
