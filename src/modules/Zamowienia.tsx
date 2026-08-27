import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PackagePlus, Mail, Copy, Trash2, Send, Warehouse } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, CardBody, SectionCard, Field, Input, Textarea, Select, useToast, useConfirm } from '../components/ui'
import { mailtoLink, copyToClipboard } from '../lib/print'
import { uid } from '../lib/id'
import { nowISO } from '../lib/format'
import type { ZamowienieTowaru, Firma } from '../lib/types'

function fmtData(iso?: string): string {
  if (!iso) return ''
  // utworzono to znacznik UTC (toISOString) - formatujemy wg czasu LOKALNEGO, inaczej
  // tuz po polnocy data "cofa sie" o jeden dzien (np. 26.08 pokazywalo 25.08).
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`
}

// Temat i tresc wiadomosci e-mail z zamowieniem - gotowe do wyslania z telefonu.
function tematZamowienia(z: ZamowienieTowaru): string {
  return `Zamówienie towaru${z.hurtowniaNazwa ? ' — ' + z.hurtowniaNazwa : ''}`
}
function trescZamowienia(z: ZamowienieTowaru, firma?: Firma): string {
  const linie: string[] = ['Dzień dobry,', '', 'Proszę o realizację zamówienia:', '']
  if (z.hurtowniaNazwa) linie.push(`Hurtownia: ${z.hurtowniaNazwa}`)
  linie.push(`Rodzaj towaru: ${z.rodzajTowaru || '-'}`)
  if (z.notatka?.trim()) linie.push(`Uwagi: ${z.notatka.trim()}`)
  linie.push('')
  linie.push('Pozdrawiam,')
  if (firma) {
    linie.push(firma.nazwa)
    if (firma.telefon) linie.push(`tel. ${firma.telefon}`)
    if (firma.email) linie.push(firma.email)
  }
  return linie.join('\n')
}

// ============================================================================
// Zamowienia towaru: prosty formularz (hurtownia + e-mail + rodzaj towaru + notatka).
// Zapisujesz zamowienie i wysylasz je e-mailem jednym kliknieciem (Mail na iPhone).
// ============================================================================
export default function Zamowienia() {
  const hurtownie = useStore((s) => s.baza.hurtownie)
  const zamowienia = useStore((s) => s.baza.zamowieniaTowaru)
  const aktywnaFirma = useStore((s) => s.aktywnaFirma)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [hurtowniaId, setHurtowniaId] = useState('')
  const [email, setEmail] = useState('')
  const [rodzaj, setRodzaj] = useState('')
  const [notatka, setNotatka] = useState('')

  const firma = aktywnaFirma()
  const lista = zamowienia.slice().sort((a, b) => b.utworzono.localeCompare(a.utworzono))
  const czysto = () => {
    setHurtowniaId('')
    setEmail('')
    setRodzaj('')
    setNotatka('')
  }
  const mozna = email.trim().length > 0 || rodzaj.trim().length > 0 || hurtowniaId.length > 0

  const zbuduj = (): ZamowienieTowaru => {
    const h = hurtownie.find((x) => x.id === hurtowniaId)
    return {
      id: uid('zam'),
      hurtowniaId: h?.id,
      hurtowniaNazwa: h?.nazwa,
      email: email.trim() || undefined,
      rodzajTowaru: rodzaj.trim() || undefined,
      notatka: notatka.trim() || undefined,
      utworzono: nowISO(),
    }
  }

  const zapisz = (): ZamowienieTowaru | null => {
    if (!mozna) {
      push('Uzupełnij choć rodzaj towaru lub hurtownię', 'info')
      return null
    }
    const z = zbuduj()
    upsert('zamowieniaTowaru', z)
    czysto()
    push('Zapisano zamówienie', 'ok')
    return z
  }

  const wyslijMailem = (z: ZamowienieTowaru) => {
    window.location.href = mailtoLink({ to: z.email, subject: tematZamowienia(z), body: trescZamowienia(z, firma) })
  }

  const kopiuj = async (z: ZamowienieTowaru) => {
    const ok = await copyToClipboard(`${tematZamowienia(z)}\n\n${trescZamowienia(z, firma)}`)
    push(ok ? 'Skopiowano treść zamówienia' : 'Nie udało się skopiować', ok ? 'ok' : 'err')
  }

  return (
    <div>
      {confirmNode}
      <PageHeader
        title="Zamówienia towarów"
        subtitle="Wpisz co i skąd zamawiasz - wyślij e-mailem jednym kliknięciem"
        icon={<PackagePlus size={22} />}
      />

      <SectionCard title="Nowe zamówienie" icon={<PackagePlus size={16} />} className="mb-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Hurtownia">
            {hurtownie.length === 0 ? (
              <div className="rounded-lg border border-dashed border-white/10 px-3 py-2.5 text-[12.5px] text-stone-500">
                Brak hurtowni.{' '}
                <Link to="/hurtownie" className="font-medium text-brand-700 hover:underline">
                  Dodaj hurtownię
                </Link>
              </div>
            ) : (
              <Select value={hurtowniaId} onChange={(e) => setHurtowniaId(e.target.value)}>
                <option value="">- wybierz hurtownię -</option>
                {hurtownie
                  .slice()
                  .sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))
                  .map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.nazwa}
                    </option>
                  ))}
              </Select>
            )}
          </Field>
          <Field label="Adres e-mail (dokąd wysłać)">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="zamowienia@hurtownia.pl"
              type="email"
              inputMode="email"
            />
          </Field>
          <Field label="Rodzaj towaru" className="sm:col-span-2">
            <Input
              value={rodzaj}
              onChange={(e) => setRodzaj(e.target.value)}
              placeholder="np. Granit Nero Assoluto, płyty 3 cm - 5 szt."
            />
          </Field>
          <Field label="Notatka" className="sm:col-span-2">
            <Textarea
              value={notatka}
              onChange={(e) => setNotatka(e.target.value)}
              placeholder="Dodatkowe uwagi, wymiary, termin..."
            />
          </Field>
        </div>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button className="btn-outline" onClick={() => zapisz()} disabled={!mozna}>
            Zapisz
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              const z = zapisz()
              if (z) wyslijMailem(z)
            }}
            disabled={!mozna || !email.trim()}
            title={!email.trim() ? 'Podaj adres e-mail, żeby wysłać' : undefined}
          >
            <Send size={16} /> Zapisz i wyślij e-mailem
          </button>
        </div>
      </SectionCard>

      {lista.length === 0 ? (
        <Card>
          <CardBody className="py-12 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Warehouse size={22} />
            </div>
            <div className="text-[15px] font-semibold text-ink">Brak zamówień</div>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-stone-500">
              Wypełnij formularz powyżej, żeby zapisać i wysłać pierwsze zamówienie.
            </p>
          </CardBody>
        </Card>
      ) : (
        <Card>
          <CardBody>
            <h3 className="mb-3 text-[15px] font-semibold text-ink">Historia zamówień</h3>
            <div className="divide-y divide-white/[0.06]">
              {lista.map((z) => (
                <div key={z.id} className="py-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-[14px] font-medium text-ink">
                        <Warehouse size={15} className="shrink-0 text-brand-700" />
                        {z.hurtowniaNazwa || 'Bez hurtowni'}
                        <span className="text-[11.5px] font-normal text-stone-400">· {fmtData(z.utworzono)}</span>
                      </div>
                      <div className="mt-1 text-[13px] text-stone-600">{z.rodzajTowaru || '-'}</div>
                      {z.notatka && <div className="mt-0.5 text-[12.5px] text-stone-500">Uwagi: {z.notatka}</div>}
                      {z.email && (
                        <div className="mt-0.5 flex items-center gap-1 text-[12px] text-stone-400">
                          <Mail size={12} /> {z.email}
                        </div>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      {z.email && (
                        <button className="btn-primary btn-sm" onClick={() => wyslijMailem(z)}>
                          <Mail size={14} /> Wyślij e-mailem
                        </button>
                      )}
                      <button className="btn-outline btn-sm" onClick={() => kopiuj(z)}>
                        <Copy size={14} /> Kopiuj
                      </button>
                      <button
                        className="btn-ghost btn-sm text-red-400"
                        onClick={async () => {
                          if (await confirm('Usunąć to zamówienie z historii?')) {
                            remove('zamowieniaTowaru', z.id)
                            push('Usunięto zamówienie', 'info')
                          }
                        }}
                        title="Usuń"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  )
}
