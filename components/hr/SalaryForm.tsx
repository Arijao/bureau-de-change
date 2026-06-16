'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { generateSalaryAction, calculateCnapsAction } from '@/actions/hr.actions'

interface Employee {
  id: number
  firstName: string
  lastName: string
  baseSalary: number
  position: string | null
}

interface Props {
  employees: Employee[]
}

export default function SalaryForm({ employees }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    employeeId: '',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear(),
    bonuses: '0',
    manualDeductions: '0',
    note: '',
  })

  const [cnapsInfo, setCnapsInfo] = useState<{
    base: number
    employee: number
    employer: number
  } | null>(null)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      
      // Convertir month et year en nombres
      if (name === 'month') {
        updated.month = parseInt(value) || new Date().getMonth() + 1
      }
      if (name === 'year') {
        updated.year = parseInt(value) || new Date().getFullYear()
      }
      
      return updated
    })
  }

  // Recalculer CNaPS automatiquement quand l'employé ou les primes changent
  useEffect(() => {
    if (selectedEmployee) {
      const grossSalary = selectedEmployee.baseSalary + parseFloat(formData.bonuses || '0')
      if (grossSalary > 0) {
        calculateCnapsAction(grossSalary).then(setCnapsInfo)
      } else {
        setCnapsInfo(null)
      }
    } else {
      setCnapsInfo(null)
    }
  }, [formData.employeeId, formData.bonuses, employees])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await generateSalaryAction({
      employeeId: parseInt(formData.employeeId),
      month: formData.month,
      year: formData.year,
      bonuses: parseFloat(formData.bonuses) || 0,
      manualDeductions: parseFloat(formData.manualDeductions) || 0,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Bulletin de salaire généré avec succès')
      setFormData({
        employeeId: '',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        bonuses: '0',
        manualDeductions: '0',
        note: '',
      })
      setCnapsInfo(null)
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  const selectedEmployee = employees.find(e => e.id === parseInt(formData.employeeId))

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-green">💰</span>
        <h2 className="card-title">Générer un bulletin de salaire</h2>
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
            <label className="form-label">Mois *</label>
            <select
              className="form-control"
              name="month"
              value={formData.month}
              onChange={handleChange}
              required
            >
              {Array.from({ length: 12 }, (_, i) => (
                <option key={i + 1} value={i + 1}>
                  {new Date(2000, i).toLocaleDateString('fr-FR', { month: 'long' })}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Année *</label>
            <input
              type="number"
              className="form-control"
              name="year"
              value={formData.year}
              onChange={handleChange}
              min="2020"
              max="2100"
              required
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Salaire de base</label>
            <input
              type="text"
              className="form-control"
              readOnly
              disabled={!selectedEmployee}
              value={selectedEmployee ? `${selectedEmployee.baseSalary.toLocaleString('fr-FR')} Ar` : '—'}
              placeholder="Sélectionnez un employé"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Primes (Ar)</label>
            <input
              type="number"
              className="form-control"
              name="bonuses"
              value={formData.bonuses}
              onChange={handleChange}
              min="0"
              step="1000"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Déductions manuelles (Ar)</label>
            <input
              type="number"
              className="form-control"
              name="manualDeductions"
              value={formData.manualDeductions}
              onChange={handleChange}
              min="0"
              step="1000"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note (optionnel)</label>
          <textarea
            className="form-control"
            name="note"
            value={formData.note}
            onChange={handleChange}
            rows={2}
            placeholder="Commentaires sur le bulletin..."
          />
        </div>

        {selectedEmployee && (
          <div className="info-box" style={{ marginBottom: 16 }}>
            <div className="ib-row">
              <span className="ib-label">Salaire brut</span>
              <span className="ib-value">
                {(selectedEmployee.baseSalary + parseFloat(formData.bonuses || '0')).toLocaleString('fr-FR')} Ar
              </span>
            </div>
            {cnapsInfo && cnapsInfo.employee > 0 && (
              <>
                <div className="ib-row">
                  <span className="ib-label">CNaPS salariale (1%)</span>
                  <span className="ib-value text-red">
                    - {cnapsInfo.employee.toLocaleString('fr-FR')} Ar
                  </span>
                </div>
                <div className="ib-row">
                  <span className="ib-label">CNaPS patronale (13%)</span>
                  <span className="ib-value text-muted">
                    {cnapsInfo.employer.toLocaleString('fr-FR')} Ar (charge employeur)
                  </span>
                </div>
              </>
            )}
            <div className="ib-row">
              <span className="ib-label">Autres déductions</span>
              <span className="ib-value text-amber">
                (Avances et sanctions calculées automatiquement)
              </span>
            </div>
            <div className="ib-row ib-total">
              <span className="ib-label">Salaire net estimé</span>
              <span className="ib-value ib-value-big text-green">
                {(
                  selectedEmployee.baseSalary
                  + parseFloat(formData.bonuses || '0')
                  - (cnapsInfo?.employee || 0)
                  - parseFloat(formData.manualDeductions || '0')
                ).toLocaleString('fr-FR')} Ar
                <span className="text-muted fs-12" style={{ marginLeft: 8 }}>
                  (hors avances/sanctions)
                </span>
              </span>
            </div>
          </div>
        )}

        <div className="btn-group">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.employeeId}
            title={!formData.employeeId ? "Veuillez sélectionner un employé" : ""}
          >
            {loading ? 'Génération...' : '✓ Générer le bulletin'}
          </button>
        </div>
      </form>
    </div>
  )
}