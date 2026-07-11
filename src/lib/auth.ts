import type { Rola } from './types'

// ============================================================================
// AMICO – lokalne uwierzytelnianie (offline). Hasla PBKDF2, PIN, biometria WebAuthn.
// To wygodna blokada aplikacji na urzadzeniu (nie serwer) – dane i tak sa lokalne.
// ============================================================================

// ---------- Base64 ----------
function bytesToB64(bytes: Uint8Array): string {
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s)
}
function b64ToBytes(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}
function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (4 - (b64url.length % 4)) % 4)
  return b64ToBytes(b64)
}
function bytesToB64url(bytes: Uint8Array): string {
  return bytesToB64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function losowaSol(): string {
  const b = new Uint8Array(16)
  crypto.getRandomValues(b)
  return bytesToB64(b)
}

async function pbkdf2(tekst: string, solB64: string, iters = 120000): Promise<string> {
  const enc = new TextEncoder()
  const km = await crypto.subtle.importKey('raw', enc.encode(tekst), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: b64ToBytes(solB64) as BufferSource, iterations: iters, hash: 'SHA-256' },
    km,
    256,
  )
  return bytesToB64(new Uint8Array(bits))
}

export async function hashHasla(haslo: string, sol: string): Promise<string> {
  return pbkdf2(haslo, sol, 120000)
}
export async function sprawdzHaslo(haslo: string, sol: string, hash: string): Promise<boolean> {
  return (await pbkdf2(haslo, sol, 120000)) === hash
}
export async function hashPin(pin: string, sol: string): Promise<string> {
  return pbkdf2(pin, sol, 60000)
}
export async function sprawdzPin(pin: string, sol: string, hash: string): Promise<boolean> {
  return (await pbkdf2(pin, sol, 60000)) === hash
}

// ---------- Sesja (ostatni uzytkownik) ----------
const LAST = 'amico-ostatni-uzytkownik'
export function zapiszOstatniego(id: string) {
  try {
    localStorage.setItem(LAST, id)
  } catch {
    /* ignore */
  }
}
export function ostatniUzytkownik(): string | null {
  try {
    return localStorage.getItem(LAST)
  } catch {
    return null
  }
}
export function wyczyscOstatniego() {
  try {
    localStorage.removeItem(LAST)
  } catch {
    /* ignore */
  }
}

// ---------- Biometria / WebAuthn ----------
export async function biometriaDostepna(): Promise<boolean> {
  if (typeof window === 'undefined' || !window.PublicKeyCredential) return false
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

export async function zarejestrujBiometrie(userId: string, nazwa: string, email: string): Promise<string | null> {
  if (!window.PublicKeyCredential) return null
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  const uid = new TextEncoder().encode(userId)
  try {
    const cred = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'AMICO', id: location.hostname },
        user: { id: uid, name: email || nazwa, displayName: nazwa },
        pubKeyCredParams: [
          { type: 'public-key', alg: -7 },
          { type: 'public-key', alg: -257 },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
      },
    })) as PublicKeyCredential | null
    if (!cred) return null
    return bytesToB64url(new Uint8Array(cred.rawId))
  } catch (e) {
    console.warn('Rejestracja biometrii nieudana', e)
    return null
  }
}

export async function odblokujBiometria(credentialIdB64url: string): Promise<boolean> {
  if (!window.PublicKeyCredential) return false
  const challenge = new Uint8Array(32)
  crypto.getRandomValues(challenge)
  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{ type: 'public-key', id: b64urlToBytes(credentialIdB64url) as BufferSource }],
        userVerification: 'required',
        timeout: 60000,
      },
    })
    return !!assertion
  } catch (e) {
    console.warn('Odblokowanie biometria nieudane', e)
    return false
  }
}

// ---------- Role ----------
export const ROLE: { rola: Rola; nazwa: string; opis: string }[] = [
  { rola: 'wlasciciel', nazwa: 'Właściciel', opis: 'Pełny dostęp do wszystkiego' },
  { rola: 'kierownik', nazwa: 'Kierownik', opis: 'Pełny dostęp operacyjny' },
  { rola: 'biuro', nazwa: 'Biuro', opis: 'Sprzedaż, dokumenty, finanse' },
  { rola: 'montazysta', nazwa: 'Montażysta', opis: 'Zlecenia, kalendarz, odprawa, protokoły' },
]
export function nazwaRoli(r: Rola): string {
  return ROLE.find((x) => x.rola === r)?.nazwa || r
}

// Dostep do sekcji nawigacji wg roli (sciezki dozwolone) – zasada najmniejszych uprawnien
export function dozwoloneSciezki(rola: Rola): string[] | 'all' {
  if (rola === 'wlasciciel' || rola === 'kierownik') return 'all'
  if (rola === 'biuro')
    return [
      '/',
      '/klienci',
      '/zlecenia',
      '/kalendarz',
      '/zadania',
      '/wyceny',
      '/umowy',
      '/faktury',
      '/dokumenty',
      '/skany',
      '/wizualizacja',
      '/kontrahenci',
      '/produkty',
      '/ekspozycje',
      '/finanse',
      '/odprawa',
      '/ustawienia',
      '/pomoc',
    ]
  // montazysta – wylacznie zakres terenowy: bez CRM, wycen, umow, faktur, finansow,
  // ekspozycji, ustawien i cennika (/produkty to lista cen). Wartosc wlasnego zlecenia
  // pozostaje widoczna, bo montazysta wystawia na miejscu KP i musi wiedziec, ile pobrac.
  return ['/', '/zlecenia', '/kalendarz', '/zadania', '/odprawa', '/skany', '/wizualizacja', '/dokumenty', '/pomoc']
}

export function maSciezke(rola: Rola, sciezka: string): boolean {
  const d = dozwoloneSciezki(rola)
  return d === 'all' || d.includes(sciezka)
}
