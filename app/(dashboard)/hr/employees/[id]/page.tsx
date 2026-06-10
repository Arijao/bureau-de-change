import { Suspense } from 'react'
import Link from 'next/link'
import { getSessionUser } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { getEmployeeById } from '@/services/hr.service'
import { formatMGA } from '@/lib/utils'
import { formatCIN, formatPhoneDigits} from '@/lib/formatters'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EmployeeDetailPage({ params }: PageProps) {
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
          <h1 className="page-title">👤 {employee.lastName} {employee.firstName}</h1>
          <p className="page-subtitle">
            Fiche employé {employee.active ? '(Actif)' : '(Inactif)'}
          </p>
        </div>
        <div className="btn-group">
          <Link href="/hr/employees" className="btn btn-outline">
            ← Retour à la liste
          </Link>
          <Link href={`/hr/employees/${employee.id}/edit`} className="btn btn-primary">
            ✏️ Modifier
          </Link>
        </div>
      </div>

      <div className="dashboard-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
        
        {/* Informations personnelles */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon card-icon-blue">👤</span>
            <h2 className="card-title">Informations personnelles</h2>
          </div>
          <div className="info-box">
            <div className="ib-row">
              <span className="ib-label">Nom complet</span>
              <span className="ib-value">{employee.lastName} {employee.firstName}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">CIN</span>
              <span className="ib-value">{employee.cin ? formatCIN(employee.cin) : '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Téléphone</span>
              <span className="ib-value">{employee.phone ? formatPhoneDigits(employee.phone) : '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Email</span>
              <span className="ib-value">{employee.email || '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Adresse</span>
              <span className="ib-value">{employee.address || '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Sexe</span>
              <span className="ib-value">
                {employee.sex 
                  ? employee.sex === 'HOMME' 
                    ? 'Homme' 
                    : 'Femme'
                  : '—'
                }
              </span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Situation matrimoniale</span>
              <span className="ib-value">
                {employee.maritalStatus
                  ? employee.maritalStatus === 'CELIBATAIRE'
                    ? 'Célibataire'
                    : 'Marié(e)'
                  : '—'
                }
              </span>
            </div>
            {employee.maritalStatus === 'MARIE' && employee.numberOfChildren !== null && employee.numberOfChildren !== undefined && (
              <div className="ib-row">
                <span className="ib-label">Nombre d'enfants</span>
                <span className="ib-value">{employee.numberOfChildren}</span>
              </div>
            )}
            <div className="ib-row">
              <span className="ib-label">Compte bancaire</span>
              <span className="ib-value">{employee.bankAccount || '—'}</span>
            </div>
          </div>
        </div>

        {/* Informations professionnelles */}
        <div className="card">
          <div className="card-header">
            <span className="card-icon card-icon-green">💼</span>
            <h2 className="card-title">Informations professionnelles</h2>
          </div>
          <div className="info-box">
            <div className="ib-row">
              <span className="ib-label">Poste</span>
              <span className="ib-value">{employee.position || '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Service / Département</span>
              <span className="ib-value">{employee.department || '—'}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Salaire de base</span>
              <span className="ib-value text-green">{formatMGA(employee.baseSalary)}</span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Date d'embauche</span>
              <span className="ib-value">
                {new Date(employee.hiredAt).toLocaleDateString('fr-FR')}
              </span>
            </div>
            <div className="ib-row">
              <span className="ib-label">Statut</span>
              <span className="ib-value">
                {employee.active ? (
                  <span className="chip chip-green">Actif</span>
                ) : (
                  <span className="chip chip-red">Inactif</span>
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Derniers pointages */}
      {employee.attendances && employee.attendances.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-icon card-icon-amber">🕐</span>
            <h2 className="card-title">Derniers pointages</h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Arrivée</th>
                  <th>Départ</th>
                  <th>Heures</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {employee.attendances.slice(0, 5).map((attendance) => (
                  <tr key={attendance.id}>
                    <td>{new Date(attendance.date).toLocaleDateString('fr-FR')}</td>
                    <td>
                      {attendance.checkIn 
                        ? new Date(attendance.checkIn).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : '—'
                      }
                    </td>
                    <td>
                      {attendance.checkOut
                        ? new Date(attendance.checkOut).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
                        : '—'
                      }
                    </td>
                    <td>{attendance.hours ? `${attendance.hours.toFixed(2)}h` : '—'}</td>
                    <td>
                      <span className={`chip ${
                        attendance.status === 'PRESENT' ? 'chip-green' :
                        attendance.status === 'ABSENT' ? 'chip-red' :
                        attendance.status === 'LATE' ? 'chip-amber' :
                        'chip-blue'
                      }`}>
                        {attendance.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Avances en cours */}
      {employee.advances && employee.advances.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-icon card-icon-red">💰</span>
            <h2 className="card-title">Avances en cours</h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Montant</th>
                  <th>Statut</th>
                  <th>Note</th>
                </tr>
              </thead>
              <tbody>
                {employee.advances.map((advance) => (
                  <tr key={advance.id}>
                    <td>{new Date(advance.date).toLocaleDateString('fr-FR')}</td>
                    <td className="fw-600">{formatMGA(advance.amount)}</td>
                    <td>
                      <span className={`chip ${
                        advance.status === 'APPROVED' ? 'chip-green' :
                        advance.status === 'PENDING' ? 'chip-amber' :
                        advance.status === 'DEDUCTED' ? 'chip-blue' :
                        'chip-red'
                      }`}>
                        {advance.status}
                      </span>
                    </td>
                    <td>{advance.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}