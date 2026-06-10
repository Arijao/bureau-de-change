'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { addSanctionAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function SanctionForm({ employees }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'WARNING' as 'WARNING' | 'SUSPENSION' | 'FINANCIAL',
    amount: '0',
    reason: '',
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

    const result = await addSanctionAction({
      employeeId: parseInt(formData.employeeId),
      type: formData.type,
      amount: parseFloat(formData.amount) || 0,
      reason: formData.reason,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Sanction enregistrée')
      setFormData({
        employeeId: '',
        type: 'WARNING',
        amount: '0',
        reason: '',
        note: '',
      })
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-red">⚠️</span>
        <h2 className="card-title">Nouvelle sanction</h2>
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
            <label className="form-label">Type de sanction *</label>
            <select
              className="form-control"
              name="type"
              value={formData.type}
              onChange={handleChange}
              required
            >
              <option value="WARNING">⚠️ Avertissement</option>
              <option value="SUSPENSION"> Suspension</option>
              <option value="FINANCIAL">💰 Sanction financière</option>
            </select>
          </div>
        </div>

        {formData.type === 'FINANCIAL' && (
          <div className="form-group">
            <label className="form-label">Montant (Ar) *</label>
            <input
              type="number"
              className="form-control"
              name="amount"
              value={formData.amount}
              onChange={handleChange}
              min="0"
              step="1000"
              required
            />
          </div>
        )}

        <div className="form-group">
          <label className="form-label">Motif *</label>
          <textarea
            className="form-control"
            name="reason"
            value={formData.reason}
            onChange={handleChange}
            rows={2}
            required
            placeholder="Description de la sanction..."
          />
        </div>

        <div className="form-group">
          <label className="form-label">Note additionnelle (optionnel)</label>
          <input
            type="text"
            className="form-control"
            name="note"
            value={formData.note}
            onChange={handleChange}
            placeholder="Commentaires supplémentaires..."
          />
        </div>

        <div className="btn-group">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.employeeId || !formData.reason}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer la sanction'}
          </button>
        </div>
      </form>
    </div>
  )
}