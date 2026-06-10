import Link from 'next/link'

export default function EmployeeNotFound() {
  return (
    <div className="page">
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>Employé introuvable</h3>
          <p className="text-muted">
            Cet employé n'existe pas ou a été supprimé.
          </p>
          <Link href="/hr/employees" className="btn btn-primary" style={{ marginTop: 16 }}>
            ← Retour à la liste
          </Link>
        </div>
      </div>
    </div>
  )
}