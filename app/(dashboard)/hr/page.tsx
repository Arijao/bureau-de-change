import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getHrDashboardStats } from '@/services/hr.service'
import { formatMGA } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function HrDashboard() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const stats = await getHrDashboardStats()

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">👥 Ressources Humaines</h1>
          <p className="page-subtitle">Gestion du personnel, paie et pointage</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Effectif Total</div>
          <div className="stat-value">{stats.totalEmployees}</div>
          <div className="stat-sub">{stats.activeEmployees} actifs</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Masse Salariale</div>
          <div className="stat-value text-green">{formatMGA(stats.totalPayroll)}</div>
          <div className="stat-sub">Ce mois-ci</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avances en attente</div>
          <div className="stat-value text-amber">{stats.pendingAdvances}</div>
          <div className="stat-sub">Demandes à valider</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Congés en attente</div>
          <div className="stat-value text-blue">{stats.pendingLeaves}</div>
          <div className="stat-sub">Demandes à valider</div>
        </div>
      </div>

      {/* Grille d'accès rapide */}
      <div className="dashboard-grid" style={{ marginTop: 16 }}>
        <Link href="/hr/employees" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-blue">👤</span>
            <h2 className="card-title">Employés</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Liste, fiches et contrats</p>
        </Link>

        <Link href="/hr/salary" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-green">💰</span>
            <h2 className="card-title">Paie</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Bulletins et virements</p>
        </Link>

        <Link href="/hr/attendance" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-amber">️</span>
            <h2 className="card-title">Pointage</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Présences et absences</p>
        </Link>

        <Link href="/hr/leaves" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-red">📅</span>
            <h2 className="card-title">Congés</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Gestion des congés</p>
        </Link>

        <Link href="/hr/advances" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-amber">💰</span>
            <h2 className="card-title">Avances</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Demandes et validations</p>
        </Link>

        <Link href="/hr/sanctions" className="card" style={{ textDecoration: 'none', color: 'inherit' }}>
          <div className="card-header">
            <span className="card-icon card-icon-red">⚠️</span>
            <h2 className="card-title">Sanctions</h2>
          </div>
          <p className="text-muted" style={{ margin: 0 }}>Discipline et retenues</p>
        </Link>

      </div>
    </div>
  )
}