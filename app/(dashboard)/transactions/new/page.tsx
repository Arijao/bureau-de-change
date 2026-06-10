import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCurrenciesWithDetails } from '@/services/currency.service'
import { getSettings } from '@/services/settings.service'
import TransactionForm from '@/components/transactions/TransactionForm'

export const dynamic = 'force-dynamic'

export default async function NewTransactionPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [currencies, settings] = await Promise.all([
    getCurrenciesWithDetails(true),
    getSettings(),
  ])

  // [CORRECTION] Mapping complet qui préserve les catégories et les sous-taux
  const mappedCurrencies = (currencies as any[]).map((c: any) => ({
    id: c.id,
    code: c.code,
    name: c.name,
    symbol: c.symbol,
    flag: c.flag,
    currentRate: c.currentRate ? {
      buyRate: c.currentRate.buyRate,
      sellRate: c.currentRate.sellRate,
      // [AJOUT] Transmission des taux par catégorie
      categoryRates: c.currentRate.categoryRates?.map((cr: any) => ({
        categoryId: cr.categoryId,
        buyRate: cr.buyRate
      })) || []
    } : null,
    stock: c.stock ? {
      amount: c.stock.amount,
      alertLevel: c.stock.alertLevel,
      isLow: c.stock.amount <= c.stock.alertLevel,
    } : null,
    // [AJOUT] Transmission des catégories de dénominations
    denominationCategories: c.denominationCategories?.map((cat: any) => ({
      id: cat.id,
      name: cat.name,
      denominations: cat.denominations
    })) || []
  }))

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">💱 Nouvelle transaction</h1>
        <p className="page-subtitle">Taux temps réel · Contrôle stock automatique</p>
      </div>
      <TransactionForm
        currencies={mappedCurrencies}
        userName={user.name}
        bureauName={settings.bureauName}
        bureauAddress={settings.address}
        bureauPhone={settings.phone}
        bureauFooter={settings.footer}
        bureauNif={settings.nif}
        bureauStat={settings.stat}
        bureauEmail={settings.email}
        bureauRib={settings.rib}
        logoBase64={settings.logoBase64}
      />
    </div>
  )
}