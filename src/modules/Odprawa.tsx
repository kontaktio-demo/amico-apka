import { useState } from 'react'
import {
  ClipboardList,
  Plus,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  ListPlus,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, CardBody, EmptyState, Input, Badge } from '../components/ui'
import { PrintSendBar } from '../components/PrintSendBar'
import { OdprawaDoc } from '../documents/OdprawaDoc'
import { today, fmtDate, fmtDateLong, addDays, nowISO } from '../lib/format'
import { uid } from '../lib/id'
import type { Odprawa as OdprawaT, OdprawaSekcja, Pracownik } from '../lib/types'

// ---------- Domyslne sekcje odprawy dziennej ----------
function domyslneSekcje(pracownicy: Pracownik[]): OdprawaSekcja[] {
  const monterzy = pracownicy.filter((p) => p.rola === 'montaz' && p.aktywny)
  const montaze: OdprawaSekcja[] = monterzy.length
    ? monterzy.map((p) => ({ klucz: `montaz_${p.id}`, tytul: `MONTAŻ — ${p.imie}`, pozycje: [] }))
    : [{ klucz: 'montaze', tytul: 'MONTAŻE', pozycje: [] }]
  return [
    ...montaze,
    { klucz: 'pomiary', tytul: 'POMIARY DO ZROBIENIA', pozycje: [] },
    { klucz: 'transport', tytul: 'TRANSPORT PŁYT', pozycje: [] },
    { klucz: 'rozliczenia', tytul: 'ZLECENIA DO ROZLICZENIA', pozycje: [] },
    { klucz: 'umowy', tytul: 'NOWE UMOWY', pozycje: [] },
    { klucz: 'inne', tytul: 'INNE', pozycje: [] },
  ]
}

export default function Odprawa() {
  const b = useStore((s) => s.baza)
  const firma = useStore((s) => s.aktywnaFirma)()
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)

  const [data, setData] = useState<string>(today())

  const odprawa = b.odprawy.find((o) => o.data === data)

  // Utworz odprawe na wybrany dzien z domyslnymi sekcjami
  const utworz = () => {
    const nowa: OdprawaT = {
      id: uid('odp'),
      data,
      sekcje: domyslneSekcje(b.pracownicy),
      utworzono: nowISO(),
    }
    upsert('odprawy', nowa)
  }

  // Zapis zmodyfikowanych sekcji
  const zapisz = (sekcje: OdprawaSekcja[]) => {
    if (!odprawa) return
    upsert('odprawy', { ...odprawa, sekcje })
  }

  const setTytul = (idx: number, tytul: string) => {
    if (!odprawa) return
    zapisz(odprawa.sekcje.map((s, i) => (i === idx ? { ...s, tytul } : s)))
  }
  const usunSekcje = (idx: number) => {
    if (!odprawa) return
    zapisz(odprawa.sekcje.filter((_, i) => i !== idx))
  }
  const dodajSekcje = () => {
    if (!odprawa) return
    zapisz([...odprawa.sekcje, { klucz: uid('sek'), tytul: 'NOWA SEKCJA', pozycje: [''] }])
  }
  const dodajLinie = (idx: number) => {
    if (!odprawa) return
    zapisz(odprawa.sekcje.map((s, i) => (i === idx ? { ...s, pozycje: [...s.pozycje, ''] } : s)))
  }
  const setLinia = (idx: number, li: number, tekst: string) => {
    if (!odprawa) return
    zapisz(
      odprawa.sekcje.map((s, i) =>
        i === idx ? { ...s, pozycje: s.pozycje.map((p, j) => (j === li ? tekst : p)) } : s,
      ),
    )
  }
  const usunLinie = (idx: number, li: number) => {
    if (!odprawa) return
    zapisz(odprawa.sekcje.map((s, i) => (i === idx ? { ...s, pozycje: s.pozycje.filter((_, j) => j !== li) } : s)))
  }

  const liczbaPozycji = odprawa ? odprawa.sekcje.reduce((n, s) => n + s.pozycje.filter((p) => p.trim()).length, 0) : 0

  // Tresc do wyslania (SMS / e-mail / udostepnij)
  const shareText = odprawa
    ? [
        `ODPRAWA — ${fmtDateLong(data)}`,
        '',
        ...odprawa.sekcje.map((s) => {
          const poz = s.pozycje.filter((p) => p.trim())
          return `${s.tytul}:\n${poz.length ? poz.map((p) => `  • ${p}`).join('\n') : '  —'}`
        }),
      ].join('\n')
    : ''

  return (
    <div>
      <PageHeader
        title="Odprawa dzienna"
        subtitle="Dzienny plan pracy pracowni — montaże, pomiary, transport i rozliczenia"
        icon={<ClipboardList size={22} />}
        actions={
          odprawa && (
            <PrintSendBar
              getPrintNode={() => <OdprawaDoc o={odprawa} firma={firma} logoDataUrl={b.ustawienia.logoDataUrl} />}
              share={{ title: `Odprawa ${fmtDate(data)}`, text: shareText }}
            />
          )
        }
      />

      {/* Wybor daty */}
      <Card className="mb-6">
        <CardBody className="flex flex-wrap items-center gap-3">
          <button className="btn-ghost !px-2" title="Poprzedni dzień" onClick={() => setData(addDays(data, -1))}>
            <ChevronLeft size={20} />
          </button>
          <div className="relative">
            <CalendarDays size={17} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input type="date" value={data} onChange={(e) => setData(e.target.value || today())} className="input pl-10" />
          </div>
          <button className="btn-ghost !px-2" title="Następny dzień" onClick={() => setData(addDays(data, 1))}>
            <ChevronRight size={20} />
          </button>
          {data !== today() && (
            <button className="btn-outline btn-sm" onClick={() => setData(today())}>
              Dziś
            </button>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="text-[13.5px] text-stone-500">{fmtDateLong(data)}</span>
            {odprawa && <Badge tone="green">{liczbaPozycji} pozycji</Badge>}
          </div>
        </CardBody>
      </Card>

      {!odprawa ? (
        <EmptyState
          icon={<ClipboardList size={28} />}
          title="Brak odprawy na ten dzień"
          desc="Utwórz odprawę z domyślnymi sekcjami: montaże (wg monterów), pomiary, transport płyt, zlecenia do rozliczenia, nowe umowy i inne."
          action={
            <button className="btn-primary" onClick={utworz}>
              <Plus size={17} /> Utwórz odprawę
            </button>
          }
        />
      ) : (
        <>
          <div className="grid gap-4 lg:grid-cols-2">
            {odprawa.sekcje.map((s, idx) => (
              <Card key={s.klucz}>
                <CardBody>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-600" />
                    <Input
                      value={s.tytul}
                      onChange={(e) => setTytul(idx, e.target.value)}
                      className="!h-9 !py-1 text-[13.5px] font-semibold uppercase tracking-wide"
                      placeholder="Nazwa sekcji"
                    />
                    <button
                      className="btn-ghost !px-2 text-stone-400 hover:text-red-600"
                      title="Usuń sekcję"
                      onClick={() => usunSekcje(idx)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {s.pozycje.length === 0 && (
                      <p className="px-1 py-2 text-[13px] text-stone-400">Brak pozycji — dodaj pierwszą linię.</p>
                    )}
                    {s.pozycje.map((p, li) => (
                      <div key={li} className="flex items-center gap-2">
                        <span className="w-4 shrink-0 text-right text-[12px] text-stone-300">{li + 1}</span>
                        <Input
                          value={p}
                          onChange={(e) => setLinia(idx, li, e.target.value)}
                          placeholder="Wpisz pozycję…"
                          className="!h-9 !py-1"
                        />
                        <button
                          className="btn-ghost !px-2 text-stone-300 hover:text-red-600"
                          title="Usuń linię"
                          onClick={() => usunLinie(idx, li)}
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>

                  <button className="btn-ghost btn-sm mt-2 text-brand-700" onClick={() => dodajLinie(idx)}>
                    <Plus size={15} /> Dodaj pozycję
                  </button>
                </CardBody>
              </Card>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button className="btn-outline" onClick={dodajSekcje}>
              <ListPlus size={17} /> Dodaj sekcję
            </button>
            <button
              className="btn-ghost text-stone-400 hover:text-red-600"
              onClick={() => remove('odprawy', odprawa.id)}
            >
              <Trash2 size={16} /> Usuń odprawę
            </button>
          </div>
        </>
      )}
    </div>
  )
}
