import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getCnapsSettings, getChargesDashboardStats } from '@/services/charges.service'
import { formatMGA } from '@/lib/utils'
import CnapsSettingsForm from '@/components/charges/CnapsSettingsForm'
import CnapsPaymentForm from '@/components/charges/CnapsPaymentForm'

export const dynamic = 'force-dynamic'

export default async function CnapsPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const [settings, stats] = await Promise.all([
    getCnapsSettings(),
    getChargesDashboardStats(new Date().getFullYear(), new Date().getMonth() + 1),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🏛️ Gestion CNaPS</h1>
          <p className="page-subtitle">
            Cotisations sociales et versements
          </p>
        </div>
      </div>

      {/* KPIs CNaPS */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">CNaPS à payer</div>
          <div className="stat-value text-amber">{formatMGA(stats.cnapsDebt)}</div>
          <div className="stat-sub">Total dettes</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Part salariale</div>
          <div className="stat-value">{formatMGA(stats.cnapsEmployeeDebt)}</div>
          <div className="stat-sub">Retenues employés</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Part patronale</div>
          <div className="stat-value">{formatMGA(stats.cnapsEmployerDebt)}</div>
          <div className="stat-sub">Charge employeur</div>
        </div>
      </div>

      {/* Configuration des taux */}
      <CnapsSettingsForm settings={settings} />

      {/* Formulaire de versement */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <CnapsPaymentForm currentDebt={stats.cnapsDebt} />
      </Suspense>
    </div>
  )
}