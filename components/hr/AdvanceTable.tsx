'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateAdvanceStatusAction } from '@/actions/hr.actions'
import { formatMGA } from '@/lib/utils'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Advance {
  id: number
  amount: number
  date: Date
  status: string
  note: string | null
  employee: Employee
}

interface Props {
  advances: Advance[]
}

export default function AdvanceTable({ advances }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const handleStatusChange = async (id: number, status: string) => {
    setLoadingId(id)
    await updateAdvanceStatusAction(id, status as any)
    setLoadingId(null)
    router.refresh()
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <span className="chip chip-amber">⏳ En attente</span>
      case 'APPROVED':
        return <span className="chip chip-green">✓ Approuvée</span>
      case 'DEDUCTED':
        return <span className="chip chip-blue">✓ Déduite</span>
      case 'CANCELLED':
        return <span className="chip chip-red">✗ Annulée</span>
      default:
        return <span className="chip">{status}</span>
    }
  }

  if (advances.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">💰</div>
          <h3>Aucune avance</h3>
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
        <h2 className="card-title">Historique des avances</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {advances.length} avance(s)
        </span>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Date</th>
              <th className="text-right">Montant</th>
              <th>Statut</th>
              <th>Note</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {advances.map((advance) => (
              <tr key={advance.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {advance.employee.lastName} {advance.employee.firstName}
                  </div>
                  <div className="text-muted fs-12">
                    {advance.employee.position || '—'}
                  </div>
                </td>
                <td>
                  {new Date(advance.date).toLocaleDateString('fr-FR')}
                </td>
                <td className="text-right fw-600">
                  {formatMGA(advance.amount)}
                </td>
                <td>{getStatusChip(advance.status)}</td>
                <td className="text-muted fs-12">
                  {advance.note || '—'}
                </td>
                <td className="text-right">
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                    {advance.status === 'PENDING' && (
                      <>
                        <button
                          className="btn btn-sm btn-success"
                          onClick={() => handleStatusChange(advance.id, 'APPROVED')}
                          disabled={loadingId === advance.id}
                          title="Approuver"
                        >
                          ✓
                        </button>
                        <button
                          className="btn btn-sm btn-outline"
                          style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                          onClick={() => handleStatusChange(advance.id, 'CANCELLED')}
                          disabled={loadingId === advance.id}
                          title="Annuler"
                        >
                          
                        </button>
                      </>
                    )}
                    {advance.status === 'APPROVED' && (
                      <button
                        className="btn btn-sm btn-outline"
                        style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                        onClick={() => handleStatusChange(advance.id, 'CANCELLED')}
                        disabled={loadingId === advance.id}
                        title="Annuler"
                      >
                        ✗
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}