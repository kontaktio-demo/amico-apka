import React from 'react'
import type { Firma } from '../lib/types'
import { AmicoWordmark } from '../components/Logo'
import { fmtKonto, fmtNIP } from '../lib/format'

// ============================================================================
// Papier firmowy A4 – wspolny szablon wszystkich dokumentow AMICO
// ============================================================================

export function DocSheet({
  firma,
  children,
  compact,
  logoDataUrl,
  bezStopki,
}: {
  firma: Firma
  children: React.ReactNode
  compact?: boolean
  logoDataUrl?: string
  bezStopki?: boolean
}) {
  return (
    <div className={`doc-sheet ${compact ? 'compact' : ''}`}>
      <DocLetterhead firma={firma} logoDataUrl={logoDataUrl} />
      <div className="mt-5">{children}</div>
      {!bezStopki && <DocFooter firma={firma} />}
    </div>
  )
}

export function DocLetterhead({ firma, logoDataUrl }: { firma: Firma; logoDataUrl?: string }) {
  return (
    <div>
      <div className="flex items-start justify-between gap-6">
        <div>
          {logoDataUrl ? (
            <img src={logoDataUrl} alt="AMICO" style={{ height: 40, objectFit: 'contain' }} />
          ) : (
            <div style={{ color: '#12130f' }}>
              <AmicoWordmark height={30} />
            </div>
          )}
          <div style={{ fontSize: '6.6pt', letterSpacing: '0.24em', textTransform: 'uppercase', color: '#6b6459', marginTop: 5 }}>
            Pracownia Kamieniarska
          </div>
        </div>
        <div style={{ textAlign: 'right', fontSize: '8pt', color: '#4a463f', lineHeight: 1.5 }}>
          <div style={{ fontWeight: 600, color: '#12130f' }}>{firma.nazwa}</div>
          <div>
            {firma.ulica}, {firma.kod} {firma.miasto}
          </div>
          <div>NIP: {fmtNIP(firma.nip)}</div>
          {firma.konto && <div>Konto: {fmtKonto(firma.konto)}</div>}
        </div>
      </div>
      <div style={{ height: 2, background: '#12130f', marginTop: 10 }} />
    </div>
  )
}

export function DocFooter({ firma }: { firma: Firma }) {
  return (
    <div style={{ marginTop: 24, borderTop: '1px solid #d8d4c8', paddingTop: 8, textAlign: 'center', fontSize: '7.6pt', color: '#8a8478' }}>
      {firma.marka} · {firma.ulica}, {firma.kod} {firma.miasto} · tel. {firma.telefon} · {firma.email}
      {firma.www ? ` · ${firma.www}` : ''}
    </div>
  )
}

// ---------- Tytul dokumentu ----------
export function DocTitle({ children, sub, numer }: { children: React.ReactNode; sub?: string; numer?: string }) {
  return (
    <div style={{ textAlign: 'center', margin: '10px 0 16px' }}>
      <h1 style={{ fontFamily: "'Fraunces Variable', Fraunces, serif", fontWeight: 600, fontSize: '16pt', letterSpacing: '0.02em', color: '#12130f', margin: 0 }}>
        {children}
      </h1>
      {sub && <div style={{ fontSize: '9pt', color: '#6b6459', marginTop: 2 }}>{sub}</div>}
      {numer && <div style={{ fontSize: '8.5pt', color: '#0f5c3f', fontWeight: 600, marginTop: 4 }}>{numer}</div>}
    </div>
  )
}

// ---------- Sekcja z numerkiem/naglowkiem ----------
export function DocSection({ n, title, children, style }: { n?: string | number; title: string; children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ marginTop: 12, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
        {n !== undefined && (
          <span style={{ background: '#0f5c3f', color: '#fff', fontSize: '8pt', fontWeight: 700, borderRadius: 6, padding: '2px 7px' }}>{n}</span>
        )}
        <span style={{ fontSize: '9.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#12130f' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

// ---------- Wiersz danych z podkresleniem ----------
export function DocLine({ label, value, width }: { label: string; value?: React.ReactNode; width?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginBottom: 4, width }}>
      <span style={{ color: '#4a463f', whiteSpace: 'nowrap', fontSize: '9pt' }}>{label}</span>
      <span style={{ flex: 1, borderBottom: '1px dotted #a9a496', minHeight: '1em', fontWeight: 500, color: '#12130f', fontSize: '9.5pt' }}>
        {value || ' '}
      </span>
    </div>
  )
}

// ---------- Blok podpisow ----------
export function DocSignatures({ left, right, labelLeft, labelRight }: { left?: React.ReactNode; right?: React.ReactNode; labelLeft: string; labelRight: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 40, marginTop: 34 }} className="avoid-break">
      <SigBlock node={left} label={labelLeft} />
      <SigBlock node={right} label={labelRight} />
    </div>
  )
}
function SigBlock({ node, label }: { node?: React.ReactNode; label: string }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ height: 56, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}>{node}</div>
      <div style={{ borderTop: '1px solid #12130f', paddingTop: 4, fontSize: '8pt', color: '#4a463f' }}>{label}</div>
    </div>
  )
}
