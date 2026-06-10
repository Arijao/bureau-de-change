'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestLeaveAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function LeaveForm({ employees }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'PAID' as 'PAID' | 'UNPAID' | 'SICK',
    startDate: '',
    endDate: '',
    note: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await requestLeaveAction({
      employeeId: parseInt(formData.employeeId),
      type: formData.type,
      startDate: new Date(formData.startDate),
      endDate: new Date(formData.endDate),
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Demande de congé enregistrée')
      setFormData({
        employeeId: '',
        type: 'PAID',
        startDate: '',
        endDate: '',
        note: '',
      })
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  // Calculer le nombre de jours
  const calculateDays = () => {
    if (!formData.startDate || !formData.endDate) return 0
    const start = new Date(formData.startDate)
    const end = new Date(formData.endDate)
    const diffTime = Math.abs(end.getTime() - start.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const days = calculateDays()

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📅</span>
        <h2 className="card-title">Nouvelle demande de congé</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employé *</label>
            <select
              className="form-control"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
            >
              <option value="">— Sélectionner un employé —</option>
              {employees.map(emp => (
                <option key={emp.id} value={emp.id}>
                  {emp.lastName} {emp.firstName}
                  {emp.position ? ` — ${emp.position}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Type de congé *</label>
            <select
              className="form-control"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="PAID">🏖️ Congé payé</option>
              <option value="UNPAID">⏸️ Congé sans solde</option>
              <option value="SICK">🏥 Congé maladie</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date de début *</label>
            <input
              type="date"
              className="form-control"
              name="startDate"
              value={formData.startDate}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Date de fin *</label>
            <input
              type="date"
              className="form-control"
              name="endDate"
              value={formData.endDate}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {days > 0 && (
          <div className="info-box" style={{ marginBottom: 16 }}>
            <div className="ib-row">
              <span className="ib-label">Durée du congé</span>
              <span className="ib-value text-blue">
                {days} jour{days > 1 ? 's' : ''}
              </span>
            </div>
            {formData.type === 'UNPAID' && (
              <div className="ib-row">
                <span className="ib-label">Impact sur la paie</span>
                <span className="ib-value text-red">
                  Congé non rémunéré (déduction automatique)
                </span>
              </div>
            )}
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Motif / Note (optionnel)</label>
          <textarea
            className="form-control"
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={2}
            placeholder="Raison de la demande..."
          />
        </div>

        <div className="btn-group">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.employeeId || !formData.startDate || !formData.endDate}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer la demande'}
          </button>
        </div>
      </form>
    </div>
  )
}