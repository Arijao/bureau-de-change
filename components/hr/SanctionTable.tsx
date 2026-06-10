'use client'

import { formatMGA } from '@/lib/utils'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Sanction {
  id: number
  type: string
  amount: number
  date: Date
  reason: string
  note: string | null
  employee: Employee
}

interface Props {
  sanctions: Sanction[]
}

export default function SanctionTable({ sanctions }: Props) {
  const getTypeChip = (type: string) => {
    switch (type) {
      case 'WARNING':
        return <span className="chip chip-amber">⚠️ Avertissement</span>
      case 'SUSPENSION':
        return <span className="chip chip-red">🚫 Suspension</span>
      case 'FINANCIAL':
        return <span className="chip chip-red">💰 Financière</span>
      default:
        return <span className="chip">{type}</span>
    }
  }

  if (sanctions.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">️</div>
          <h3>Aucune sanction</h3>
          <p className="text-muted">
            Utilisez le formulaire ci-dessus pour enregistrer une sanction
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📋</span>
        <h2 className="card-title">Historique des sanctions</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {sanctions.length} sanction(s)
        </span>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Date</th>
              <th>Type</th>
              <th className="text-right">Montant</th>
              <th>Motif</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {sanctions.map((sanction) => (
              <tr key={sanction.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {sanction.employee.lastName} {sanction.employee.firstName}
                  </div>
                  <div className="text-muted fs-12">
                    {sanction.employee.position || '—'}
                  </div>
                </td>
                <td>
                  {new Date(sanction.date).toLocaleDateString('fr-FR')}
                </td>
                <td>{getTypeChip(sanction.type)}</td>
                <td className="text-right">
                  {sanction.type === 'FINANCIAL' ? (
                    <span className="fw-600 text-red">{formatMGA(sanction.amount)}</span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td style={{ maxWidth: '300px' }}>
                  <div className="text-muted fs-12" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sanction.reason}
                  </div>
                </td>
                <td className="text-muted fs-12">
                  {sanction.note || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}