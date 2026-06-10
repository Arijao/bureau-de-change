export function formatMGA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' Ar'
}
export function formatCurrency(amount: number, code: string): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount) + ' ' + code
}
export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)
}
export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}
export function formatTime(date: Date | string): string {
  return new Date(date).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}
export function formatDateTime(date: Date | string): string {
  return formatDate(date) + ' ' + formatTime(date)
}
export function generateReceiptNo(counter: number): string {
  return 'REC-' + String(counter).padStart(5, '0')
}
export function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}
export function getDateRange(period: 'today' | 'week' | 'month' | 'year') {
  const now = new Date(); const from = new Date()
  if (period === 'today') from.setHours(0, 0, 0, 0)
  else if (period === 'week') from.setDate(now.getDate() - 7)
  else if (period === 'month') from.setMonth(now.getMonth() - 1)
  else if (period === 'year') from.setFullYear(now.getFullYear() - 1)
  return { from, to: now }
}
