import { Suspense } from 'react'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees, getSalaries } from '@/services/hr.service'
import { formatMGA } from '@/lib/utils'
import SalaryForm from '@/components/hr/SalaryForm'
import SalaryTable from '@/components/hr/SalaryTable'


export const dynamic = 'force-dynamic'

interface SearchParams {
  employeeId?: string
  year?: string
  month?: string
}

export default async function SalaryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const params = await searchParams
  const [employees, salaries] = await Promise.all([
    getEmployees(false),
    getSalaries(
      params.employeeId ? parseInt(params.employeeId) : undefined,
      params.year ? parseInt(params.year) : undefined
    ),
  ])

  // Statistiques
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const currentMonthSalaries = salaries.filter(
    s => s.month === currentMonth && s.year === currentYear
  )
  const totalPayroll = currentMonthSalaries.reduce((sum, s) => sum + s.netSalary, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">💰 Gestion de la Paie</h1>
          <p className="page-subtitle">
            Bulletins de salaire et virements
          </p>
        </div>
      </div>

      {/* KPIs du mois */}
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-label">Mois en cours</div>
          <div className="stat-value text-blue">
            {new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Bulletins générés</div>
          <div className="stat-value">{currentMonthSalaries.length}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Masse salariale</div>
          <div className="stat-value text-green">{formatMGA(totalPayroll)}</div>
        </div>
      </div>

      {/* Formulaire de génération de paie */}
      <SalaryForm employees={employees} />

      {/* Tableau des salaires */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <SalaryTable salaries={salaries} employees={employees} />
      </Suspense>
    </div>
  )
}