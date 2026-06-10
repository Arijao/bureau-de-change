'use client'

interface Attendance {
  id: number
  date: Date
  checkIn: Date | null
  checkOut: Date | null
  hours: number | null
  status: string
  note: string | null
  employee: {
    id: number
    firstName: string
    lastName: string
    position: string | null
  }
}

interface Props {
  attendances: Attendance[]
}

export default function AttendanceTable({ attendances }: Props) {
  if (attendances.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">🕐</div>
          <h3>Aucun pointage aujourd'hui</h3>
          <p className="text-muted">
            Utilisez le formulaire ci-dessus pour enregistrer les présences
          </p>
        </div>
      </div>
    )
  }

  const getStatusChip = (status: string) => {
    switch (status) {
      case 'PRESENT':
        return <span className="chip chip-green">✓ Présent</span>
      case 'LATE':
        return <span className="chip chip-amber">⏰ Retard</span>
      case 'ABSENT':
        return <span className="chip chip-red">✗ Absent</span>
      case 'LEAVE':
        return <span className="chip chip-blue">📅 Congé</span>
      default:
        return <span className="chip">{status}</span>
    }
  }

  const formatTime = (date: Date | null) => {
    if (!date) return '—'
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-green">📋</span>
        <h2 className="card-title">Pointages du jour</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {attendances.length} pointage(s)
        </span>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Employé</th>
              <th>Poste</th>
              <th>Arrivée</th>
              <th>Départ</th>
              <th>Heures</th>
              <th>Statut</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {attendances.map((attendance) => (
              <tr key={attendance.id}>
                <td>
                  <div style={{ fontWeight: 600 }}>
                    {attendance.employee.lastName} {attendance.employee.firstName}
                  </div>
                </td>
                <td className="text-muted">
                  {attendance.employee.position || '—'}
                </td>
                <td>
                  <span className="fw-600">{formatTime(attendance.checkIn)}</span>
                </td>
                <td>
                  <span className="fw-600">{formatTime(attendance.checkOut)}</span>
                </td>
                <td>
                  {attendance.hours !== null ? (
                    <span className="fw-600">
                      {attendance.hours.toFixed(2)}h
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{getStatusChip(attendance.status)}</td>
                <td className="text-muted fs-12">
                  {attendance.note || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}