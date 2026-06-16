import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getEmployees } from '@/services/hr.service'
import EmployeeTable from '@/components/hr/EmployeeTable'
import { formatMGA } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function EmployeesPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const employees = await getEmployees()

  // Formater les salaires côté serveur
  const employeesWithFormattedSalary = employees.map(emp => ({
    ...emp,
    formattedSalary: formatMGA(emp.baseSalary),
  }))

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href="/hr" className="btn btn-outline btn-sm" style={{ marginBottom: '8px' }}>
            ← Retour RH
          </Link>
          <h1 className="page-title">👤 Employés</h1>
          <p className="page-subtitle">
            {employees.length} employé(s) enregistré(s)
            {employees.filter(e => e.active).length < employees.length && (
              <span className="text-muted">
                {' '}— {employees.filter(e => e.active).length} actif(s)
              </span>
            )}
          </p>
        </div>
        <Link href="/hr/employees/new" className="btn btn-primary">
          + Nouvel employé
        </Link>
      </div>

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <EmployeeTable employees={employeesWithFormattedSalary} />
      </Suspense>
    </div>
  )
}