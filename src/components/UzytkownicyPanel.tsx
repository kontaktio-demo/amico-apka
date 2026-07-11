import { useEffect, useState } from 'react'
import { UserCog, Users2, Fingerprint, KeyRound, Trash2, Plus, Check, ShieldCheck } from 'lucide-react'
import { SectionCard, Field, Input, Select, Toggle, Badge, useToast, useConfirm } from './ui'
import { useStore } from '../lib/store'
import { useAuth } from './Auth'
import { ROLE, nazwaRoli, hashHasla, hashPin, losowaSol, biometriaDostepna, zarejestrujBiometrie } from '../lib/auth'
import { zmienRoleWChmurze } from '../lib/cloud'
import type { Uzytkownik, Rola } from '../lib/types'
import { uid } from '../lib/id'
import { nowISO, initials } from '../lib/format'

const KOLORY = ['#3a4a7a', '#2f6f57', '#7a4a3a', '#5a3a7a', '#7a6a2f', '#2f6a7a']

export function UzytkownicyPanel() {
  const { user } = useAuth()
  const uzytkownicy = useStore((s) => s.baza.uzytkownicy)
  const upsert = useStore((s) => s.upsert)
  const remove = useStore((s) => s.remove)
  const { push } = useToast()
  const { confirm, confirmNode } = useConfirm()

  const [pin, setPin] = useState('')
  const [bioMozliwa, setBioMozliwa] = useState(false)
  const [noweHaslo, setNoweHaslo] = useState('')

  useEffect(() => {
    biometriaDostepna().then(setBioMozliwa)
  }, [])

  const czyAdmin = user?.rola === 'wlasciciel' || user?.rola === 'kierownik'

  // --- moje konto ---
  async function zapiszPin() {
    if (!user) return
    if (!/^\d{4}$/.test(pin)) return push('PIN to 4 cyfry', 'err')
    const sol = losowaSol()
    upsert('uzytkownicy', { ...user, pinHash: await hashPin(pin, sol), pinSalt: sol })
    setPin('')
    push('PIN ustawiony – możesz odblokowywać aplikację PIN-em')
  }
  function usunPin() {
    if (!user) return
    upsert('uzytkownicy', { ...user, pinHash: undefined, pinSalt: undefined })
    push('PIN usunięty', 'info')
  }
  async function wlaczBiometrie() {
    if (!user) return
    const id = await zarejestrujBiometrie(user.id, user.imie, user.email)
    if (id) {
      upsert('uzytkownicy', { ...user, webauthnId: id })
      push('Biometria włączona na tym urządzeniu')
    } else {
      push('Nie udało się włączyć biometrii', 'err')
    }
  }
  function wylaczBiometrie() {
    if (!user) return
    upsert('uzytkownicy', { ...user, webauthnId: undefined })
    push('Biometria wyłączona', 'info')
  }
  async function zmienHaslo() {
    if (!user) return
    if (noweHaslo.length < 4) return push('Hasło min. 4 znaki', 'err')
    const sol = losowaSol()
    upsert('uzytkownicy', { ...user, salt: sol, hasloHash: await hashHasla(noweHaslo, sol) })
    setNoweHaslo('')
    push('Hasło zmienione')
  }

  return (
    <>
      {/* Twoje konto i zabezpieczenia */}
      <SectionCard
        title="Twoje konto i zabezpieczenia"
        icon={<UserCog size={18} />}
        desc="Szybkie odblokowanie aplikacji na tym urządzeniu – jak w telefonie."
      >
        {user && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="grid h-11 w-11 place-items-center rounded-xl text-[14px] font-semibold text-white"
                style={{ background: user.kolor || '#3a4a7a' }}
              >
                {initials(user.imie)}
              </span>
              <div>
                <div className="text-[15px] font-semibold text-ink">{user.imie}</div>
                <div className="text-[12.5px] text-stone-500">
                  {user.email} · {nazwaRoli(user.rola)}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {/* PIN */}
              <div className="rounded-xl border border-white/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                  <KeyRound size={16} className="text-brand-700" /> Kod PIN
                  {user.pinHash && <Badge tone="green">Ustawiony</Badge>}
                </div>
                <div className="flex gap-2">
                  <Input
                    inputMode="numeric"
                    maxLength={4}
                    placeholder="4 cyfry"
                    value={pin}
                    onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  />
                  <button className="btn-primary shrink-0" onClick={zapiszPin}>
                    Zapisz
                  </button>
                </div>
                {user.pinHash && (
                  <button className="btn-ghost mt-2 text-red-400" onClick={usunPin}>
                    Usuń PIN
                  </button>
                )}
              </div>

              {/* Biometria */}
              <div className="rounded-xl border border-white/10 p-4">
                <div className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold text-ink">
                  <Fingerprint size={16} className="text-brand-700" /> Biometria / Face ID
                  {user.webauthnId && <Badge tone="green">Włączona</Badge>}
                </div>
                {bioMozliwa ? (
                  user.webauthnId ? (
                    <button className="btn-outline" onClick={wylaczBiometrie}>
                      Wyłącz na tym urządzeniu
                    </button>
                  ) : (
                    <button className="btn-primary" onClick={wlaczBiometrie}>
                      <Fingerprint size={16} /> Włącz odblokowanie
                    </button>
                  )
                ) : (
                  <p className="text-[12.5px] text-stone-400">To urządzenie nie udostępnia biometrii w przeglądarce.</p>
                )}
              </div>
            </div>

            {/* Zmiana hasla */}
            <div className="flex flex-wrap items-end gap-2">
              <Field label="Zmień hasło" className="flex-1">
                <Input
                  type="password"
                  placeholder="Nowe hasło"
                  value={noweHaslo}
                  onChange={(e) => setNoweHaslo(e.target.value)}
                />
              </Field>
              <button className="btn-outline" onClick={zmienHaslo}>
                <ShieldCheck size={16} /> Zmień hasło
              </button>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Uzytkownicy i role */}
      {czyAdmin && (
        <SectionCard
          title="Użytkownicy i role"
          icon={<Users2 size={18} />}
          desc="Dodawaj pracowników (np. montażystów) i nadawaj im role dostępu."
        >
          <div className="space-y-2">
            {uzytkownicy.map((us) => (
              <UserRow
                key={us.id}
                us={us}
                czyJa={us.id === user?.id}
                onZmien={async (patch) => {
                  upsert('uzytkownicy', { ...us, ...patch })
                  // Rola musi trafic TAKZE do chmury. Inaczej przy nastepnym logowaniu
                  // tej osoby chmura nadpisze ja stara rola i awans sie cofnie.
                  if (patch.rola && patch.rola !== us.rola) {
                    try {
                      await zmienRoleWChmurze(us.id, patch.rola)
                    } catch {
                      push('Zmieniono rolę lokalnie, ale nie udało się zapisać jej w chmurze', 'err')
                    }
                  }
                }}
                onUsun={async () => {
                  if (us.id === user?.id) return push('Nie można usunąć własnego konta', 'err')
                  if (await confirm(`Usunąć użytkownika „${us.imie}”?`)) remove('uzytkownicy', us.id)
                }}
              />
            ))}
          </div>
          <DodajUzytkownika onAdd={(u) => upsert('uzytkownicy', u)} />
          {confirmNode}
        </SectionCard>
      )}
    </>
  )
}

function UserRow({
  us,
  czyJa,
  onZmien,
  onUsun,
}: {
  us: Uzytkownik
  czyJa: boolean
  onZmien: (patch: Partial<Uzytkownik>) => void | Promise<void>
  onUsun: () => void
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 p-2.5">
      <span
        className="grid h-9 w-9 place-items-center rounded-lg text-[12px] font-semibold text-white"
        style={{ background: us.kolor || '#3a4a7a' }}
      >
        {initials(us.imie)}
      </span>
      <div className="min-w-[140px] flex-1">
        <div className="text-[14px] font-medium text-ink">
          {us.imie} {czyJa && <span className="text-[11px] text-stone-500">(Ty)</span>}
        </div>
        <div className="text-[12px] text-stone-500">{us.email}</div>
      </div>
      <Select
        className="w-auto"
        value={us.rola}
        onChange={(e) => onZmien({ rola: e.target.value as Rola })}
        disabled={czyJa}
      >
        {ROLE.map((r) => (
          <option key={r.rola} value={r.rola}>
            {r.nazwa}
          </option>
        ))}
      </Select>
      <Toggle checked={us.aktywny} onChange={(v) => onZmien({ aktywny: v })} label="Aktywny" />
      {!czyJa && (
        <button className="btn-ghost !px-2 text-red-400" onClick={onUsun} title="Usuń">
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

function DodajUzytkownika({ onAdd }: { onAdd: (u: Uzytkownik) => void }) {
  const { push } = useToast()
  const [open, setOpen] = useState(false)
  const [imie, setImie] = useState('')
  const [email, setEmail] = useState('')
  const [rola, setRola] = useState<Rola>('montazysta')
  const [haslo, setHaslo] = useState('')

  async function dodaj() {
    if (imie.trim().length < 2) return push('Podaj imię', 'err')
    if (haslo.length < 4) return push('Hasło min. 4 znaki', 'err')
    const sol = losowaSol()
    const u: Uzytkownik = {
      id: uid('usr'),
      imie: imie.trim(),
      email: email.trim().toLowerCase(),
      rola,
      hasloHash: await hashHasla(haslo, sol),
      salt: sol,
      kolor: KOLORY[Math.floor(Math.random() * KOLORY.length)],
      aktywny: true,
      utworzono: nowISO(),
    }
    onAdd(u)
    setImie('')
    setEmail('')
    setHaslo('')
    setRola('montazysta')
    setOpen(false)
    push(`Dodano użytkownika: ${u.imie}`)
  }

  if (!open) {
    return (
      <button className="btn-outline mt-3" onClick={() => setOpen(true)}>
        <Plus size={16} /> Dodaj użytkownika
      </button>
    )
  }
  return (
    <div className="mt-3 rounded-xl border border-white/10 p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Imię i nazwisko">
          <Input value={imie} onChange={(e) => setImie(e.target.value)} placeholder="np. Bogdan" autoFocus />
        </Field>
        <Field label="E-mail">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="e-mail (opcjonalnie)"
          />
        </Field>
        <Field label="Rola">
          <Select value={rola} onChange={(e) => setRola(e.target.value as Rola)}>
            {ROLE.map((r) => (
              <option key={r.rola} value={r.rola}>
                {r.nazwa} – {r.opis}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Hasło startowe">
          <Input type="password" value={haslo} onChange={(e) => setHaslo(e.target.value)} placeholder="min. 4 znaki" />
        </Field>
      </div>
      <div className="mt-3 flex gap-2">
        <button className="btn-primary" onClick={dodaj}>
          <Check size={16} /> Dodaj
        </button>
        <button className="btn-ghost" onClick={() => setOpen(false)}>
          Anuluj
        </button>
      </div>
    </div>
  )
}
