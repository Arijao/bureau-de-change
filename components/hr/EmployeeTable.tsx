'use client'

import Link from 'next/link'

interface Employee {
  id: number
  firstName: string
  lastName: string
  cin: string | null
  phone: string | null
  department: string | null
  position: string | null
  baseSalary: number
  formattedSalary: string  // ← Nouveau champ formaté
  active: boolean
}

interface Props {
  employees: Employee[]
}

export default function EmployeeTable({ employees }: Props) {
  if (employees.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>Aucun employé</h3>
          <p className="text-muted" style={{ marginTop: 8 }}>
            Commencez par ajouter votre premier employé
          </p>
          <Link href="/hr/employees/new" className="btn btn-primary" style={{ marginTop: 16 }}>
            + Nouvel employé
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Nom & Prénom</th>
              <th>CIN</th>
              <th>Poste / Service</th>
              <th>Téléphone</th>
              <th className="text-right">Salaire Base</th>
              <th className="text-center">Statut</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} style={{ opacity: emp.active ? 1 : 0.5 }}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {emp.lastName} {emp.firstName}
                  </div>
                </td>
                <td>
                  {emp.cin ? (
                    <span className="chip chip-outline" style={{ fontSize: 10 }}>
                      {emp.cin}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>
                  {emp.position || '—'}
                  {emp.department && (
                    <span className="text-muted fs-12" style={{ marginLeft: 4 }}>
                      ({emp.department})
                    </span>
                  )}
                </td>
                <td>{emp.phone || '—'}</td>
                <td className="text-right fw-600">{emp.formattedSalary}</td>
                <td className="text-center">
                  {emp.active ? (
                    <span className="chip chip-green" style={{ fontSize: 10 }}>Actif</span>
                  ) : (
                    <span className="chip chip-red" style={{ fontSize: 10 }}>Inactif</span>
                  )}
                </td>
                <td className="text-right">
                  <Link
                    href={`/hr/employees/${emp.id}`}
                    className="btn btn-sm btn-outline"
                  >
                    Voir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}