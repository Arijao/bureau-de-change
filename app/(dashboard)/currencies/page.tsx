import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrenciesWithDetails } from '@/services/currency.service'
import { getRateHistory } from '@/services/exchange-rate.service'
import { getSettings } from '@/services/settings.service'
import CurrenciesClient from '@/components/currencies/CurrenciesClient'

export const dynamic = 'force-dynamic'

export default async function CurrenciesPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [currencies, rateHistory, settings] = await Promise.all([
    getCurrenciesWithDetails(),
    getRateHistory(undefined, 30),
    getSettings(),
  ])

  const mappedHistory = rateHistory.map((h: any) => ({
    id: h.id, createdAt: h.createdAt, buyRate: h.buyRate, sellRate: h.sellRate,
    note: h.note, currency: h.currency
  ? { flag: h.currency.flag, code: h.currency.code }
  : { flag: '', code: '' },
    user: h.user ? { name: h.user.name } : null,
  }))

  const mappedCurrencies = currencies.map((c: any) => ({
    ...c,
    stock: c.stock ? {
      amount: c.stock.amount, alertLevel: c.stock.alertLevel,
      isLow: c.stock.amount <= c.stock.alertLevel,
      percentage: c.stock.alertLevel > 0 ? Math.round(c.stock.amount / (c.stock.alertLevel * 10) * 100) : 100,
    } : null,
  }))

  return (
    <div className="page">
      <CurrenciesClient currencies={mappedCurrencies} isAdmin={user.role === 'ADMIN'} rateHistory={mappedHistory} settings={{ bureauName: settings.bureauName, address: settings.address, phone: settings.phone, footer: settings.footer, logoBase64: settings.logoBase64 ?? null }} />
    </div>
  )
}
