import { useRef, useState } from 'react'
import { FolderDown, Upload, Download, Trash2, Eye, Loader2 } from 'lucide-react'
import { useStore } from '../lib/store'
import { Card, CardBody, useToast, useConfirm } from './ui'
import { useAuth } from './Auth'
import { wgrajDokument, dokumentPodpisanyUrl, usunDokumentZChmury } from '../lib/cloud'
import { uid } from '../lib/id'
import { nowISO } from '../lib/format'
import type { DokumentPliku } from '../lib/types'

function fmtRozmiar(b?: number) {
  if (!b) return ''
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

// ============================================================================
// Dokumenty do pobrania: wlascicielka/kierownik wgrywa pliki (do Supabase Storage)
// i zaznacza, ktore KONTA maja je widziec. Reszta widzi tylko udostepnione im pliki.
// ============================================================================
export function DokumentyDoPobrania() {
  const baza = useStore((s) => s.baza)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { user } = useAuth()
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [edytujId, setEdytujId] = useState<string | null>(null)

  const owner = user?.rola === 'wlasciciel' || user?.rola === 'kierownik'
  const konta = baza.uzytkownicy.filter((u) => u.aktywny !== false)

  const widoczny = (d: DokumentPliku) =>
    owner || d.widoczneDlaWszystkich || (user ? (d.widoczneDla || []).includes(user.id) : false)
  const lista = baza.dokumenty.filter(widoczny).slice().sort((a, c) => (c.utworzono || '').localeCompare(a.utworzono || ''))

  const onPlik = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const pliki = Array.from(e.target.files || [])
    e.target.value = ''
    if (!pliki.length) return
    setBusy(true)
    try {
      for (const plik of pliki) {
        const id = uid('dok')
        const { sciezka, typ, rozmiar } = await wgrajDokument(plik, id)
        upsert('dokumenty', {
          id,
          nazwa: plik.name,
          sciezka,
          typ,
          rozmiar,
          widoczneDlaWszystkich: true,
          widoczneDla: [],
          wgralId: user?.id,
          utworzono: nowISO(),
        } as DokumentPliku)
      }
      push(`Wgrano ${pliki.length} ${pliki.length === 1 ? 'plik' : 'pliki/-ów'}`, 'ok')
    } catch (err: any) {
      push(err?.message || 'Nie udało się wgrać pliku', 'err')
    } finally {
      setBusy(false)
    }
  }

  const pobierz = async (d: DokumentPliku) => {
    const url = await dokumentPodpisanyUrl(d.sciezka)
    if (url) window.open(url, '_blank')
    else push('Nie udało się pobrać pliku (sprawdź połączenie z chmurą).', 'err')
  }

  const usun = async (d: DokumentPliku) => {
    if (!(await confirm(`Usunąć dokument „${d.nazwa}"? Zniknie wszystkim.`))) return
    await usunDokumentZChmury(d.sciezka)
    remove('dokumenty', d.id)
    push('Usunięto dokument', 'info')
  }

  const setWidocznosc = (d: DokumentPliku, patch: Partial<DokumentPliku>) => upsert('dokumenty', { ...d, ...patch })
  const toggleKonto = (d: DokumentPliku, kid: string) =>
    setWidocznosc(d, {
      widoczneDla: d.widoczneDla.includes(kid) ? d.widoczneDla.filter((x) => x !== kid) : [...d.widoczneDla, kid],
    })
  const opisWidocznosci = (d: DokumentPliku) =>
    d.widoczneDlaWszystkich
      ? 'wszyscy'
      : d.widoczneDla
          .map((id) => konta.find((k) => k.id === id)?.imie.split(' ')[0])
          .filter(Boolean)
          .join(', ') || 'nikt'

  return (
    <Card className="mt-6">
      <CardBody>
        {confirmNode}
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="flex items-center gap-2 text-[15px] font-semibold text-ink">
            <FolderDown size={18} className="text-brand-700" /> Dokumenty do pobrania
          </h3>
          {owner && (
            <button className="btn-primary btn-sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />} Wgraj
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" multiple className="hidden" onChange={onPlik} />

        {lista.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-stone-400">
            {owner ? 'Brak dokumentów. Wgraj plik i wskaż, kto ma go widzieć.' : 'Brak dokumentów do pobrania.'}
          </p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {lista.map((d) => (
              <div key={d.id} className="py-2.5">
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-brand-50 text-brand-700">
                    <FolderDown size={16} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[14px] font-medium text-ink">{d.nazwa}</div>
                    <div className="text-[11.5px] text-stone-400">
                      {fmtRozmiar(d.rozmiar)}
                      {owner ? ` · widzą: ${opisWidocznosci(d)}` : ''}
                    </div>
                  </div>
                  <button className="btn-outline btn-sm" onClick={() => pobierz(d)}>
                    <Download size={14} /> Pobierz
                  </button>
                  {owner && (
                    <>
                      <button
                        className="btn-ghost btn-sm"
                        onClick={() => setEdytujId(edytujId === d.id ? null : d.id)}
                        title="Kto widzi"
                      >
                        <Eye size={14} />
                      </button>
                      <button className="btn-ghost btn-sm text-red-400" onClick={() => usun(d)} title="Usuń">
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </div>
                {owner && edytujId === d.id && (
                  <div className="mt-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <div className="mb-2 text-[12.5px] font-medium text-stone-600">Kto ma widzieć ten dokument?</div>
                    <label className="mb-2 flex items-center gap-2 text-[13px] text-ink">
                      <input
                        type="checkbox"
                        checked={d.widoczneDlaWszystkich}
                        onChange={(e) => setWidocznosc(d, { widoczneDlaWszystkich: e.target.checked })}
                      />
                      Wszyscy w firmie
                    </label>
                    {!d.widoczneDlaWszystkich && (
                      <div className="space-y-1.5">
                        {konta.map((k) => (
                          <label key={k.id} className="flex items-center gap-2 text-[13px] text-stone-600">
                            <input
                              type="checkbox"
                              checked={d.widoczneDla.includes(k.id)}
                              onChange={() => toggleKonto(d, k.id)}
                            />
                            {k.imie} <span className="text-[11px] text-stone-400">{k.email}</span>
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
