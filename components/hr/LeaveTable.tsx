'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateLeaveStatusAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Leave {
  id: number
  type: string
  startDate: Date
  endDate: Date
  days: number
  status: string
  note: string | null
  employee: Employee
}

interface Props {
  leaves: Leave[]
}

export default function LeaveTable({ leaves }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const handleStatusChange = async (id: number, status: string) => {
    setLoadingId(id)
    await updateLeaveStatusAction(id, status as any)
    setLoadingId(null)
    router.refresh()
  }

  const getTypeChip = (type: string) => {
    switch (type) {
      case 'PAID':
        return <span className="chip chip-green">🏖️ Payé</span>
      case 'UNPAID':
        return <span className="chip chip-amber">⏸️ Sans solde</span>
      case 'SICK':
        return <span className="chip chip-blue">🏥 Maladie</span>
      default:
        return <span className="chip">{type}</span>
    }
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="chip chip-amber">⏳ En attente</span>
      case 'APPROVED':
        return <span className="chip chip-green">✓ Approuvé</span>
      case 'REJECTED':
        return <span className="chip chip-red">✗ Refusé</span>
      default:
        return <span className="chip">{status}</span>
    }
  }

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('fr-FR')
  }

  if (leaves.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>Aucune demande de congé</h3>
          <p className="text-muted">
            Utilisez le formulaire ci-dessus pour créer une demande
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📋</span>
        <h2 className="card-title">Historique des congés</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {leaves.length} demande(s)
        </span>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Type</th>
              <th>Début</th>
              <th>Fin</th>
              <th className="text-center">Jours</th>
              <th>Statut</th>
              <th>Note</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {leaves.map((leave) => (
              <tr key={leave.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {leave.employee.lastName} {leave.employee.firstName}
                  </div>
                  <div className="text-muted fs-12">
                    {leave.employee.position || '—'}
                  </div>
                </td>
                <td>{getTypeChip(leave.type)}</td>
                <td>{formatDate(leave.startDate)}</td>
                <td>{formatDate(leave.endDate)}</td>
                <td className="text-center">
                  <span className="chip chip-outline" style={{ fontSize: 11 }}>
                    {leave.days}j
                  </span>
                </td>
                <td>{getStatusChip(leave.status)}</td>
                <td className="text-muted fs-12">
                  {leave.note || '—'}
                </td>
                <td className="text-right">
                  {leave.status === 'PENDING' && (
                    <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => handleStatusChange(leave.id, 'APPROVED')}
                        disabled={loadingId === leave.id}
                        title="Approuver"
                      >
                        ✓
                      </button>
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                        onClick={() => handleStatusChange(leave.id, 'REJECTED')}
                        disabled={loadingId === leave.id}
                        title="Refuser"
                      >
                        ✗
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}