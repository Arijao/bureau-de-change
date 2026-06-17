/**
 * Formate un prénom avec majuscule à la première lettre de chaque mot
 */
export function formatFirstName(value: string): string {
  // Conserver le trailing space pour permettre la saisie de prénoms composés
  const trailingSpace = value.endsWith(' ') ? ' ' : ''
  return value
    .toLowerCase()
    .split(' ')
    .filter(w => w.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ') + trailingSpace
}

/**
 * Formate un nom en majuscules
 */
export function formatLastName(value: string): string {
  return value.toUpperCase()
}

/**
 * Formate un CIN avec espaces tous les 3 chiffres
 * Format : 000 000 000 000 (12 chiffres)
 */
export function formatCIN(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 12)
  if (digits.length === 0) return ''
  if (digits.length <= 3) return digits
  if (digits.length <= 6) return `${digits.slice(0, 3)} ${digits.slice(3)}`
  if (digits.length <= 9) return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9)}`
}

/**
 * Extrait uniquement les chiffres d'un CIN formaté
 */
export function parseCIN(value: string): string {
  return value.replace(/\D/g, '')
}

/**
 * Formate les chiffres d'un téléphone malgache (sans +261)
 * Format : 32 01 002 03 (9 chiffres)
 */
export function formatPhoneDigits(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 9)
  if (digits.length === 0) return ''
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)} ${digits.slice(2)}`
  if (digits.length <= 7) return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`
  return `${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 7)} ${digits.slice(7)}`
}

/**
 * Extrait les chiffres d'un téléphone (sans +261)
 */
export function parsePhone(value: string): string {
  return value.replace(/^\+?261/, '').replace(/\D/g, '')
}

/**
 * Formate un nombre avec séparateurs de milliers (espaces)
 */
export function formatSalary(value: string): string {
  const digits = value.replace(/\D/g, '')
  if (!digits) return ''
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
}

/**
 * Convertit un salaire formaté en nombre
 */
export function parseSalary(value: string): number {
  return parseFloat(value.replace(/\s/g, '')) || 0
}

/**
 * Formate un téléphone complet pour l'affichage (avec +261)
 */
export function formatPhoneDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  const digits = parsePhone(value)
  if (!digits) return '—'
  return `+261 ${formatPhoneDigits(digits)}`
}

/**
 * Formate un CIN pour l'affichage
 */
export function formatCINDisplay(value: string | null | undefined): string {
  if (!value) return '—'
  return formatCIN(value)
}

/**
 * Formate un salaire pour l'affichage
 */
export function formatSalaryDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return formatSalary(value.toString())
}