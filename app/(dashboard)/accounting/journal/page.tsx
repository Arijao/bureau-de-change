import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getJournal, getChartOfAccounts } from '@/services/accounting.service'
import JournalTable from '@/components/accounting/JournalTable'
import JournalFilters from '@/components/accounting/JournalFilters'
import ExportButton from '@/components/accounting/ExportButton'
import { formatMGA } from '@/lib/utils'

export const dynamic = 'force-dynamic'

interface SearchParams {
  dateFrom?: string
  dateTo?: string
  accountId?: string
  reference?: string
  page?: string
}

/**
 * Construit l'URL de pagination en préservant tous les filtres actifs.
 */
function buildPageUrl(params: SearchParams, page: number): string {
  const searchParams = new URLSearchParams()
  searchParams.set('page', String(page))
  if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom)
  if (params.dateTo) searchParams.set('dateTo', params.dateTo)
  if (params.accountId) searchParams.set('accountId', params.accountId)
  if (params.reference) searchParams.set('reference', params.reference)
  return `/accounting/journal?${searchParams.toString()}`
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const params = await searchParams
  const currentPage = parseInt(params.page || '1')
  const limit = 50

  const [journalResult, accounts] = await Promise.all([
    getJournal({
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      accountId: params.accountId ? parseInt(params.accountId) : undefined,
      reference: params.reference,
      limit,
      offset: (currentPage - 1) * limit,
    }),
    getChartOfAccounts(),
  ])

  const totalPages = Math.max(1, Math.ceil(journalResult.total / limit))

  return (
    <div className="page">
      {/* 1. HEADER + EXPORT */}
      <div className="page-header">
        <div>
          <h1 className="page-title">📒 Journal général</h1>
          <p className="page-subtitle">
            {journalResult.total} écriture(s) comptable(s)
          </p>
        </div>
        <ExportButton />
      </div>

      {/* 2. CARTES DE SYNTHÈSE */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total Débit</div>
          <div className="stat-value text-green">
            {formatMGA(journalResult.totals.debit)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total Crédit</div>
          <div className="stat-value text-red">
            {formatMGA(journalResult.totals.credit)}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Équilibre</div>
          <div className={`stat-value ${journalResult.totals.isBalanced ? 'text-green' : 'text-red'}`}>
            {journalResult.totals.isBalanced ? '✓ Équilibré' : '✗ Déséquilibré'}
          </div>
        </div>
      </div>

      {/* 3. FILTRES */}
      <Suspense fallback={<div className="loading">Chargement des filtres...</div>}>
        <JournalFilters accounts={accounts} />
      </Suspense>

      {/* 4. TABLEAU */}
      <JournalTable entries={journalResult.entries} total={journalResult.total} />

      {/* 5. PAGINATION */}
      {totalPages > 1 && (
        <div className="pagination">
          {currentPage > 1 ? (
            <Link
              href={buildPageUrl(params, currentPage - 1)}
              className="btn btn-sm btn-outline"
            >
              ← Précédent
            </Link>
          ) : (
            <button className="btn btn-sm btn-outline" disabled>
              ← Précédent
            </button>
          )}

          <span style={{ alignSelf: 'center', fontSize: 13, color: 'var(--text2)' }}>
            Page {currentPage} sur {totalPages}
          </span>

          {currentPage < totalPages ? (
            <Link
              href={buildPageUrl(params, currentPage + 1)}
              className="btn btn-sm btn-outline"
            >
              Suivant →
            </Link>
          ) : (
            <button className="btn btn-sm btn-outline" disabled>
              Suivant →
            </button>
          )}
        </div>
      )}
    </div>
  )
}