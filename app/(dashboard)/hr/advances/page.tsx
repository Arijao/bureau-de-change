import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/services/hr.service'
import { prisma } from '@/lib/prisma'
import { formatMGA } from '@/lib/utils'
import AdvanceForm from '@/components/hr/AdvanceForm'
import AdvanceTable from '@/components/hr/AdvanceTable'

export const dynamic = 'force-dynamic'

export default async function AdvancesPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const employees = await getEmployees(false)

  const advances = await prisma.advance.findMany({
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
    total: advances.length,
    pending: advances.filter(a => a.status === 'PENDING').length,
    approved: advances.filter(a => a.status === 'APPROVED').length,
    deducted: advances.filter(a => a.status === 'DEDUCTED').length,
    totalAmount: advances.reduce((sum, a) => sum + a.amount, 0),
    pendingAmount: advances
      .filter(a => a.status === 'PENDING' || a.status === 'APPROVED')
      .reduce((sum, a) => sum + a.amount, 0),
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Gestion des Avances</h1>
          <p className="page-subtitle">Demandes, validations et déductions</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total avances</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En attente</div>
          <div className="stat-value text-amber">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approuvées</div>
          <div className="stat-value text-blue">{stats.approved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Montant en cours</div>
          <div className="stat-value text-red">{formatMGA(stats.pendingAmount)}</div>
        </div>
      </div>

      {/* Formulaire */}
      <AdvanceForm employees={employees} />

      {/* Tableau */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <AdvanceTable advances={advances} />
      </Suspense>
    </div>
  )
}