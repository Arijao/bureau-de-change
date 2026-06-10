/**
 * Convertisseur de nombres entiers en lettres — français (Académie française)
 *
 * Règles appliquées :
 *   80  → quatre-vingts    (s si position finale)
 *   81  → quatre-vingt-un  (pas de s si suivi d'une unité)
 *   200 → deux cents        (s si position finale)
 *   201 → deux cent un      (pas de s si suivi d'autre chose)
 *   1000 → mille             (invariable — jamais "un mille")
 *   Tirets entre dizaine et unité ; "et" pour 1 et 11 après une dizaine
 */

const UNITES = [
  '', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit', 'neuf',
  'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize',
  'dix-sept', 'dix-huit', 'dix-neuf',
]

const DIZAINES = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt',
]

function belowHundred(n: number, isFinal: boolean): string {
  if (n === 0) return ''
  if (n < 20)  return UNITES[n]

  const d = Math.floor(n / 10)
  const u = n % 10

  if (d === 7 || d === 9) {
    const base = d === 7 ? 'soixante' : 'quatre-vingt'
    return `${base}-${UNITES[10 + u]}`
  }

  if (d === 8) {
    if (u === 0) return isFinal ? 'quatre-vingts' : 'quatre-vingt'
    return `quatre-vingt-${UNITES[u]}`
  }

  const diz = DIZAINES[d]
  if (u === 0)             return diz
  if (u === 1 || u === 11) return `${diz}-et-${UNITES[u]}`
  return `${diz}-${UNITES[u]}`
}

function below1000(n: number, isFinal: boolean): string {
  if (n === 0) return ''
  if (n < 100) return belowHundred(n, isFinal)

  const c     = Math.floor(n / 100)
  const reste = n % 100

  if (c === 1) {
    if (reste === 0) return 'cent'
    return `cent ${belowHundred(reste, isFinal)}`
  }

  const centBase = `${UNITES[c]} cent`
  if (reste === 0) return isFinal ? `${centBase}s` : centBase
  return `${centBase} ${belowHundred(reste, isFinal)}`
}

export function numberToWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return 'nombre invalide'
  n = Math.floor(n)
  if (n === 0) return 'zéro'

  const milliard = Math.floor(n / 1_000_000_000)
  const million  = Math.floor((n % 1_000_000_000) / 1_000_000)
  const mille    = Math.floor((n % 1_000_000) / 1_000)
  const reste    = n % 1_000

  const isLastMilliard = milliard > 0 && million === 0 && mille === 0 && reste === 0
  const isLastMillion  = million  > 0 && mille   === 0 && reste  === 0
  const hasReste       = reste    > 0

  const parts: string[] = []

  if (milliard > 0) {
    const t = below1000(milliard, isLastMilliard)
    parts.push(milliard === 1 ? 'un milliard' : `${t} milliards`)
  }

  if (million > 0) {
    const t = below1000(million, isLastMillion)
    parts.push(million === 1 ? 'un million' : `${t} millions`)
  }

  if (mille > 0) {
    if (mille === 1) {
      parts.push('mille')
    } else {
      const t = below1000(mille, false) // pas final car suivi de "mille"
      parts.push(`${t} mille`)
    }
  }

  if (hasReste) {
    parts.push(below1000(reste, true))
  }

  return parts.join(' ')
}

export function mgaToWords(amount: number): string {
  const entier      = Math.floor(Math.abs(amount))
  const lettres     = numberToWords(entier)
  const capitalised = lettres.charAt(0).toUpperCase() + lettres.slice(1)
  return `${capitalised} ariary`
}
