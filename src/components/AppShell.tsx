import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Calculator,
  FileSignature,
  Receipt,
  FileCheck2,
  CalendarDays,
  Contact,
  Layers,
  Store,
  Wallet,
  ListChecks,
  ListTodo,
  ScanLine,
  Sparkles,
  HeartHandshake,
  Settings,
  Menu,
  X,
  ChevronsUpDown,
  Check,
  Download,
  ShieldCheck,
  Lock,
  LogOut,
  AlertTriangle,
} from 'lucide-react'
import { Logo } from './Logo'
import { useStore } from '../lib/store'
import { requestPersistence } from '../lib/db'
import { cx } from './ui'
import { useAuth } from './Auth'
import { dozwoloneSciezki, nazwaRoli } from '../lib/auth'
import { initials } from '../lib/format'
import { Skaner } from './Skaner'
import { StatusChip } from './CloudPanel'

interface NavItem {
  to: string
  label: string
  icon: React.ReactNode
}
const GROUPS: { grupa: string; items: NavItem[] }[] = [
  {
    grupa: 'Główne',
    items: [
      { to: '/', label: 'Pulpit', icon: <LayoutDashboard size={19} /> },
      { to: '/klienci', label: 'Klienci CRM', icon: <Users size={19} /> },
      { to: '/zlecenia', label: 'Zlecenia', icon: <ClipboardList size={19} /> },
      { to: '/kalendarz', label: 'Kalendarz', icon: <CalendarDays size={19} /> },
      { to: '/zadania', label: 'Zadania', icon: <ListTodo size={19} /> },
    ],
  },
  {
    grupa: 'Sprzedaż i dokumenty',
    items: [
      { to: '/wyceny', label: 'Oferty / Wyceny', icon: <Calculator size={19} /> },
      { to: '/umowy', label: 'Umowy', icon: <FileSignature size={19} /> },
      { to: '/faktury', label: 'Faktury', icon: <Receipt size={19} /> },
      { to: '/dokumenty', label: 'Protokoły / KP', icon: <FileCheck2 size={19} /> },
      { to: '/skany', label: 'Skany / Archiwum', icon: <ScanLine size={19} /> },
      { to: '/wizualizacja', label: 'Wizualizacja', icon: <Sparkles size={19} /> },
    ],
  },
  {
    grupa: 'Firma',
    items: [
      { to: '/kontrahenci', label: 'Kontrahenci', icon: <Contact size={19} /> },
      { to: '/produkty', label: 'Produkty / Katalog', icon: <Layers size={19} /> },
      { to: '/ekspozycje', label: 'Ekspozycje', icon: <Store size={19} /> },
      { to: '/finanse', label: 'Finanse', icon: <Wallet size={19} /> },
      { to: '/odprawa', label: 'Odprawa', icon: <ListChecks size={19} /> },
    ],
  },
]

export function AppShell({ children }: { children: React.ReactNode }) {
  const [openMobile, setOpenMobile] = useState(false)
  const [skaner, setSkaner] = useState(false)
  const loc = useLocation()
  useEffect(() => setOpenMobile(false), [loc.pathname])

  return (
    <div className="flex h-full">
      {/* Sidebar desktop */}
      <aside className="hidden w-[270px] shrink-0 flex-col border-r border-white/[0.07] bg-[#0c0d13] lg:flex">
        <SidebarContent />
      </aside>

      {/* Sidebar mobile */}
      {openMobile && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setOpenMobile(false)} />
          <aside className="absolute left-0 top-0 flex h-full w-[280px] flex-col bg-[#0c0d13] shadow-pop animate-fade-in">
            <SidebarContent onClose={() => setOpenMobile(false)} />
          </aside>
        </div>
      )}

      {/* Kolumna glowna */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Topbar mobile */}
        <header className="flex items-center gap-3 border-b border-white/[0.07] bg-[#0b0b10]/85 px-4 py-3 backdrop-blur lg:hidden">
          <button className="btn-ghost !px-2" onClick={() => setOpenMobile(true)}>
            <Menu size={22} />
          </button>
          <Logo variant="compact" />
          <div className="flex-1" />
          <FirmaSwitcher compact />
        </header>

        <PasekBleduZapisu />

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1200px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8 animate-fade-in">{children}</div>
        </main>
      </div>

      {/* Szybki skan – dostepny wszedzie (szczegolnie w terenie) */}
      <button
        onClick={() => setSkaner(true)}
        title="Skanuj dokument"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand-600 px-4 py-3.5 font-semibold text-white shadow-pop transition hover:bg-brand-500 active:scale-95 no-print"
      >
        <ScanLine size={20} />
        <span className="hidden sm:inline">Skanuj</span>
      </button>
      <Skaner open={skaner} onClose={() => setSkaner(false)} />
    </div>
  )
}

// Zapis na urzadzeniu sie nie powiodl (najczesciej: brak miejsca).
// Bez tego paska uzytkowniczka traci prace, nie wiedzac o tym.
function PasekBleduZapisu() {
  const blad = useStore((s) => s.bladZapisu)
  if (!blad) return null
  return (
    <div className="no-print flex items-start gap-2.5 border-b border-red-500/30 bg-red-500/15 px-4 py-3 text-[13.5px] text-red-200">
      <AlertTriangle size={17} className="mt-0.5 shrink-0" />
      <div>
        <b>Nie udało się zapisać danych na tym urządzeniu.</b> {blad}
        <div className="mt-0.5 text-red-300/80">
          Nie zamykaj aplikacji. Zwolnij miejsce na urządzeniu, a następnie zrób kopię zapasową w Ustawieniach
          (Eksport).
        </div>
      </div>
    </div>
  )
}

function SidebarContent({ onClose }: { onClose?: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-5">
        <Logo />
        {onClose && (
          <button className="btn-ghost !px-2 lg:hidden" onClick={onClose}>
            <X size={20} />
          </button>
        )}
      </div>
      <div className="px-3">
        <FirmaSwitcher />
      </div>
      <RoleNav />
    </>
  )
}

function RoleNav() {
  const { user } = useAuth()
  const allowed = user ? dozwoloneSciezki(user.rola) : 'all'
  const wolno = (to: string) => allowed === 'all' || allowed.includes(to)
  const grupy = GROUPS.map((g) => ({ ...g, items: g.items.filter((it) => wolno(it.to)) })).filter((g) => g.items.length)

  return (
    <>
      <nav className="mt-3 flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {grupy.map((g) => (
          <div key={g.grupa}>
            <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              {g.grupa}
            </div>
            <div className="space-y-0.5">
              {g.items.map((it) => (
                <NavLink
                  key={it.to}
                  to={it.to}
                  end={it.to === '/'}
                  className={({ isActive }) => cx('nav-link', isActive && 'nav-link-active')}
                >
                  {it.icon}
                  {it.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="border-t border-white/[0.07] p-3">
        <NavLink to="/pomoc" className={({ isActive }) => cx('nav-link', isActive && 'nav-link-active')}>
          <HeartHandshake size={19} /> Poradnik
        </NavLink>
        {wolno('/ustawienia') && (
          <NavLink to="/ustawienia" className={({ isActive }) => cx('nav-link', isActive && 'nav-link-active')}>
            <Settings size={19} /> Ustawienia
          </NavLink>
        )}
        <UserFooter />
        <div className="mt-2 px-1">
          <StatusChip />
        </div>
        <StorageStatus />
      </div>
    </>
  )
}

function UserFooter() {
  const { user, lock, logout } = useAuth()
  if (!user) return null
  return (
    <div className="mt-2 flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-2.5 py-2">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[12px] font-semibold text-white"
        style={{ background: user.kolor || '#3a4a7a' }}
      >
        {initials(user.imie)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{user.imie}</div>
        <div className="text-[11px] text-stone-500">{nazwaRoli(user.rola)}</div>
      </div>
      <button
        onClick={lock}
        title="Zablokuj"
        className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-white/[0.06] hover:text-white"
      >
        <Lock size={16} />
      </button>
      <button
        onClick={logout}
        title="Wyloguj"
        className="grid h-8 w-8 place-items-center rounded-lg text-stone-400 hover:bg-white/[0.06] hover:text-white"
      >
        <LogOut size={16} />
      </button>
    </div>
  )
}

function FirmaSwitcher({ compact }: { compact?: boolean }) {
  const firmy = useStore((s) => s.baza.firmy)
  const aktywnaId = useStore((s) => s.baza.ustawienia.aktywnaFirmaId)
  const setAktywna = useStore((s) => s.setAktywnaFirma)
  const [open, setOpen] = useState(false)
  const aktywna = firmy.find((f) => f.id === aktywnaId) || firmy[0]

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left transition hover:border-white/20',
          compact && 'w-auto',
        )}
      >
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white"
          style={{ background: aktywna?.kolor || '#0f5c3f' }}
        >
          <span className="text-[12px] font-bold">{aktywna?.wlasciciel?.[0] || 'A'}</span>
        </span>
        {!compact && (
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-ink">{aktywna?.nazwa}</span>
            <span className="block text-[11px] text-stone-400">Podmiot wystawiający</span>
          </span>
        )}
        <ChevronsUpDown size={15} className="text-stone-400" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-white/10 bg-[#14161f] p-1.5 shadow-pop animate-scale-in">
            {firmy.map((f) => (
              <button
                key={f.id}
                onClick={() => {
                  setAktywna(f.id)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition hover:bg-stone-100"
              >
                <span
                  className="grid h-6 w-6 place-items-center rounded-md text-white"
                  style={{ background: f.kolor || '#0f5c3f' }}
                >
                  <span className="text-[11px] font-bold">{f.wlasciciel[0]}</span>
                </span>
                <span className="flex-1 text-[13px] font-medium text-stone-700">{f.nazwa}</span>
                {f.id === aktywnaId && <Check size={15} className="text-brand-700" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function StorageStatus() {
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const [installEvt, setInstallEvt] = useState<any>(null)
  const [standalone, setStandalone] = useState(false)

  useEffect(() => {
    requestPersistence().then(setPersisted)
    setStandalone(window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone === true)
    const h = (e: any) => {
      e.preventDefault()
      setInstallEvt(e)
    }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  return (
    <div className="mt-2 space-y-1.5 px-2">
      {installEvt && !standalone && (
        <button
          onClick={async () => {
            installEvt.prompt()
            await installEvt.userChoice
            setInstallEvt(null)
          }}
          className="flex w-full items-center gap-2 rounded-lg bg-brand-50 px-2.5 py-2 text-[12.5px] font-semibold text-brand-700 transition hover:bg-brand-100"
        >
          <Download size={15} /> Zainstaluj aplikację
        </button>
      )}
      <div className="flex items-center gap-1.5 px-1 text-[11px] text-stone-400">
        <ShieldCheck size={13} className={persisted ? 'text-brand-600' : 'text-stone-400'} />
        {persisted ? 'Dane zabezpieczone lokalnie' : 'Pamięć lokalna'}
      </div>
    </div>
  )
}
