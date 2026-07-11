import type { RaportKasowy, Firma } from '../lib/types'
import { DocSheet } from './DocShell'
import { fmtPLN, fmtDate } from '../lib/format'
import { SignatureView } from '../components/SignaturePad'

// Odwzorowanie formularza "RAPORT KASOWY"
export function RaportKasowyDoc({ r, firma, logoDataUrl }: { r: RaportKasowy; firma: Firma; logoDataUrl?: string }) {
  const sumaPrzychod = r.wiersze.reduce((a, w) => a + (w.przychod || 0), 0)
  const sumaRozchod = r.wiersze.reduce((a, w) => a + (w.rozchod || 0), 0)
  const saldoKoncowe = (r.saldoPoczatkowe || 0) + sumaPrzychod - sumaRozchod

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 10 }}>
        <div
          style={{
            fontFamily: "'Fraunces Variable', serif",
            fontWeight: 600,
            fontSize: '17pt',
            color: '#12233a',
            letterSpacing: '0.06em',
          }}
        >
          RAPORT KASOWY
        </div>
        {r.numer && <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 700, marginTop: 3 }}>{r.numer}</div>}
      </div>

      {/* Okres + saldo poczatkowe */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          border: '1px solid #c9c4b6',
          borderRadius: 10,
          padding: '8px 12px',
          marginBottom: 10,
          fontSize: '9.5pt',
        }}
      >
        <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
          <span>
            <b style={{ color: '#4a463f' }}>OD:</b>{' '}
            <span style={{ fontWeight: 600, color: '#12130f' }}>{fmtDate(r.od) || '–'}</span>
          </span>
          <span>
            <b style={{ color: '#4a463f' }}>DO:</b>{' '}
            <span style={{ fontWeight: 600, color: '#12130f' }}>{fmtDate(r.do) || '–'}</span>
          </span>
        </div>
        <span>
          <b style={{ color: '#4a463f' }}>SALDO:</b>{' '}
          <span style={{ fontWeight: 700, color: '#12233a' }}>{fmtPLN(r.saldoPoczatkowe)}</span>
        </span>
      </div>

      {/* Tabela obrotow */}
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '9pt' }}>
        <thead>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <th style={{ ...th(), textAlign: 'left' }}>NAZWISKO</th>
            <th style={th(70)}>ZLEC.</th>
            <th style={{ ...th(), textAlign: 'left' }}>TREŚĆ</th>
            <th style={th(110)}>PRZYCHÓD</th>
            <th style={th(110)}>ROZCHÓD</th>
          </tr>
        </thead>
        <tbody>
          {r.wiersze.map((w) => (
            <tr key={w.id}>
              <td style={td()}>{w.nazwisko || ''}</td>
              <td style={{ ...td(), textAlign: 'center' }}>{w.zlec || ''}</td>
              <td style={td()}>{w.tresc || ''}</td>
              <td style={{ ...td(), textAlign: 'right' }}>{w.przychod ? fmtPLN(w.przychod) : ''}</td>
              <td style={{ ...td(), textAlign: 'right' }}>{w.rozchod ? fmtPLN(w.rozchod) : ''}</td>
            </tr>
          ))}
          {/* dopelnienie pustymi wierszami dla czytelnosci formularza */}
          {r.wiersze.length === 0 && (
            <tr>
              <td style={td()} colSpan={5}>
                &nbsp;
              </td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr style={{ background: '#f0ede6' }}>
            <td style={{ ...td(), fontWeight: 700, textAlign: 'right' }} colSpan={3}>
              OBROTY
            </td>
            <td style={{ ...td(), textAlign: 'right', fontWeight: 700 }}>{fmtPLN(sumaPrzychod)}</td>
            <td style={{ ...td(), textAlign: 'right', fontWeight: 700 }}>{fmtPLN(sumaRozchod)}</td>
          </tr>
          <tr style={{ background: '#12233a', color: '#fff' }}>
            <td style={{ ...td(), fontWeight: 700, textAlign: 'right', color: '#fff' }} colSpan={4}>
              SALDO
            </td>
            <td style={{ ...td(), textAlign: 'right', fontWeight: 700, color: '#fff' }}>{fmtPLN(saldoKoncowe)}</td>
          </tr>
        </tfoot>
      </table>
      <div style={{ fontSize: '7.6pt', color: '#8a8478', marginTop: 4 }}>
        SALDO = saldo początkowe {fmtPLN(r.saldoPoczatkowe)} + przychody {fmtPLN(sumaPrzychod)} − rozchody{' '}
        {fmtPLN(sumaRozchod)}
      </div>

      {/* Stopka: data + podpis */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40, marginTop: 34 }} className="avoid-break">
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div
            style={{
              height: 56,
              display: 'flex',
              alignItems: 'flex-end',
              justifyContent: 'center',
              fontSize: '10pt',
              color: '#12130f',
            }}
          >
            {fmtDate(r.data)}
          </div>
          <div style={{ borderTop: '1px solid #12130f', paddingTop: 4, fontSize: '8pt', color: '#4a463f' }}>DATA</div>
        </div>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <div style={{ height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            <SignatureView sig={r.podpis} />
          </div>
          <div style={{ borderTop: '1px solid #12130f', paddingTop: 4, fontSize: '8pt', color: '#4a463f' }}>PODPIS</div>
        </div>
      </div>
    </DocSheet>
  )
}

const th = (w?: number): React.CSSProperties => ({
  border: '1px solid #d3cfc2',
  padding: '5px 7px',
  fontSize: '7.8pt',
  fontWeight: 700,
  textAlign: 'center',
  letterSpacing: '0.04em',
  width: w,
})
const td = (): React.CSSProperties => ({ border: '1px solid #d3cfc2', padding: '4px 7px', verticalAlign: 'top' })
