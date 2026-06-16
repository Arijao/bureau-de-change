// Mapping code devise ISO → code pays flag-icons
// https://github.com/lipis/flag-icons
export const CURRENCY_TO_COUNTRY: Record<string, string> = {
  AED: 'ae',
  AUD: 'au',
  CAD: 'ca',
  CHF: 'ch',
  CNY: 'cn',
  EUR: 'eu',
  GBP: 'gb',
  HKD: 'hk',
  JPY: 'jp',
  MGA: 'mg',
  MUR: 'mu',
  NOK: 'no',
  NZD: 'nz',
  SAR: 'sa',
  SEK: 'se',
  SGD: 'sg',
  USD: 'us',
  ZAR: 'za',
}

export function getFlagClass(currencyCode: string): string {
  const country = CURRENCY_TO_COUNTRY[currencyCode.toUpperCase()]
  if (!country) return 'fi fi-xx'
  return `fi fi-${country}`
}

export function hasFlagIcon(currencyCode: string): boolean {
  return currencyCode.toUpperCase() in CURRENCY_TO_COUNTRY
}