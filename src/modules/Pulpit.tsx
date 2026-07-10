import { Link } from 'react-router-dom'
import {
  Users,
  Calculator,
  FileSignature,
  ClipboardList,
  CalendarDays,
  Wallet,
  ArrowRight,
  TrendingUp,
  Plus,
  Receipt,
  Store,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Stat, Card, CardBody, Badge } from '../components/ui'
import { fmtPLN, fmtDate, today } from '../lib/format'
import { klientNazwa, etapInfo, PIPELINE } from '../lib/helpers'
import { podsumuj } from '../lib/format'

export default function Pulpit() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()

  const t = today()
  const wydarzeniaDzis = b.wydarzenia.filter((w) => w.data === t && !w.zrobione)
  const wydarzeniaNadchodzace = b.wydarzenia
    .filter((w) => w.data >= t && !w.zrobione)
    .sort((a, c) => a.data.localeCompare(c.data))
    .slice(0, 6)

  const aktywneZlecenia = b.zlecenia.filter((z) => z.etap !== 'zakonczone' && z.etap !== 'utracony')
  const doPodpisu = b.umowy.filter((u) => u.status === 'do_podpisu' || u.status === 'szkic')
  const wartoscOfert = b.wyceny
    .filter((w) => w.status !== 'odrzucona')
    .reduce((sum, w) => sum + podsumuj(w.pozycje).brutto, 0)
  const naleznosci = b.faktury.filter((f) => f.status !== 'oplacona').reduce((s, f) => s + podsumuj(f.pozycje).brutto - (f.zaplacono || 0), 0)

  const godzina = new Date().getHours()
  const powitanie = godzina < 12 ? 'Dzień dobry' : godzina < 18 ? 'Dzień dobry' : 'Dobry wieczór'

  // rozklad pipeline
  const rozklad = PIPELINE.filter((p) => p.klucz !== 'utracony').map((p) => ({
    ...p,
    n: b.klienci.filter((k) => k.etap === p.klucz).length + b.zlecenia.filter((z) => z.etap === p.klucz).length,
  }))
  const maxN = Math.max(1, ...rozklad.map((r) => r.n))

  return (
    <div>
      <PageHeader
        title={`${powitanie}, ${firma.wlasciciel.split(' ')[0]}`}
        subtitle={`Pulpit AMICO · ${fmtDate(t)} · podmiot: ${firma.nazwa}`}
        actions={
          <Link to="/wyceny" className="btn-primary">
            <Plus size={17} /> Nowa wycena
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Klienci" value={b.klienci.length} icon={<Users size={18} />} sub={`${aktywneZlecenia.length} aktywnych zleceń`} />
        <Stat label="Wartość ofert" value={fmtPLN(wartoscOfert)} tone="green" icon={<Calculator size={18} />} sub={`${b.wyceny.length} wycen`} />
        <Stat label="Umowy do podpisu" value={doPodpisu.length} icon={<FileSignature size={18} />} sub={`${b.umowy.length} umów łącznie`} />
        <Stat label="Należności" value={fmtPLN(naleznosci)} icon={<Receipt size={18} />} sub={`${b.faktury.length} faktur`} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Lejek */}
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <TrendingUp size={18} className="text-brand-700" /> Lejek realizacji
              </h3>
              <Link to="/zlecenia" className="text-[13px] font-medium text-brand-700 hover:underline">
                Zlecenia →
              </Link>
            </div>
            <div className="space-y-2.5">
              {rozklad.map((r) => (
                <div key={r.klucz} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-[13px] text-stone-500">{r.nazwa}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-stone-100">
                    <div
                      className="h-full rounded-lg bg-brand-600 transition-all"
                      style={{ width: `${(r.n / maxN) * 100}%`, minWidth: r.n ? 22 : 0 }}
                    />
                  </div>
                  <span className="w-6 text-right text-[13px] font-semibold text-stone-700">{r.n}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Dzis / kalendarz */}
        <Card>
          <CardBody>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <CalendarDays size={18} className="text-brand-700" /> Dziś i wkrótce
              </h3>
              <Link to="/kalendarz" className="text-[13px] font-medium text-brand-700 hover:underline">
                Kalendarz →
              </Link>
            </div>
            {wydarzeniaNadchodzace.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-stone-400">Brak zaplanowanych wydarzeń.</p>
            ) : (
              <div className="space-y-2">
                {wydarzeniaNadchodzace.map((w) => (
                  <div key={w.id} className="flex items-center gap-2.5 rounded-xl border border-stone-100 px-3 py-2">
                    <div className="text-center">
                      <div className="text-[11px] font-semibold text-brand-700">{fmtDate(w.data).slice(0, 5)}</div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-medium text-ink">{w.tytul}</div>
                      <div className="text-[11px] text-stone-400">
                        {w.godzina && `${w.godzina} · `}
                        {w.typ}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {wydarzeniaDzis.length > 0 && (
              <div className="mt-3">
                <Badge tone="amber">{wydarzeniaDzis.length} na dziś</Badge>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Ostatni klienci + szybkie akcje */}
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
                <Users size={18} className="text-brand-700" /> Ostatni klienci
              </h3>
              <Link to="/klienci" className="text-[13px] font-medium text-brand-700 hover:underline">
                Wszyscy →
              </Link>
            </div>
            {b.klienci.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-stone-400">Brak klientów — dodaj pierwszego w zakładce Klienci CRM.</p>
            ) : (
              <div className="divide-y divide-stone-100">
                {b.klienci
                  .slice()
                  .sort((a, c) => c.zaktualizowano.localeCompare(a.zaktualizowano))
                  .slice(0, 5)
                  .map((k) => {
                    const ei = etapInfo(k.etap)
                    return (
                      <Link key={k.id} to={`/klienci/${k.id}`} className="flex items-center gap-3 py-2.5 transition hover:bg-stone-50">
                        <span className="grid h-9 w-9 place-items-center rounded-full bg-brand-50 text-[13px] font-semibold text-brand-700">
                          {klientNazwa(k).slice(0, 1)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-medium text-ink">{klientNazwa(k)}</div>
                          <div className="text-[12px] text-stone-400">{k.telefon || k.email || '—'}</div>
                        </div>
                        <Badge tone={ei.tone as any}>{ei.nazwa}</Badge>
                      </Link>
                    )
                  })}
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">Szybkie akcje</h3>
            <div className="grid grid-cols-2 gap-2">
              <Qa to="/klienci" icon={<Users size={18} />} label="Nowy klient" />
              <Qa to="/wyceny" icon={<Calculator size={18} />} label="Wycena" />
              <Qa to="/umowy" icon={<FileSignature size={18} />} label="Umowa" />
              <Qa to="/zlecenia" icon={<ClipboardList size={18} />} label="Zlecenie" />
              <Qa to="/finanse" icon={<Wallet size={18} />} label="Raport kasowy" />
              <Qa to="/ekspozycje" icon={<Store size={18} />} label="Ekspozycja" />
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

function Qa({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <Link
      to={to}
      className="flex flex-col items-center gap-1.5 rounded-xl border border-stone-200 px-3 py-3.5 text-center transition hover:border-brand-300 hover:bg-brand-50"
    >
      <span className="text-brand-700">{icon}</span>
      <span className="text-[12.5px] font-medium text-stone-600">{label}</span>
    </Link>
  )
}
