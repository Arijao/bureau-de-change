import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getChargesDashboardStats } from '@/services/charges.service'
import { formatMGA } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function ChargesDashboard() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()

  const stats = await getChargesDashboardStats(currentYear, currentMonth)

  const monthName = now.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Gestion des Charges</h1>
          <p className="page-subtitle">
            Dépenses d'exploitation et cotisations sociales — {monthName}
          </p>
        </div>
      </div>

      {/* KPIs consolidés */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total charges du mois</div>
          <div className="stat-value text-red">{formatMGA(stats.totalExpenses)}</div>
          <div className="stat-sub">Dépenses d'exploitation</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CNaPS à payer</div>
          <div className="stat-value text-amber">{formatMGA(stats.cnapsDebt)}</div>
          <div className="stat-sub">Dettes envers CNaPS</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CNaPS salariale</div>
          <div className="stat-value">{formatMGA(stats.cnapsEmployeeDebt)}</div>
          <div className="stat-sub">Retenues sur salaires</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">CNaPS patronale</div>
          <div className="stat-value">{formatMGA(stats.cnapsEmployerDebt)}</div>
          <div className="stat-sub">Charge employeur</div>
        </div>
      </div>

      {/* Navigation vers les sous-modules */}
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <Link href="/charges/expenses" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-blue">💸</span>
            <h2 className="card-title">Dépenses d'exploitation</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>
            Loyer, électricité, fournitures, carburant, etc.
          </p>
        </Link>

        <Link href="/charges/cnaps" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-amber">🏛️</span>
            <h2 className="card-title">CNaPS</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>
            Configuration, suivi et versement des cotisations
          </p>
        </Link>
      </div>

      {/* Répartition par catégorie */}
      {Object.keys(stats.expensesByCategory).length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-icon card-icon-green">📊</span>
            <h2 className="card-title">Répartition des dépenses par catégorie</h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Catégorie</th>
                  <th className="text-right">Montant</th>
                  <th className="text-right">% du total</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(stats.expensesByCategory)
                  .sort((a, b) => b[1] - a[1])
                  .map(([category, amount]) => (
                    <tr key={category}>
                      <td>
                        <span className="chip chip-outline">
                          {category}
                        </span>
                      </td>
                      <td className="text-right fw-600">{formatMGA(amount)}</td>
                      <td className="text-right text-muted">
                        {stats.totalExpenses > 0
                          ? ((amount / stats.totalExpenses) * 100).toFixed(1)
                          : 0}%
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}