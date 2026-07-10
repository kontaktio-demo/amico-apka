// Generator ID (runtime aplikacji – crypto gdy dostepne)
export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : Math.random().toString(36).slice(2) + Date.now().toString(36)
  return prefix ? `${prefix}_${rnd}` : rnd
}

// Numeracja dokumentow: PREFIX/kolejny/ROK  np. WYC/12/2026
export function numerDokumentu(prefix: string, kolejny: number, rok: number): string {
  return `${prefix}/${kolejny}/${rok}`
}
