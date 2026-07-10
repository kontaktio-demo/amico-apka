import type { Odprawa, Firma } from '../lib/types'
import { DocSheet } from './DocShell'
import { fmtDate } from '../lib/format'

// Odwzorowanie kartki "ODPRAWA" – dzienny plan pracy pracowni.
// Uklad dwukolumnowy, kazda sekcja to ramka z zielonym naglowkiem i liniami do wpisywania.
export function OdprawaDoc({ o, firma, logoDataUrl }: { o: Odprawa; firma: Firma; logoDataUrl?: string }) {
  const rok = (o.data && o.data.slice(0, 4)) || String(new Date().getFullYear())

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl} bezStopki>
      <div style={{ textAlign: 'center', marginBottom: 14 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#0f5c3f',
            letterSpacing: '0.05em',
          }}
        >
          ODPRAWA
        </div>
        <div style={{ fontSize: '10pt', color: '#12130f', letterSpacing: '0.08em', fontWeight: 600, marginTop: 2 }}>
          Z DNIA {fmtDate(o.data)}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignItems: 'start' }}>
        {o.sekcje.map((s) => (
          <Sekcja key={s.klucz} tytul={s.tytul} pozycje={s.pozycje} />
        ))}
      </div>

      <div
        style={{
          marginTop: 24,
          borderTop: '1px solid #d8d4c8',
          paddingTop: 8,
          textAlign: 'center',
          fontSize: '7.8pt',
          color: '#8a8478',
        }}
      >
        © {rok} Pracownia Kamieniarska Amico
      </div>
    </DocSheet>
  )
}

function Sekcja({ tytul, pozycje }: { tytul: string; pozycje: string[] }) {
  // Ile linii pokazac: min. 5 (jak na oryginalnej kartce), wiecej gdy pozycji jest wiecej.
  const puste = Math.max(0, 5 - pozycje.length)
  const linie = [...pozycje, ...Array(puste).fill('')]

  return (
    <div
      style={{
        border: '1px solid #c9c4b6',
        borderRadius: 10,
        overflow: 'hidden',
      }}
      className="avoid-break"
    >
      <div
        style={{
          background: '#0f5c3f',
          color: '#fff',
          fontSize: '9pt',
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          padding: '4px 10px',
        }}
      >
        {tytul}
      </div>
      <div style={{ padding: '4px 0' }}>
        {linie.map((tekst, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: 6,
              minHeight: '1.55em',
              padding: '2px 10px',
              borderBottom: i < linie.length - 1 ? '1px dotted #cfcabb' : 'none',
            }}
          >
            <span style={{ color: '#a9a496', fontSize: '9pt', lineHeight: 1 }}>|</span>
            <span style={{ flex: 1, fontSize: '9.5pt', color: '#12130f', fontWeight: 500 }}>{tekst || ' '}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
