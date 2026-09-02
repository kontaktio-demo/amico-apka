import { Link } from 'react-router-dom'
import { ScrollText, Check, AlertTriangle } from 'lucide-react'
import { useStore } from '../lib/store'
import { today, fmtDate } from '../lib/format'
import { czyDzienPracy } from '../lib/godziny'

// ============================================================================
// Przypomnienie na Pulpicie: w dni pracy (wt-sob) codziennie trzeba zrobic
// raport kasowy. Widza je wszyscy. Gdy raport na dzis jest juz zapisany -
// pokazujemy zielone potwierdzenie. W dni wolne (niedz/pon) nic nie pokazujemy.
// ============================================================================
export function PrzypomnienieRaportKasowy() {
  const firma = useStore((s) => s.aktywnaFirma)()
  const raporty = useStore((s) => s.baza.raportyKasowe)

  if (!czyDzienPracy()) return null

  const t = today()
  // "Zrobiony na dziś" = raport z dzisiejsza data LUB okres (od..do) obejmujacy dzis
  // (raport tygodniowy/miesieczny tez liczy sie jako pokrywajacy dzisiejszy dzien).
  const zrobiony = raporty.some(
    (r) => r.firmaId === firma.id && (r.data === t || (r.od <= t && (r.do || r.od) >= t)),
  )

  if (zrobiony) {
    return (
      <div className="mb-5 flex items-center gap-2.5 rounded-2xl border border-emerald-500/25 bg-emerald-100 px-4 py-2.5 text-[13.5px] text-emerald-700">
        <Check size={16} className="shrink-0" />
        Raport kasowy na dziś jest już zrobiony. Dobra robota!
      </div>
    )
  }

  return (
    <div className="mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-500/30 bg-amber-100 px-4 py-3.5">
      <AlertTriangle size={18} className="shrink-0 text-amber-700" />
      <div className="min-w-0 flex-1 text-[14px] text-amber-800">
        <b>Raport kasowy na dziś ({fmtDate(t)}) nie jest jeszcze zrobiony.</b>
        <div className="text-[12.5px] text-amber-700/80">Trzeba go wypełnić w każdy dzień pracy (wt–sob).</div>
      </div>
      <Link to="/raport-kasowy" className="btn-primary btn-sm">
        <ScrollText size={15} /> Wypełnij raport
      </Link>
    </div>
  )
}
