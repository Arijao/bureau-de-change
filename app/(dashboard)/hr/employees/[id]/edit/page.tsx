import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getEmployeeById } from '@/services/hr.service'
import EditEmployeeForm from '@/components/hr/EditEmployeeForm'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditEmployeePage({ params }: PageProps) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const { id } = await params
  const employeeId = parseInt(id)

  if (isNaN(employeeId)) {
    notFound()
  }

  const employee = await getEmployeeById(employeeId)

  if (!employee) {
    notFound()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">✏️ Modifier l'employé</h1>
          <p className="page-subtitle">
            {employee.lastName} {employee.firstName}
          </p>
        </div>
        <div className="btn-group">
          <Link href={`/hr/employees/${employee.id}`} className="btn btn-outline">
            ← Retour
          </Link>
        </div>
      </div>

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <EditEmployeeForm employee={employee} />
      </Suspense>
    </div>
  )
}