import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getChartOfAccounts } from '@/services/accounting.service'
import LedgerFilters from '@/components/accounting/LedgerFilters'
import LedgerTable from '@/components/accounting/LedgerTable'

export const dynamic = 'force-dynamic'

interface SearchParams {
  accountId?: string
  dateFrom?: string
  dateTo?: string
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const accounts = await getChartOfAccounts()

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">📖 Grand Livre</h1>
        <p className="page-subtitle">
          Détail des mouvements par compte comptable
        </p>
      </div>

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <LedgerFilters accounts={accounts} />
      </Suspense>

      {params.accountId ? (
        <Suspense fallback={<div className="loading">Chargement du grand livre...</div>}>
          <LedgerTable
            accountId={parseInt(params.accountId)}
            dateFrom={params.dateFrom}
            dateTo={params.dateTo}
          />
        </Suspense>
      ) : (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon"></div>
            <h3>Sélectionnez un compte</h3>
            <p className="text-muted">
              Choisissez un compte dans les filtres ci-dessus pour afficher son grand livre
            </p>
          </div>
        </div>
      )}
    </div>
  )
}