'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { recordAttendanceAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function AttendanceForm({ employees }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    employeeId: '',
    status: 'PRESENT' as 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE',
    checkIn: '',
    checkOut: '',
    note: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleQuickAction = async (status: 'PRESENT' | 'LATE') => {
    if (!formData.employeeId) {
      setError('Veuillez sélectionner un employé')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const now = new Date()
    const result = await recordAttendanceAction({
      employeeId: parseInt(formData.employeeId),
      date: now,
      checkIn: now,
      status,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`✓ Pointage enregistré pour ${employees.find(e => e.id === parseInt(formData.employeeId))?.firstName}`)
      setFormData(prev => ({ ...prev, employeeId: '', note: '' }))
      router.refresh()
      
      // Effacer le message après 3 secondes
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.employeeId) {
      setError('Veuillez sélectionner un employé')
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    const result = await recordAttendanceAction({
      employeeId: parseInt(formData.employeeId),
      date: new Date(),
      checkIn: formData.checkIn ? new Date(formData.checkIn) : undefined,
      checkOut: formData.checkOut ? new Date(formData.checkOut) : undefined,
      status: formData.status,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Pointage enregistré avec succès')
      setFormData({
        employeeId: '',
        status: 'PRESENT',
        checkIn: '',
        checkOut: '',
        note: '',
      })
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">🕐</span>
        <h2 className="card-title">Pointage rapide</h2>
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
            <label className="form-label">Statut</label>
            <select
              className="form-control"
              name="status"
              value={formData.status}
              onChange={handleChange}
            >
              <option value="PRESENT">✓ Présent</option>
              <option value="LATE">⏰ Retard</option>
              <option value="ABSENT">✗ Absent</option>
              <option value="LEAVE">📅 En congé</option>
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Heure d'arrivée</label>
            <input
              type="datetime-local"
              className="form-control"
              name="checkIn"
              value={formData.checkIn}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="form-label">Heure de départ</label>
            <input
              type="datetime-local"
              className="form-control"
              name="checkOut"
              value={formData.checkOut}
              onChange={handleChange}
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note (optionnel)</label>
          <input
            type="text"
            className="form-control"
            name="note"
            value={formData.note}
            onChange={handleChange}
            placeholder="Justification, motif..."
          />
        </div>

        <div className="btn-group" style={{ marginTop: 16 }}>
          <button
            type="button"
            className="btn btn-success"
            onClick={() => handleQuickAction('PRESENT')}
            disabled={loading || !formData.employeeId}
          >
            ✓ Arrivée (Présent)
          </button>
          <button
            type="button"
            className="btn btn-outline"
            style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
            onClick={() => handleQuickAction('LATE')}
            disabled={loading || !formData.employeeId}
          >
            ⏰ Retard
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer'}
          </button>
        </div>
      </form>
    </div>
  )
}