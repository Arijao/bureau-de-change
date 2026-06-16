import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/services/hr.service'
import { prisma } from '@/lib/prisma'
import LeaveForm from '@/components/hr/LeaveForm'
import LeaveTable from '@/components/hr/LeaveTable'

export const dynamic = 'force-dynamic'

export default async function LeavesPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const employees = await getEmployees(false)

  const leaves = await prisma.leave.findMany({
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
    orderBy: { startDate: 'desc' },
  })

  // Statistiques
  const stats = {
    total: leaves.length,
    pending: leaves.filter(l => l.status === 'PENDING').length,
    approved: leaves.filter(l => l.status === 'APPROVED').length,
    rejected: leaves.filter(l => l.status === 'REJECTED').length,
    paid: leaves.filter(l => l.type === 'PAID' && l.status === 'APPROVED').length,
    unpaid: leaves.filter(l => l.type === 'UNPAID' && l.status === 'APPROVED').length,
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/hr" className="btn btn-outline btn-sm" style={{ marginBottom: '8px' }}>
            ← Retour RH
          </Link>
          <h1 className="page-title">📅 Gestion des Congés</h1>
          <p className="page-subtitle">Demandes, validations et suivi</p>
        </div>
      </div>

      {/* KPIs */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Total demandes</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En attente</div>
          <div className="stat-value text-amber">{stats.pending}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Approuvés</div>
          <div className="stat-value text-green">{stats.approved}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Refusés</div>
          <div className="stat-value text-red">{stats.rejected}</div>
        </div>
      </div>

      {/* Formulaire */}
      <LeaveForm employees={employees} />

      {/* Tableau */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <LeaveTable leaves={leaves} />
      </Suspense>
    </div>
  )
}