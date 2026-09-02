import { useState } from 'react'
import { Warehouse, Plus, Copy, ExternalLink, Pencil, Trash2, Link2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { PageHeader, Card, CardBody, Field, Input, Modal, useToast, useConfirm } from '../components/ui'
import { copyToClipboard } from '../lib/print'
import { uid } from '../lib/id'
import { nowISO } from '../lib/format'
import type { Hurtownia } from '../lib/types'

// Dopisuje https:// gdy uzytkownik wpisal sam adres bez schematu - dzieki temu
// skopiowany/otwarty link zawsze dziala po wklejeniu w przegladarce.
function pelnyLink(link?: string): string {
  const s = (link || '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  return 'https://' + s
}
// Ladny, krotki podglad adresu (bez https:// i koncowego /)
function ladnyLink(link?: string): string {
  return (link || '').trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
}

// ============================================================================
// Hurtownie: kafelki z nazwa hurtowni i linkiem do jej strony. Jednym kliknieciem
// kopiujesz link (albo otwierasz strone). Prosty katalog dostawcow materialow.
// ============================================================================
export default function Hurtownie() {
  const hurtownie = useStore((s) => s.baza.hurtownie)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [edycja, setEdycja] = useState<Hurtownia | null>(null)
  const [nowa, setNowa] = useState(false)

  const lista = hurtownie.slice().sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'))

  const kopiuj = async (h: Hurtownia) => {
    const link = pelnyLink(h.link)
    if (!link) return push('Ta hurtownia nie ma jeszcze linku', 'info')
    const ok = await copyToClipboard(link)
    push(ok ? `Skopiowano link: ${h.nazwa}` : 'Nie udało się skopiować', ok ? 'ok' : 'err')
  }

  const usun = async (h: Hurtownia) => {
    if (!(await confirm(`Usunąć hurtownię „${h.nazwa}"?`))) return
    remove('hurtownie', h.id)
    push('Usunięto hurtownię', 'info')
  }

  return (
    <div>
      {confirmNode}
      <PageHeader
        title="Hurtownie"
        subtitle="Szybki dostęp do stron hurtowni - kliknij, żeby skopiować link"
        icon={<Warehouse size={22} />}
        actions={
          <button className="btn-primary" onClick={() => setNowa(true)}>
            <Plus size={17} /> Dodaj hurtownię
          </button>
        }
      />

      {lista.length === 0 ? (
        <Card>
          <CardBody className="py-14 text-center">
            <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-700">
              <Warehouse size={22} />
            </div>
            <div className="text-[15px] font-semibold text-ink">Brak hurtowni</div>
            <p className="mx-auto mt-1 max-w-sm text-[13px] text-stone-500">
              Dodaj hurtownię: wpisz nazwę i link do jej strony. Potem jednym kliknięciem skopiujesz link.
            </p>
            <button className="btn-primary mt-4" onClick={() => setNowa(true)}>
              <Plus size={17} /> Dodaj pierwszą hurtownię
            </button>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {lista.map((h) => (
            <div key={h.id} className="card flex flex-col p-4">
              <div className="flex items-start gap-2.5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                  <Warehouse size={17} />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold text-ink">{h.nazwa}</div>
                  {h.link ? (
                    <div className="flex items-center gap-1 truncate text-[12px] text-stone-500">
                      <Link2 size={12} className="shrink-0" />
                      <span className="truncate">{ladnyLink(h.link)}</span>
                    </div>
                  ) : (
                    <div className="text-[12px] text-stone-400">brak linku</div>
                  )}
                </div>
                <div className="flex shrink-0 gap-0.5">
                  <button
                    className="grid h-7 w-7 place-items-center rounded-lg text-stone-400 hover:bg-black/[0.05] hover:text-ink"
                    onClick={() => setEdycja(h)}
                    title="Edytuj"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    className="grid h-7 w-7 place-items-center rounded-lg text-stone-400 hover:bg-black/[0.05] hover:text-red-600"
                    onClick={() => usun(h)}
                    title="Usuń"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2">
                <button className="btn-primary btn-sm flex-1" onClick={() => kopiuj(h)} disabled={!h.link}>
                  <Copy size={15} /> Kopiuj link
                </button>
                {h.link && (
                  <a
                    className="btn-outline btn-sm"
                    href={pelnyLink(h.link)}
                    target="_blank"
                    rel="noreferrer"
                    title="Otwórz stronę"
                  >
                    <ExternalLink size={15} /> Otwórz
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {(nowa || edycja) && (
        <HurtowniaModal
          hurtownia={edycja}
          onClose={() => {
            setNowa(false)
            setEdycja(null)
          }}
          onZapisz={(h) => {
            upsert('hurtownie', h)
            push(edycja ? 'Zapisano zmiany' : 'Dodano hurtownię', 'ok')
            setNowa(false)
            setEdycja(null)
          }}
        />
      )}
    </div>
  )
}

function HurtowniaModal({
  hurtownia,
  onClose,
  onZapisz,
}: {
  hurtownia: Hurtownia | null
  onClose: () => void
  onZapisz: (h: Hurtownia) => void
}) {
  const [nazwa, setNazwa] = useState(hurtownia?.nazwa || '')
  const [link, setLink] = useState(hurtownia?.link || '')

  const ok = nazwa.trim().length > 0
  const zapisz = () => {
    if (!ok) return
    onZapisz({
      id: hurtownia?.id || uid('hur'),
      nazwa: nazwa.trim(),
      link: link.trim() || undefined,
      utworzono: hurtownia?.utworzono || nowISO(),
    })
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={hurtownia ? 'Edytuj hurtownię' : 'Dodaj hurtownię'}
      size="sm"
      footer={
        <>
          <button className="btn-outline" onClick={onClose}>
            Anuluj
          </button>
          <button className="btn-primary" onClick={zapisz} disabled={!ok}>
            {hurtownia ? 'Zapisz' : 'Dodaj'}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <Field label="Nazwa hurtowni" required>
          <Input
            value={nazwa}
            onChange={(e) => setNazwa(e.target.value)}
            placeholder="np. Granity Sp. z o.o."
            autoFocus
            onKeyDown={(e) => e.key === 'Enter' && ok && zapisz()}
          />
        </Field>
        <Field label="Link do strony hurtowni" hint="Możesz wpisać sam adres, np. granity.pl">
          <Input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            placeholder="https://..."
            inputMode="url"
            onKeyDown={(e) => e.key === 'Enter' && zapisz()}
          />
        </Field>
      </div>
    </Modal>
  )
}
