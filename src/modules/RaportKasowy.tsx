import { useState } from 'react'
import { ScrollText, Check, AlertTriangle, PenLine } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, CardBody } from '../components/ui'
import { today, fmtDate } from '../lib/format'
import { czyDzienPracy, nazwaDnia } from '../lib/godziny'
import { RaportyTab } from './Finanse'

// ============================================================================
// Raport kasowy - osobna, codzienna kategoria. Osoba wpisuje dane w kolumny
// (nazwisko, nr zlecenia, tresc, przychod, rozchod), klika "Zapisz raport" i
// moze go wydrukowac. W dni pracy (wt-sob) pokazujemy status "na dzis".
// Pod spodem pelna lista raportow - ten sam edytor i wydruk co w Finansach.
// ============================================================================
export default function RaportKasowy() {
  const firma = useStore((s) => s.aktywnaFirma)()
  const raporty = useStore((s) => s.baza.raportyKasowe)
  const [sygnal, setSygnal] = useState(0)

  const t = today()
  const dzienPracy = czyDzienPracy()
  // Dzisiejsza data lub okres (od..do) obejmujacy dzis liczy sie jako zrobiony na dzis.
  const zrobionyDzis = raporty.some(
    (r) => r.firmaId === firma.id && (r.data === t || (r.od <= t && (r.do || r.od) >= t)),
  )

  return (
    <div>
      <PageHeader
        title="Raport kasowy"
        subtitle={`Wypełniaj codziennie w dni pracy (wt–sob) · ${fmtDate(t)}`}
        icon={<ScrollText size={22} />}
      />

      {!dzienPracy ? (
        <Card className="mb-5">
          <CardBody className="flex items-center gap-3 text-[13.5px] text-stone-500">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-black/[0.04] text-stone-400">
              <ScrollText size={17} />
            </span>
            Dziś ({nazwaDnia()}) pracownia jest zamknięta — raport kasowy nie jest wymagany. Możesz w razie potrzeby
            dodać raport za inny dzień poniżej.
          </CardBody>
        </Card>
      ) : zrobionyDzis ? (
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-100 px-4 py-3 text-[14px] text-emerald-700">
          <Check size={18} className="shrink-0" />
          <span>
            <b>Raport kasowy na dziś jest zrobiony.</b> Możesz go poprawić lub wydrukować poniżej.
          </span>
        </div>
      ) : (
        <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-100 px-4 py-3.5">
          <AlertTriangle size={18} className="shrink-0 text-amber-700" />
          <div className="min-w-0 flex-1 text-[14px] text-amber-800">
            <b>Raport kasowy na dziś ({fmtDate(t)}) nie jest jeszcze zrobiony.</b>
            <div className="text-[12.5px] text-amber-700/80">
              Uzupełnij wszystkie kolumny, kliknij „Zapisz raport", a potem możesz go wydrukować.
            </div>
          </div>
          <button className="btn-primary" onClick={() => setSygnal((s) => s + 1)}>
            <PenLine size={16} /> Wypełnij raport na dziś
          </button>
        </div>
      )}

      <RaportyTab firma={firma} nowySygnal={sygnal} />
    </div>
  )
}
