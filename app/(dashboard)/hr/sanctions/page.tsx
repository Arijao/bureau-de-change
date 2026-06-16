import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/services/hr.service'
import { prisma } from '@/lib/prisma'
import { formatMGA } from '@/lib/utils'
import SanctionForm from '@/components/hr/SanctionForm'
import SanctionTable from '@/components/hr/SanctionTable'

export const dynamic = 'force-dynamic'

export default async function SanctionsPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const employees = await getEmployees(false)

  const sanctions = await prisma.sanction.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  // Statistiques
  const stats = {
    total: sanctions.length,
    warnings: sanctions.filter(s => s.type === 'WARNING').length,
    financial: sanctions.filter(s => s.type === 'FINANCIAL').length,
    totalAmount: sanctions
      .filter(s => s.type === 'FINANCIAL')
      .reduce((sum, s) => sum + s.amount, 0),
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/hr" className="btn btn-outline btn-sm" style={{ marginBottom: '8px' }}>
            ← Retour RH
          </Link>
          <h1 className="page-title">⚠️ Gestion des Sanctions</h1>
          <p className="page-subtitle">Avertissements et sanctions disciplinaires</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total sanctions</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Avertissements</div>
          <div className="stat-value text-amber">{stats.warnings}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Sanctions financières</div>
          <div className="stat-value text-red">{formatMGA(stats.totalAmount)}</div>
        </div>
      </div>

      {/* Formulaire */}
      <SanctionForm employees={employees} />

      {/* Tableau */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <SanctionTable sanctions={sanctions} />
      </Suspense>
    </div>
  )
}