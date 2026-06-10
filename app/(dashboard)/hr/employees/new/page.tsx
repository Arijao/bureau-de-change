import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import EmployeeForm from '@/components/hr/EmployeeForm'

export default async function NewEmployeePage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">👤 Nouvel employé</h1>
          <p className="page-subtitle">Ajouter un nouvel employé au bureau</p>
        </div>
      </div>

      <EmployeeForm />
    </div>
  )
}