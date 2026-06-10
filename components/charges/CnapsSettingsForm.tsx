'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { updateCnapsSettingsAction } from '@/actions/charges.actions'

interface HrSettings {
  id: number
  cnapsEnabled: boolean
  cnapsEmployeeRate: number
  cnapsEmployerRate: number
  cnapsCeiling: number
  ostieEnabled: boolean
  ostieRate: number
}

interface Props {
  settings: HrSettings
}

export default function CnapsSettingsForm({ settings }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [formData, setFormData] = useState({
    cnapsEnabled: settings.cnapsEnabled,
    cnapsEmployeeRate: (settings.cnapsEmployeeRate * 100).toString(),
    cnapsEmployerRate: (settings.cnapsEmployerRate * 100).toString(),
    cnapsCeiling: settings.cnapsCeiling.toString(),
    ostieEnabled: settings.ostieEnabled,
    ostieRate: (settings.ostieRate * 100).toString(),
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    const result = await updateCnapsSettingsAction({
      cnapsEnabled: formData.cnapsEnabled,
      cnapsEmployeeRate: parseFloat(formData.cnapsEmployeeRate) / 100,
      cnapsEmployerRate: parseFloat(formData.cnapsEmployerRate) / 100,
      cnapsCeiling: parseFloat(formData.cnapsCeiling),
      ostieEnabled: formData.ostieEnabled,
      ostieRate: parseFloat(formData.ostieRate) / 100,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Paramètres CNaPS mis à jour')
      router.refresh()
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-amber">️</span>
        <h2 className="card-title">Configuration CNaPS</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                name="cnapsEnabled"
                checked={formData.cnapsEnabled}
                onChange={handleChange}
                style={{ marginRight: 8 }}
              />
              Activer CNaPS
            </label>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Taux salarial (%)</label>
            <input
              type="number"
              className="form-control"
              name="cnapsEmployeeRate"
              value={formData.cnapsEmployeeRate}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              required
            />
            <small className="text-muted fs-12">Part retenue sur le salaire de l'employé</small>
          </div>

          <div className="form-group">
            <label className="form-label">Taux patronal (%)</label>
            <input
              type="number"
              className="form-control"
              name="cnapsEmployerRate"
              value={formData.cnapsEmployerRate}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
              required
            />
            <small className="text-muted fs-12">Part payée par l'employeur</small>
          </div>

          <div className="form-group">
            <label className="form-label">Plafond salarial (Ar)</label>
            <input
              type="number"
              className="form-control"
              name="cnapsCeiling"
              value={formData.cnapsCeiling}
              onChange={handleChange}
              min="0"
              step="100000"
              required
            />
            <small className="text-muted fs-12">Salaire maximum pour le calcul</small>
          </div>
        </div>

        <div className="form-row" style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #e9ecef' }}>
          <div className="form-group">
            <label className="form-label">
              <input
                type="checkbox"
                name="ostieEnabled"
                checked={formData.ostieEnabled}
                onChange={handleChange}
                style={{ marginRight: 8 }}
              />
              Activer OSTIE (optionnel)
            </label>
          </div>
        </div>

        {formData.ostieEnabled && (
          <div className="form-group">
            <label className="form-label">Taux OSTIE (%)</label>
            <input
              type="number"
              className="form-control"
              name="ostieRate"
              value={formData.ostieRate}
              onChange={handleChange}
              min="0"
              max="100"
              step="0.01"
            />
          </div>
        )}

        <div className="btn-group" style={{ marginTop: 16 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer les paramètres'}
          </button>
        </div>
      </form>
    </div>
  )
}