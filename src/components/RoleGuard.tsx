import { Navigate } from 'react-router-dom'
import { Lock } from 'lucide-react'
import { useAuth } from './Auth'
import { maSciezke } from '../lib/auth'

// Chroni trase: jesli rola uzytkownika nie ma dostepu, przekierowuje na Pulpit.
export function RoleGuard({ path, children }: { path: string; children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) return null
  if (!maSciezke(user.rola, path)) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export function BrakDostepu() {
  return (
    <div className="grid min-h-[50vh] place-items-center">
      <div className="card card-pad max-w-sm text-center">
        <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.06] text-stone-400">
          <Lock size={22} />
        </div>
        <h2 className="text-[17px] font-display font-semibold text-ink">Brak dostępu</h2>
        <p className="mt-1 text-[13.5px] text-stone-500">Ta sekcja nie jest dostępna dla Twojej roli.</p>
      </div>
    </div>
  )
}
