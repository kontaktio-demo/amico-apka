import type { Ekspozycja, Firma } from '../lib/types'
import { DocSheet } from './DocShell'
import { fmtPLN, fmtDate, round2 } from '../lib/format'

// Odwzorowanie formularza "ROZLICZENIE EKSPOZYCJI"
export function RozliczenieEkspozycjiDoc({
  e,
  firma,
  logoDataUrl,
}: {
  e: Ekspozycja
  firma: Firma
  logoDataUrl?: string
}) {
  const suma = round2(e.rozliczenia.reduce((a, r) => a + (r.kwotaNetto || 0), 0))
  const zobowiazanie = round2((e.wartoscNetto || 0) * (e.krotnosc || 0))
  const procent = zobowiazanie > 0 ? Math.min(100, (suma / zobowiazanie) * 100) : 0

  const box: React.CSSProperties = { border: '1px solid #c9c4b6', borderRadius: 10, padding: '9px 11px' }
  const secHead: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    background: '#12233a',
    color: '#fff',
    fontSize: '8.5pt',
    fontWeight: 700,
    borderRadius: 6,
    padding: '3px 9px',
    marginBottom: 6,
  }

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#12233a',
            letterSpacing: '0.08em',
          }}
        >
          ROZLICZENIE EKSPOZYCJI
        </div>
        {e.numer && <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 700, marginTop: 3 }}>{e.numer}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={box}>
          <div style={secHead}>1 · DANE UMOWY</div>
          <Row l="Data podpisania umowy:" v={fmtDate(e.dataPodpisania)} />
          <Row l="Data, do której obowiązuje umowa:" v={fmtDate(e.dataDo)} />
          <Row l="Nazwa firmy:" v={e.nazwaFirmy} />
          <Row l="Numer zlecenia:" v={e.numerZlecenia} />
        </div>
        <div style={box}>
          <div style={secHead}>2 · WARTOŚCI</div>
          <Row l="Wartość ekspozycji netto:" v={fmtPLN(e.wartoscNetto)} />
          <Row l="Wartość ekspozycji brutto:" v={fmtPLN(e.wartoscBrutto)} />
          <Row l={`Wartość ${e.krotnosc || 0}-krotna ekspozycji w netto:`} v={fmtPLN(zobowiazanie)} strong />
          <Row l="Wartość prac kamieniarskich i montażowych netto:" v={fmtPLN(e.wartoscPrac)} />
        </div>
      </div>

      <div style={{ ...box, marginTop: 10 }}>
        <div style={secHead}>3 · ROZLICZENIA</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#f0ede6' }}>
              <th style={cellH(90)}>DATA</th>
              <th style={{ ...cellH(), textAlign: 'left' }}>NUMER ZLECENIA</th>
              <th style={{ ...cellH(), textAlign: 'left' }}>NAZWISKO KLIENTA</th>
              <th style={cellH(120)}>KWOTA NETTO</th>
            </tr>
          </thead>
          <tbody>
            {e.rozliczenia.map((r) => (
              <tr key={r.id}>
                <td style={cell(true)}>{fmtDate(r.data)}</td>
                <td style={{ ...cell(), textAlign: 'left' }}>{r.numerZlecenia || ' '}</td>
                <td style={{ ...cell(), textAlign: 'left' }}>{r.nazwiskoKlienta || ' '}</td>
                <td style={{ ...cell(), textAlign: 'right' }}>{fmtPLN(r.kwotaNetto)}</td>
              </tr>
            ))}
            {e.rozliczenia.length === 0 && (
              <tr>
                <td style={cell()} colSpan={4}>
                  &nbsp;
                </td>
              </tr>
            )}
            <tr>
              <td style={{ ...cell(), textAlign: 'right', fontWeight: 700, background: '#f0ede6' }} colSpan={3}>
                SUMA ROZLICZEŃ NETTO:
              </td>
              <td style={{ ...cell(), textAlign: 'right', fontWeight: 700, background: '#f0ede6' }}>{fmtPLN(suma)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div style={{ ...box, marginTop: 10 }}>
        <div style={secHead}>4 · REALIZACJA ZOBOWIĄZANIA</div>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '8.5pt',
            color: '#4a463f',
            marginBottom: 4,
          }}
        >
          <span>
            Zrealizowano: <b style={{ color: '#12130f' }}>{fmtPLN(suma)}</b> z {fmtPLN(zobowiazanie)}
          </span>
          <span style={{ fontWeight: 700, color: '#0f5c3f' }}>{procent.toFixed(1)}%</span>
        </div>
        <div
          style={{
            height: 16,
            background: '#eceae3',
            borderRadius: 8,
            overflow: 'hidden',
            border: '1px solid #d3cfc2',
          }}
        >
          <div
            style={{
              width: `${procent}%`,
              height: '100%',
              background: '#0f5c3f',
              borderRadius: 8,
              transition: 'width.2s',
            }}
          />
        </div>
        <div style={{ fontSize: '8pt', color: '#6b6459', marginTop: 4 }}>
          Pasek przedstawia stopień realizacji zobowiązania liczony jako suma rozliczeń do {e.krotnosc || 0}-krotnej
          wartości ekspozycji netto.
        </div>
      </div>
    </DocSheet>
  )
}

function Row({ l, v, strong }: { l: string; v?: string; strong?: boolean }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 3, alignItems: 'baseline' }}>
      <span style={{ color: '#4a463f', fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{l}</span>
      <span
        style={{
          flex: 1,
          borderBottom: '1px dotted #b3ae9f',
          fontSize: '9pt',
          fontWeight: strong ? 700 : 500,
          textAlign: 'right',
          color: strong ? '#0f5c3f' : '#12130f',
          minHeight: '1.1em',
        }}
      >
        {v || ' '}
      </span>
    </div>
  )
}

const cellH = (w?: number): React.CSSProperties => ({
  border: '1px solid #d3cfc2',
  padding: '4px 6px',
  fontSize: '7.6pt',
  fontWeight: 700,
  textAlign: 'center',
  width: w,
})
const cell = (center?: boolean): React.CSSProperties => ({
  border: '1px solid #d3cfc2',
  padding: '4px 6px',
  textAlign: center ? 'center' : undefined,
})
