import type { Protokol, Firma } from '../lib/types'
import { DocSheet, DocTitle, DocSection, DocLine } from './DocShell'
import { fmtDate } from '../lib/format'
import { SignatureView } from '../components/SignaturePad'

// Odwzorowanie formularza "PROTOKÓŁ ODBIORU"
export function ProtokolDoc({ p, firma, logoDataUrl }: { p: Protokol; firma: Firma; logoDataUrl?: string }) {
  const klauzule = [
    'Odbiór zamówienia musi być potwierdzony pisemnie. Złożony podpis jest traktowany jako potwierdzenie zgodności dostawy ze złożonym zamówieniem.',
    'Pisemne potwierdzenie odbioru towarów przenosi na Klienta wszelkie ryzyka związane z posiadaniem i użytkowaniem, a w szczególności ryzyko utraty lub uszkodzenia.',
    'Podczas odbioru Klient jest zobowiązany do Kontroli zgodności z zamówieniem oraz Kontroli czy towary nie posiadają uszkodzeń mechanicznych. Kontroli tej Klient jest zobowiązany dokonać w obecności osoby dostarczającej zamówienie.',
  ]

  return (
    <DocSheet firma={firma} logoDataUrl={logoDataUrl}>
      <DocTitle numer={p.numer}>PROTOKÓŁ ODBIORU</DocTitle>

      <DocSection title="Dane klienta">
        <DocLine label="KLIENT:" value={p.klientNazwa} />
        <DocLine label="ADRES:" value={p.klientAdres} />
        <DocLine label="TELEFON:" value={p.klientTelefon} />
        <DocLine label="DOTYCZY ZAMÓWIENIA NR:" value={p.numerZamowienia} />
        <DocLine label="DATA:" value={p.data ? fmtDate(p.data) : ''} />
      </DocSection>

      <DocSection title="Potwierdzenie odbioru">
        <div style={{ fontSize: '9pt', color: '#12130f', marginBottom: 6 }}>Potwierdzam odbiór elementów kamiennych:</div>
        <div
          style={{
            minHeight: 54,
            border: '1px solid #d3cfc2',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: '9.5pt',
            color: '#12130f',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {p.odebraneElementy || ' '}
        </div>
        <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-start' }}>
          <div style={{ width: 260 }}>
            <SignatureView sig={p.podpisKlienta} label="Czytelny podpis" />
          </div>
        </div>
      </DocSection>

      <DocSection title="Uwagi">
        <div
          style={{
            minHeight: 70,
            border: '1px solid #d3cfc2',
            borderRadius: 8,
            padding: '8px 10px',
            fontSize: '9.5pt',
            color: '#12130f',
            whiteSpace: 'pre-wrap',
            lineHeight: 1.5,
          }}
        >
          {p.uwagi || ' '}
        </div>
      </DocSection>

      <div style={{ marginTop: 18, fontSize: '8pt', color: '#4a463f', lineHeight: 1.5 }}>
        {klauzule.map((k, i) => (
          <p key={i} style={{ margin: '0 0 6px', textAlign: 'justify' }}>
            {k}
          </p>
        ))}
      </div>
    </DocSheet>
  )
}
