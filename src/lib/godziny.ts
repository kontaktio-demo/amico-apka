// ============================================================================
// Godziny pracy pracowni AMICO (wg wizytówki firmy):
//   wtorek 08-18, środa-piątek 08-15, sobota 08-12  -> DNI PRACY
//   niedziela, poniedziałek -> ZAMKNIĘTE
// Uzywane m.in. do przypomnienia o codziennym raporcie kasowym (tylko w dni pracy).
// JS Date.getDay(): 0=niedziela, 1=poniedzialek, ... 6=sobota
// ============================================================================
export const DNI_PRACY = [2, 3, 4, 5, 6] // wtorek..sobota

export const NAZWY_DNI = [
  'niedziela',
  'poniedziałek',
  'wtorek',
  'środa',
  'czwartek',
  'piątek',
  'sobota',
]

export function czyDzienPracy(d: Date = new Date()): boolean {
  return DNI_PRACY.includes(d.getDay())
}

export function nazwaDnia(d: Date = new Date()): string {
  return NAZWY_DNI[d.getDay()] || ''
}
