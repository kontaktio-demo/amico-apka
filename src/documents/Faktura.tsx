import type { Faktura, Firma } from '../lib/types'
import { DocSheet, DocSignatures } from './DocShell'
import { podsumuj, pozycjaNetto, round2, fmtPLN, fmtDate, fmtNIP, fmtKonto, kwotaSlownie } from '../lib/format'

// ============================================================================
// Faktura VAT / zaliczkowa / końcowa / proforma – wg art. 106e ustawy o VAT
// ============================================================================

const TYP_TYTUL: Record<Faktura['typ'], string> = {
  vat: 'Faktura VAT',
  zaliczkowa: 'Faktura zaliczkowa',
  koncowa: 'Faktura końcowa',
  proforma: 'Faktura Proforma',
}

const SPOSOB_TYTUL: Record<NonNullable<Faktura['sposobPlatnosci']>, string> = {
  przelew: 'Przelew',
  gotowka: 'Gotówka',
  karta: 'Karta',
}

export function FakturaDoc({ f, firma, logoDataUrl }: { f: Faktura; firma: Firma; logoDataUrl?: string }) {
  const sum = podsumuj(f.pozycje)
  const stawki = Object.keys(sum.wgStawek)
    .map((k) => ({ stawka: Number(k), ...sum.wgStawek[k] }))
    .sort((a, b) => a.stawka - b.stawka)
  const konto = f.konto || firma.konto || ''

  const box: React.CSSProperties = { border: '1px solid #c9c4b6', borderRadius: 10, padding: '9px 11px' }
  const boxHead: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    background: '#12233a',
    color: '#fff',
    fontSize: '8pt',
    fontWeight: 700,
    letterSpacing: '0.05em',
    borderRadius: 6,
    padding: '3px 9px',
    marginBottom: 6,
    textTransform: 'uppercase',
  }

  return (
    <DocSheet firma={firma} compact logoDataUrl={logoDataUrl}>
      <div style={{ textAlign: 'center', marginBottom: 12 }}>
        <div style={{ fontFamily: "'Fraunces Variable', serif", fontWeight: 600, fontSize: '17pt', color: '#12233a', letterSpacing: '0.03em' }}>
          {TYP_TYTUL[f.typ]}
        </div>
        {f.numer && <div style={{ fontSize: '9pt', color: '#0f5c3f', fontWeight: 700, marginTop: 3 }}>Nr {f.numer}</div>}
      </div>

      {/* Sprzedawca / Nabywca */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={box}>
          <div style={boxHead}>Sprzedawca</div>
          <div style={{ fontSize: '9.5pt', fontWeight: 600, color: '#12130f' }}>{firma.nazwa}</div>
          <div style={{ fontSize: '9pt', color: '#3a372f', lineHeight: 1.45 }}>
            <div>
              {firma.ulica}, {firma.kod} {firma.miasto}
            </div>
            <div>NIP: {fmtNIP(firma.nip)}</div>
            {konto && <div>Konto: {fmtKonto(konto)}</div>}
            {firma.bank && <div>{firma.bank}</div>}
          </div>
        </div>
        <div style={box}>
          <div style={boxHead}>Nabywca</div>
          <div style={{ fontSize: '9.5pt', fontWeight: 600, color: '#12130f' }}>{f.nabywcaNazwa || ' '}</div>
          <div style={{ fontSize: '9pt', color: '#3a372f', lineHeight: 1.45 }}>
            {f.nabywcaAdres && <div style={{ whiteSpace: 'pre-line' }}>{f.nabywcaAdres}</div>}
            {f.nabywcaNip && <div>NIP: {fmtNIP(f.nabywcaNip)}</div>}
          </div>
        </div>
      </div>

      {/* Daty i płatność */}
      <div style={{ ...box, marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 14px' }}>
        <Meta l="Data wystawienia" v={fmtDate(f.dataWystawienia)} />
        <Meta l="Data sprzedaży" v={fmtDate(f.dataSprzedazy) || fmtDate(f.dataWystawienia)} />
        <Meta l="Termin płatności" v={fmtDate(f.terminPlatnosci)} />
        <Meta l="Sposób płatności" v={f.sposobPlatnosci ? SPOSOB_TYTUL[f.sposobPlatnosci] : 'Przelew'} />
        <Meta l="Nr konta" v={konto ? fmtKonto(konto) : '—'} colSpan={2} />
      </div>

      {/* Pozycje */}
      <div style={{ marginTop: 10 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '8.5pt', fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr style={{ background: '#12233a', color: '#fff' }}>
              <th style={th(24)}>Lp.</th>
              <th style={{ ...th(), textAlign: 'left' }}>Nazwa towaru / usługi</th>
              <th style={th(58)}>Ilość</th>
              <th style={th(72)}>Cena netto</th>
              <th style={th(80)}>Wartość netto</th>
              <th style={th(38)}>VAT</th>
              <th style={th(72)}>Kwota VAT</th>
              <th style={th(82)}>Wartość brutto</th>
            </tr>
          </thead>
          <tbody>
            {f.pozycje.map((p, i) => {
              const netto = pozycjaNetto(p)
              const kwotaVat = round2(netto * (p.vat / 100))
              const brutto = round2(netto + kwotaVat)
              return (
                <tr key={p.id}>
                  <td style={td('center')}>{i + 1}</td>
                  <td style={td('left')}>{p.nazwa}</td>
                  <td style={td('center')}>
                    {p.ilosc} {p.jednostka}
                  </td>
                  <td style={td('right')}>{fmtPLN(p.cenaNetto, { symbol: false })}</td>
                  <td style={td('right')}>{fmtPLN(netto, { symbol: false })}</td>
                  <td style={td('center')}>{p.vat}%</td>
                  <td style={td('right')}>{fmtPLN(kwotaVat, { symbol: false })}</td>
                  <td style={td('right')}>{fmtPLN(brutto, { symbol: false })}</td>
                </tr>
              )
            })}
            {f.pozycje.length === 0 && (
              <tr>
                <td style={td('center')} colSpan={8}>
                  &nbsp;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Podsumowanie wg stawek */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: '8.5pt', fontVariantNumeric: 'tabular-nums', minWidth: 360 }}>
          <thead>
            <tr style={{ background: '#f0ede6' }}>
              <th style={{ ...thS(), textAlign: 'left' }}>Wg stawki</th>
              <th style={thS()}>Netto</th>
              <th style={thS()}>VAT</th>
              <th style={thS()}>Brutto</th>
            </tr>
          </thead>
          <tbody>
            {stawki.map((s) => (
              <tr key={s.stawka}>
                <td style={tdS('left')}>{s.stawka}%</td>
                <td style={tdS('right')}>{fmtPLN(round2(s.netto), { symbol: false })}</td>
                <td style={tdS('right')}>{fmtPLN(round2(s.vat), { symbol: false })}</td>
                <td style={tdS('right')}>{fmtPLN(round2(s.brutto), { symbol: false })}</td>
              </tr>
            ))}
            <tr style={{ background: '#12233a', color: '#fff' }}>
              <td style={{ ...tdS('left'), fontWeight: 700 }}>RAZEM</td>
              <td style={{ ...tdS('right'), fontWeight: 700 }}>{fmtPLN(sum.netto, { symbol: false })}</td>
              <td style={{ ...tdS('right'), fontWeight: 700 }}>{fmtPLN(sum.vat, { symbol: false })}</td>
              <td style={{ ...tdS('right'), fontWeight: 700 }}>{fmtPLN(sum.brutto, { symbol: false })}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Do zapłaty */}
      <div style={{ ...box, marginTop: 10, background: '#f7f5ef' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
          <span style={{ fontSize: '9.5pt', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#12233a' }}>Do zapłaty</span>
          <span style={{ fontSize: '13pt', fontWeight: 700, color: '#12233a', fontVariantNumeric: 'tabular-nums' }}>{fmtPLN(sum.brutto)}</span>
        </div>
        <div style={{ fontSize: '8.5pt', color: '#4a463f', marginTop: 3 }}>
          Słownie: <b>{kwotaSlownie(sum.brutto)}</b>
        </div>
        {f.splitPayment && (
          <div style={{ fontSize: '8pt', color: '#7a3b12', marginTop: 4, fontWeight: 600 }}>
            Mechanizm podzielonej płatności (split payment)
          </div>
        )}
      </div>

      {f.uwagi && (
        <div style={{ fontSize: '8.5pt', color: '#4a463f', marginTop: 8 }}>
          <b>Uwagi:</b> {f.uwagi}
        </div>
      )}

      <DocSignatures
        labelLeft="Osoba upoważniona do wystawienia faktury"
        labelRight="Osoba upoważniona do odbioru faktury"
      />
    </DocSheet>
  )
}

function Meta({ l, v, colSpan }: { l: string; v?: string; colSpan?: number }) {
  return (
    <div style={{ display: 'flex', gap: 5, alignItems: 'baseline', gridColumn: colSpan ? `span ${colSpan}` : undefined }}>
      <span style={{ color: '#6b6459', fontSize: '8pt', whiteSpace: 'nowrap' }}>{l}:</span>
      <span style={{ fontSize: '9pt', fontWeight: 600, color: '#12130f', fontVariantNumeric: 'tabular-nums' }}>{v || '—'}</span>
    </div>
  )
}

const th = (w?: number): React.CSSProperties => ({
  border: '1px solid #2c3d54',
  padding: '4px 6px',
  fontSize: '7.6pt',
  fontWeight: 700,
  textAlign: 'center',
  width: w,
})
const td = (align: 'left' | 'right' | 'center'): React.CSSProperties => ({
  border: '1px solid #d3cfc2',
  padding: '4px 6px',
  textAlign: align,
})
const thS = (): React.CSSProperties => ({ border: '1px solid #d3cfc2', padding: '3px 8px', fontSize: '7.6pt', fontWeight: 700, textAlign: 'right' })
const tdS = (align: 'left' | 'right'): React.CSSProperties => ({ border: '1px solid #d3cfc2', padding: '3px 8px', textAlign: align, minWidth: 70 })
