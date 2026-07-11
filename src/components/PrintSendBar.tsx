import React, { useState, useRef, useEffect } from 'react'
import { Printer, Send, Mail, MessageSquare, Copy, Share2, ChevronDown, FileDown } from 'lucide-react'
import { usePrint, shareContent, mailtoLink, smsLink, copyToClipboard, safeFilename } from '../lib/print'
import { czyDesktop } from '../lib/desktop'
import { useToast } from './ui'

export interface ShareData {
  title: string
  text: string
  to?: string // email
  phone?: string // telefon do sms
  url?: string
}

// Uniwersalny pasek akcji: DRUKUJ / ZAPISZ PDF + WYSLIJ – obecny na kazdym dokumencie.
export function PrintSendBar({
  getPrintNode,
  share,
  extra,
  size = 'md',
  labelPrint = 'Drukuj / PDF',
}: {
  getPrintNode: () => React.ReactNode
  share?: ShareData
  extra?: React.ReactNode
  size?: 'sm' | 'md'
  labelPrint?: string
}) {
  const { print, zapiszPdf } = usePrint()
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [zapisuje, setZapisuje] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const btn = size === 'sm' ? 'btn-sm' : ''
  const desktop = czyDesktop()

  // Na desktopie zapisujemy PDF jednym klikiem, bez okna drukowania.
  const doZapisuPdf = async () => {
    if (zapisuje) return
    setZapisuje(true)
    try {
      const nazwa = safeFilename(share?.title || 'dokument')
      const r: any = await zapiszPdf(getPrintNode(), nazwa)
      if (r?.ok) push('Zapisano PDF', 'ok')
      else if (r && !r.anulowane) push('Nie udało się zapisać PDF', 'err')
    } finally {
      setZapisuje(false)
    }
  }

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const doWebShare = async () => {
    if (!share) return
    const r = await shareContent({ title: share.title, text: share.text, url: share.url })
    if (r === 'unsupported') push('Udostępnianie niedostępne na tym urządzeniu – użyj e-mail / SMS', 'info')
    else if (r === 'error') push('Nie udało się udostępnić', 'err')
    setOpen(false)
  }

  return (
    <div className="flex items-center gap-2 no-print">
      {extra}
      {desktop && (
        <button className={`btn-outline ${btn}`} onClick={doZapisuPdf} disabled={zapisuje}>
          <FileDown size={size === 'sm' ? 15 : 17} /> {zapisuje ? 'Zapisywanie…' : 'Zapisz PDF'}
        </button>
      )}
      <button className={`btn-outline ${btn}`} onClick={() => print(getPrintNode())}>
        <Printer size={size === 'sm' ? 15 : 17} /> {desktop ? 'Drukuj' : labelPrint}
      </button>
      {share && (
        <div className="relative" ref={ref}>
          <button className={`btn-primary ${btn}`} onClick={() => setOpen((o) => !o)}>
            <Send size={size === 'sm' ? 15 : 17} /> Wyślij <ChevronDown size={14} className="opacity-70" />
          </button>
          {open && (
            <div className="absolute right-0 z-30 mt-1.5 w-60 animate-scale-in overflow-hidden rounded-2xl border border-white/10 bg-[#14161f] p-1.5 shadow-pop">
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <MenuItem icon={<Share2 size={16} />} onClick={doWebShare}>
                  Udostępnij (system)
                </MenuItem>
              )}
              <MenuItem
                icon={<Mail size={16} />}
                onClick={() => {
                  window.location.href = mailtoLink({ to: share.to, subject: share.title, body: share.text })
                  setOpen(false)
                }}
              >
                E-mail{share.to ? ` → ${share.to}` : ''}
              </MenuItem>
              {share.phone && (
                <MenuItem
                  icon={<MessageSquare size={16} />}
                  onClick={() => {
                    window.location.href = smsLink(share.phone!, share.text)
                    setOpen(false)
                  }}
                >
                  SMS → {share.phone}
                </MenuItem>
              )}
              <MenuItem
                icon={<Copy size={16} />}
                onClick={async () => {
                  const ok = await copyToClipboard(`${share.title}\n\n${share.text}`)
                  push(ok ? 'Skopiowano do schowka' : 'Nie udało się skopiować', ok ? 'ok' : 'err')
                  setOpen(false)
                }}
              >
                Kopiuj treść
              </MenuItem>
              <div className="my-1 border-t border-stone-100" />
              <p className="px-3 py-1 text-[11px] leading-tight text-stone-400">
                {desktop
                  ? 'Aby wysłać PDF w załączniku: kliknij „Zapisz PDF”, a potem dołącz zapisany plik do wiadomości.'
                  : 'Aby wysłać PDF w załączniku: kliknij „Drukuj / PDF”, zapisz jako PDF i dołącz do wiadomości.'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MenuItem({
  icon,
  children,
  onClick,
}: {
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-medium text-stone-700 transition hover:bg-stone-100"
    >
      <span className="text-stone-400">{icon}</span>
      {children}
    </button>
  )
}
