import type { Wycena, Firma } from '../lib/types'
import { DocSheet } from './DocShell'
import { podsumuj, fmtPLN, fmtDate, pozycjaNetto } from '../lib/format'
import { SignatureView } from '../components/SignaturePad'

// Odwzorowanie formularza "WSTĘPNA WYCENA PRAC KAMIENIARSKICH"
export function WycenaDoc({
  w,
  firma,
  uwagi,
  logoDataUrl,
}: {
  w: Wycena
  firma: Firma
  uwagi: string[]
  logoDataUrl?: string
}) {
  const sum = podsumuj(w.pozycje)
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
            letterSpacing: '0.03em',
          }}
        >
          WSTĘPNA WYCENA
        </div>
        <div style={{ fontSize: '11pt', color: '#12233a', letterSpacing: '0.12em', fontWeight: 600 }}>
          PRAC KAMIENIARSKICH
        </div>
        {w.numer && <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 700, marginTop: 3 }}>{w.numer}</div>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={box}>
          <div style={secHead}>1 · DANE KLIENTA</div>
          <Row l="Klient:" v={w.klientNazwa} />
          <Row l="Adres:" v={w.klientAdres} />
          <Row l="Telefon:" v={w.klientTelefon} />
          <Row l="E-mail:" v={w.klientEmail} />
        </div>
        <div style={box}>
          <div style={secHead}>2 · MIEJSCE REALIZACJI</div>
          <Row l="Adres:" v={w.miejsceAdres} />
          <Row l="Piętro / lokal:" v={w.miejscePietro} />
          <Row l="Uwagi:" v={w.miejsceUwagi} />
        </div>
      </div>

      <div style={{ ...box, marginTop: 10 }}>
        <div style={secHead}>3 · ZAKRES PRAC I NAZWA MATERIAŁU</div>
        <div style={{ minHeight: 26, fontSize: '9.5pt', color: '#12130f' }}>
          {[w.zakresPrac, w.nazwaMaterialu].filter(Boolean).join(' – ') || ' '}
        </div>
      </div>

      <div style={{ ...box, marginTop: 10 }}>
        <div style={secHead}>4 · ZESTAWIENIE ELEMENTÓW I PRAC</div>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
          <thead>
            <tr style={{ background: '#f0ede6' }}>
              <th style={cellH(28)}>LP.</th>
              <th style={{ ...cellH(), textAlign: 'left' }}>ELEMENT / OPIS</th>
              <th style={cellH(70)}>JEDN.</th>
              <th style={cellH(120)}>WARTOŚĆ NETTO</th>
            </tr>
          </thead>
          <tbody>
            {w.pozycje.map((p, i) => (
              <tr key={p.id}>
                <td style={cell(true)}>{i + 1}.</td>
                <td style={{ ...cell(), textAlign: 'left' }}>{p.nazwa}</td>
                <td style={cell(true)}>
                  {p.ilosc} {p.jednostka}
                </td>
                <td style={{ ...cell(), textAlign: 'right' }}>{fmtPLN(pozycjaNetto(p))}</td>
              </tr>
            ))}
            {w.pozycje.length === 0 && (
              <tr>
                <td style={cell()} colSpan={4}>
                  &nbsp;
                </td>
              </tr>
            )}
          </tbody>
        </table>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
          <table style={{ fontSize: '9.5pt', borderCollapse: 'collapse', minWidth: 240 }}>
            <tbody>
              <SumRow l="RAZEM NETTO:" v={fmtPLN(sum.netto)} />
              <SumRow l={`PODATEK VAT:`} v={fmtPLN(sum.vat)} />
              <SumRow l="RAZEM BRUTTO:" v={fmtPLN(sum.brutto)} bold />
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: '8pt', color: '#6b6459', marginTop: 4 }}>
          Do podanych cen należy doliczyć podatek VAT 8% lub 23%. Umowa na osobę fizyczną:{' '}
          <b>{w.osobaFizyczna ? 'TAK' : 'NIE'}</b>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div style={box}>
          <div style={secHead}>5 · WARUNKI WYCENY</div>
          <Row l="Warunki płatności:" v={w.warunkiPlatnosci} />
          <Row l="Zaliczka:" v={w.zaliczka} />
          <Row l="Dopłata:" v={w.doplata} />
          <Row l="Ważność wyceny:" v={fmtDate(w.waznosc)} />
          <Row l="Uwagi:" v={w.uwagi} />
          <div style={{ fontSize: '8pt', color: '#6b6459', marginTop: 4 }}>
            Wycena będzie skorygowana po obmiarze z natury.
          </div>
        </div>
        <div style={box}>
          <div style={secHead}>6 · DODATKOWE INFORMACJE</div>
          <ul style={{ margin: 0, paddingLeft: 14, fontSize: '8pt', color: '#3a372f', lineHeight: 1.45 }}>
            {uwagi.map((u, i) => (
              <li key={i} style={{ marginBottom: 2 }}>
                {u}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <div style={box}>
          <div style={secHead}>7 · PRZYGOTOWANIE POD MONTAŻ (Klient)</div>
          <Check v={w.przygBlaty}>Blaty / podłoża równe i wypoziomowane</Check>
          <Check v={w.przygWodaPrad}>Dostęp do wody i prądu</Check>
          <Check v={w.przygDojazd}>Swobodny dojazd i wniesienie materiału</Check>
          {w.przygInne && <Check v>Inne: {w.przygInne}</Check>}
        </div>
        <div style={box}>
          <div style={secHead}>8 · PODPIS I AKCEPTACJA</div>
          <div style={{ display: 'flex', gap: 16, marginTop: 6 }}>
            <div style={{ flex: 1 }}>
              <SignatureView sig={w.podpisKlienta} label="Podpis Klienta" />
            </div>
            <div style={{ flex: 1 }}>
              <SignatureView sig={w.podpisFirmy} label="Podpis / pieczęć firmy" />
            </div>
          </div>
        </div>
      </div>
    </DocSheet>
  )
}

function Row({ l, v }: { l: string; v?: string }) {
  return (
    <div style={{ display: 'flex', gap: 5, marginBottom: 3, alignItems: 'baseline' }}>
      <span style={{ color: '#4a463f', fontSize: '8.5pt', whiteSpace: 'nowrap' }}>{l}</span>
      <span
        style={{ flex: 1, borderBottom: '1px dotted #b3ae9f', fontSize: '9pt', fontWeight: 500, minHeight: '1.1em' }}
      >
        {v || ' '}
      </span>
    </div>
  )
}
function Check({ v, children }: { v?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: '8.5pt', marginBottom: 2 }}>
      <span
        style={{
          width: 11,
          height: 11,
          border: '1px solid #12233a',
          borderRadius: 2,
          display: 'inline-grid',
          placeItems: 'center',
          fontSize: '8pt',
          lineHeight: 1,
        }}
      >
        {v ? '✓' : ''}
      </span>
      {children}
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
function SumRow({ l, v, bold }: { l: string; v: string; bold?: boolean }) {
  return (
    <tr>
      <td
        style={{
          padding: '3px 8px',
          textAlign: 'right',
          color: '#4a463f',
          fontWeight: bold ? 700 : 400,
          background: bold ? '#12233a' : '#f0ede6',
          border: '1px solid #d3cfc2',
          ...(bold ? { color: '#fff' } : {}),
        }}
      >
        {l}
      </td>
      <td
        style={{
          padding: '3px 8px',
          textAlign: 'right',
          fontWeight: 700,
          border: '1px solid #d3cfc2',
          minWidth: 90,
          ...(bold ? { background: '#12233a', color: '#fff' } : {}),
        }}
      >
        {v}
      </td>
    </tr>
  )
}
