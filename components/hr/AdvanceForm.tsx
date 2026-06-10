'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestAdvanceAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function AdvanceForm({ employees }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    employeeId: '',
    amount: '',
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

    const result = await requestAdvanceAction({
      employeeId: parseInt(formData.employeeId),
      amount: parseFloat(formData.amount) || 0,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Demande d\'avance enregistrée')
      setFormData({ employeeId: '', amount: '', note: '' })
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-amber">💰</span>
        <h2 className="card-title">Nouvelle demande d'avance</h2>
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
            <label className="form-label">Montant (Ar) *</label>
            <input
              type="number"
              className="form-control"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              min="1000"
              step="1000"
              required
              placeholder="0"
            />
          </div>
        </div>

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
            disabled={loading || !formData.employeeId || !formData.amount}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer la demande'}
          </button>
        </div>
      </form>
    </div>
  )
}