import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/services/hr.service'
import { prisma } from '@/lib/prisma'
import AttendanceForm from '@/components/hr/AttendanceForm'
import AttendanceTable from '@/components/hr/AttendanceTable'

export const dynamic = 'force-dynamic'

export default async function AttendancePage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  // Date du jour (début et fin)
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const tomorrow = new Date(today)
  tomorrow.setDate(tomorrow.getDate() + 1)

  // Récupérer les employés actifs
  const employees = await getEmployees(false)

  // Récupérer les pointages du jour
  const todayAttendances = await prisma.attendance.findMany({
    where: {
      date: {
        gte: today,
        lt: tomorrow,
      },
    },
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
    orderBy: {
      date: 'desc',
    },
  })

  // Statistiques du jour
  const stats = {
    total: todayAttendances.length,
    present: todayAttendances.filter(a => a.status === 'PRESENT').length,
    late: todayAttendances.filter(a => a.status === 'LATE').length,
    absent: todayAttendances.filter(a => a.status === 'ABSENT').length,
    leave: todayAttendances.filter(a => a.status === 'LEAVE').length,
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">🕐 Pointage du jour</h1>
          <p className="page-subtitle">
            {today.toLocaleDateString('fr-FR', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </div>

      {/* KPIs du jour */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Présents</div>
          <div className="stat-value text-green">{stats.present}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Retards</div>
          <div className="stat-value text-amber">{stats.late}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Absents</div>
          <div className="stat-value text-red">{stats.absent}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En congé</div>
          <div className="stat-value text-blue">{stats.leave}</div>
        </div>
      </div>

      {/* Formulaire de pointage rapide */}
      <AttendanceForm employees={employees} />

      {/* Tableau des pointages du jour */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <AttendanceTable attendances={todayAttendances} />
      </Suspense>
    </div>
  )
}