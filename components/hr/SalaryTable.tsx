'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { markSalaryAsPaidAction, deleteSalaryAction, generateSalaryAccountingEntryAction } from '@/actions/hr.actions'
import { formatMGA } from '@/lib/utils'
import SalarySlip from './SalarySlip'

interface Employee {
  id: number
  firstName: string
  lastName: string
  cin: string | null
  position: string | null
  department: string | null
  bankAccount: string | null
}

interface Salary {
  id: number
  employeeId: number
  month: number
  year: number
  baseSalary: number
  bonuses: number
  deductions: number
  netSalary: number
  cnapsEmployee: number  // NOUVEAU
  cnapsEmployer: number  // NOUVEAU
  paidAt: Date | null
  note: string | null
  createdAt: Date
}

interface Props {
  salaries: Salary[]
  employees: Employee[]
}

export default function SalaryTable({ salaries, employees }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)
  const [viewingSalary, setViewingSalary] = useState<{ salary: Salary; employee: Employee } | null>(null)

  const getEmployee = (employeeId: number) => {
    return employees.find(e => e.id === employeeId)
  }

  const handleMarkAsPaid = async (id: number) => {
    setLoadingId(id)
    await markSalaryAsPaidAction(id)
    setLoadingId(null)
    router.refresh()
  }

  const handleDelete = async (id: number) => {
    const salary = salaries.find(s => s.id === id)
    const isPaid = salary?.paidAt
    
    const message = isPaid 
      ? '⚠️ Ce bulletin est déjà marqué comme PAYÉ.\n\nÊtes-vous sûr de vouloir le supprimer ? Cette action est irréversible.'
      : 'Êtes-vous sûr de vouloir supprimer ce bulletin ?'
    
    if (!confirm(message)) return
    
    setLoadingId(id)
    await deleteSalaryAction(id)
    setLoadingId(null)
    router.refresh()
  }

  const handleGenerateAccountingEntry = async (id: number) => {
    setLoadingId(id)
    const result = await generateSalaryAccountingEntryAction(id)
    setLoadingId(null)
    
    if (result.error) {
      alert(`Erreur : ${result.error}`)
    } else {
      alert('✓ Écriture comptable générée avec succès')
      router.refresh()
    }
  }

  if (salaries.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>Aucun bulletin de salaire</h3>
          <p className="text-muted">
            Utilisez le formulaire ci-dessus pour générer un bulletin
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="card">
        <div className="card-header">
          <span className="card-icon card-icon-blue">📋</span>
          <h2 className="card-title">Historique des bulletins</h2>
          <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
            {salaries.length} bulletin(s)
          </span>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Employé</th>
                <th>Période</th>
                <th className="text-right">Salaire Base</th>
                <th className="text-right">Primes</th>
                <th className="text-right">Déductions</th>
                <th className="text-right">Salaire Net</th>
                <th className="text-center">Statut</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {salaries.map((salary) => {
                const employee = getEmployee(salary.employeeId)
                return (
                  <tr key={salary.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {employee ? `${employee.lastName} ${employee.firstName}` : 'Employé inconnu'}
                      </div>
                    </td>
                    <td>
                      <span className="chip chip-outline" style={{ fontSize: 11 }}>
                        {new Date(salary.year, salary.month - 1).toLocaleDateString('fr-FR', {
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </td>
                    <td className="text-right">
                      {formatMGA(salary.baseSalary)}
                    </td>
                    <td className="text-right">
                      {salary.bonuses > 0 ? (
                        <span className="text-green">{formatMGA(salary.bonuses)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right">
                      {salary.deductions > 0 ? (
                        <span className="text-red">{formatMGA(salary.deductions)}</span>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="text-right fw-600 text-green">
                      {formatMGA(salary.netSalary)}
                    </td>
                    <td className="text-center">
                      {salary.paidAt ? (
                        <span className="chip chip-green" style={{ fontSize: 10 }}>
                          ✓ Payé
                        </span>
                      ) : (
                        <span className="chip chip-amber" style={{ fontSize: 10 }}>
                          ⏳ En attente
                        </span>
                      )}
                    </td>
                    <td className="text-right">
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                        <button
                          className="btn btn-sm btn-outline"
                          onClick={() => employee && setViewingSalary({ salary, employee })}
                          title="Voir le bulletin"
                        >
                          👁️
                        </button>
                        {!salary.paidAt && (
                          <>
                            <button
                              className="btn btn-sm btn-success"
                              onClick={() => handleMarkAsPaid(salary.id)}
                              disabled={loadingId === salary.id}
                              title="Marquer comme payé"
                            >
                              {loadingId === salary.id ? '...' : '✓'}
                            </button>
                            <button
                              className="btn btn-sm btn-outline"
                              style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                              onClick={() => handleDelete(salary.id)}
                              disabled={loadingId === salary.id}
                              title="Supprimer le bulletin"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        {salary.paidAt && (
                          <button
                            className="btn btn-sm btn-outline"
                            style={{ borderColor: 'var(--blue)', color: 'var(--blue)' }}
                            onClick={() => handleGenerateAccountingEntry(salary.id)}
                            disabled={loadingId === salary.id}
                            title="Générer l'écriture comptable"
                          >
                            📒
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal de visualisation */}
      {viewingSalary && (
        <SalarySlip
          employee={viewingSalary.employee}
          salary={viewingSalary.salary}
          onClose={() => setViewingSalary(null)}
        />
      )}
    </>
  )
}