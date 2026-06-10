import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTransactions, type TransactionType } from '@/services/transaction.service'
import { getCurrencies } from '@/services/currency.service'
import { getSettings } from '@/services/settings.service'
import TransactionFilters from '@/components/transactions/TransactionFilters'
import TransactionTable from '@/components/transactions/TransactionTable'

export const dynamic = 'force-dynamic'

interface SearchParams { dateFrom?: string; dateTo?: string; type?: string; currency?: string }

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const [result, currencies, settings] = await Promise.all([
    getTransactions({
      dateFrom: params.dateFrom, dateTo: params.dateTo,
      type: params.type as TransactionType | undefined,
      currencyId: params.currency ? parseInt(params.currency) : undefined,
      limit: 100,
    }),
    getCurrencies(),
    getSettings(),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📋 Historique des transactions</h1>
        <p className="page-subtitle">{result.total} transaction(s) au total</p>
      </div>
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <TransactionFilters currencies={(currencies as any[]).map((c: any) => ({ id: c.id, code: c.code, flag: c.flag }))} />
      </Suspense>
      <TransactionTable
        transactions={result.transactions as any}
        total={result.total}
        isAdmin={user.role === 'ADMIN'}
        bureauName={settings.bureauName} bureauAddress={settings.address}
        bureauPhone={settings.phone} bureauFooter={settings.footer}
        bureauNif={settings.nif} bureauStat={settings.stat}
        bureauEmail={settings.email} bureauRib={settings.rib}
        bureauLogo={settings.logoBase64}
      />
    </div>
  )
}
