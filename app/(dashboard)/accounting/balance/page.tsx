import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getTrialBalance } from '@/services/accounting.service'
import BalanceFilters from '@/components/accounting/BalanceFilters'
import BalanceTable from '@/components/accounting/BalanceTable'

export const dynamic = 'force-dynamic'

interface SearchParams {
  dateFrom?: string
  dateTo?: string
}

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">⚖️ Balance Générale</h1>
        <p className="page-subtitle">
          Soldes de tous les comptes comptables
        </p>
      </div>

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <BalanceFilters />
      </Suspense>

      <Suspense fallback={<div className="loading">Chargement de la balance...</div>}>
        <BalanceTable dateFrom={params.dateFrom} dateTo={params.dateTo} />
      </Suspense>
    </div>
  )
}