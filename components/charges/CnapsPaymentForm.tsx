'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { payCnapsAction } from '@/actions/charges.actions'
import { formatMGA } from '@/lib/utils'

interface Props {
  currentDebt: number
}

export default function CnapsPaymentForm({ currentDebt }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const today = new Date()
  const defaultPeriod = today.toLocaleDateString('fr-FR', {
    month: 'long',
    year: 'numeric',
  })

  const [formData, setFormData] = useState({
    employeePart: '',
    employerPart: '',
    period: defaultPeriod,
  })

  const total = (parseFloat(formData.employeePart) || 0) + (parseFloat(formData.employerPart) || 0)

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const employeePart = parseFloat(formData.employeePart) || 0
    const employerPart = parseFloat(formData.employerPart) || 0
    const amount = employeePart + employerPart

    if (amount <= 0) {
      setError('Le montant total doit être supérieur à 0')
      setLoading(false)
      return
    }

    if (amount > currentDebt) {
      setError(`Le montant (${formatMGA(amount)}) dépasse la dette actuelle (${formatMGA(currentDebt)})`)
      setLoading(false)
      return
    }

    const result = await payCnapsAction({
      amount,
      employeePart,
      employerPart,
      period: formData.period,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess(`✓ Versement CNaPS de ${formatMGA(amount)} enregistré pour ${formData.period}`)
      setFormData({
        employeePart: '',
        employerPart: '',
        period: defaultPeriod,
      })
      router.refresh()
      setTimeout(() => setSuccess(''), 5000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-green">💰</span>
        <h2 className="card-title">Versement CNaPS</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <div className="info-box" style={{ marginBottom: 16 }}>
        <div className="ib-row">
          <span className="ib-label">Dette CNaPS actuelle</span>
          <span className="ib-value text-amber">{formatMGA(currentDebt)}</span>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Part salariale (Ar)</label>
            <input
              type="number"
              className="form-control"
              name="employeePart"
              value={formData.employeePart}
              onChange={handleChange}
              min="0"
              step="100"
              placeholder="0"
            />
            <small className="text-muted fs-12">Retenues sur salaires</small>
          </div>

          <div className="form-group">
            <label className="form-label">Part patronale (Ar)</label>
            <input
              type="number"
              className="form-control"
              name="employerPart"
              value={formData.employerPart}
              onChange={handleChange}
              min="0"
              step="100"
              placeholder="0"
            />
            <small className="text-muted fs-12">Charge employeur</small>
          </div>

          <div className="form-group">
            <label className="form-label">Période</label>
            <input
              type="text"
              className="form-control"
              name="period"
              value={formData.period}
              onChange={handleChange}
              placeholder="Ex: Juin 2026"
            />
          </div>
        </div>

        {total > 0 && (
          <div className="info-box" style={{ marginBottom: 16 }}>
            <div className="ib-row ib-total">
              <span className="ib-label">Total à verser</span>
              <span className="ib-value ib-value-big text-green">{formatMGA(total)}</span>
            </div>
          </div>
        )}

        <div className="btn-group">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || total <= 0}
          >
            {loading ? 'Traitement...' : '✓ Enregistrer le versement'}
          </button>
        </div>
      </form>
    </div>
  )
}