import type { KP, Firma } from '../lib/types'
import { DocSheet } from './DocShell'
import { fmtPLN, fmtDate, kwotaSlownie } from '../lib/format'
import { SignatureView } from '../components/SignaturePad'

// Klasyczny druk KASA PRZYJMIE (KP) – kasowy dowód wpłaty.
export function KPDoc({ kp, firma, logoDataUrl }: { kp: KP; firma: Firma; logoDataUrl?: string }) {
  const slownie = (kp.slownie && kp.slownie.trim()) || kwotaSlownie(kp.kwota)
  const box: React.CSSProperties = { border: '1px solid #c9c4b6', borderRadius: 10, padding: '9px 12px' }
  const lab: React.CSSProperties = { color: '#4a463f', fontSize: '8.5pt', whiteSpace: 'nowrap' }
  const val: React.CSSProperties = { fontSize: '9.5pt', fontWeight: 500, color: '#12130f' }

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      {/* Nagłówek */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
        <div>
          <div style={{ fontFamily: "'Fraunces Variable', serif", fontWeight: 600, fontSize: '17pt', color: '#12233a', letterSpacing: '0.02em' }}>
            KASOWY DOWÓD WPŁATY
          </div>
          <div style={{ fontSize: '11pt', color: '#12233a', letterSpacing: '0.28em', fontWeight: 700, marginTop: 1 }}>KP</div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '9pt', color: '#12130f', lineHeight: 1.6 }}>
          <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 700 }}>{kp.numer}</div>
          <div>
            <span style={lab}>Data: </span>
            <b>{fmtDate(kp.data)}</b>
          </div>
          <div>
            <span style={lab}>Miejscowość: </span>
            <b>{firma.miasto || ' '}</b>
          </div>
        </div>
      </div>

      {/* Wystawca */}
      <div style={{ ...box, marginBottom: 10 }}>
        <div style={{ ...lab, fontWeight: 700, marginBottom: 3 }}>WYSTAWCA / KASA</div>
        <div style={val}>{firma.nazwa}</div>
        <div style={{ fontSize: '8.5pt', color: '#4a463f', marginTop: 1 }}>
          {firma.ulica}, {firma.kod} {firma.miasto} · NIP: {firma.nip}
        </div>
      </div>

      {/* Od kogo */}
      <div style={{ ...box, marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ ...lab, fontWeight: 700 }}>Od kogo (wpłacający):</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #a9a496', minHeight: '1.15em', ...val }}>{kp.odKogo || ' '}</span>
        </div>
      </div>

      {/* Kwota */}
      <div style={{ ...box, marginBottom: 10, background: '#f6f4ee' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <span style={{ ...lab, fontWeight: 700, fontSize: '9pt' }}>KWOTA (cyframi):</span>
          <span
            style={{
              fontFamily: "'Fraunces Variable', serif",
              fontSize: '18pt',
              fontWeight: 700,
              color: '#12233a',
              border: '1.5px solid #12233a',
              borderRadius: 8,
              padding: '3px 16px',
            }}
          >
            {fmtPLN(kp.kwota)}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
          <span style={{ ...lab, fontWeight: 700 }}>Słownie:</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #a9a496', minHeight: '1.15em', ...val, fontStyle: 'italic', textTransform: 'capitalize' }}>
            {slownie}
          </span>
        </div>
      </div>

      {/* Tytułem */}
      <div style={{ ...box, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ ...lab, fontWeight: 700 }}>Tytułem:</span>
          <span style={{ flex: 1, borderBottom: '1px dotted #a9a496', minHeight: '1.15em', ...val }}>{kp.tytul || ' '}</span>
        </div>
      </div>

      {/* Podpisy */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40, marginTop: 26 }} className="avoid-break">
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }} />
          <div style={{ borderTop: '1px solid #12130f', paddingTop: 4, fontSize: '8pt', color: '#4a463f' }}>Wpłacił</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ height: 70, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>
            {kp.podpisPrzyjmujacy && <SignatureView sig={kp.podpisPrzyjmujacy} label="Przyjął" />}
          </div>
          {!kp.podpisPrzyjmujacy && <div style={{ borderTop: '1px solid #12130f', paddingTop: 4, fontSize: '8pt', color: '#4a463f' }}>Przyjął</div>}
        </div>
      </div>

      {/* Egzemplarz */}
      <div style={{ marginTop: 16, fontSize: '7.6pt', color: '#8a8478', textAlign: 'center', letterSpacing: '0.04em' }}>
        Egzemplarz: <b style={{ color: '#4a463f' }}>Oryginał</b> / Kopia
      </div>
    </DocSheet>
  )
}
