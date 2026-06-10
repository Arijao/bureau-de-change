'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createEmployeeAction } from '@/actions/hr.actions'
import {
  formatFirstName,
  formatLastName,
  formatCIN,
  formatPhoneDigits,
  formatSalary,
  parseCIN,
  parsePhone,
  parseSalary,
} from '@/lib/formatters'

interface FormData {
  firstName: string
  lastName: string
  cin: string
  phone: string
  email: string
  address: string
  sex: string
  maritalStatus: string
  numberOfChildren: string
  department: string
  position: string
  bankAccount: string
  baseSalary: string
}

interface SubmitData {
  firstName: string
  lastName: string
  cin?: string
  phone?: string
  email?: string
  address?: string
  sex?: string
  maritalStatus?: string
  numberOfChildren?: number
  department?: string
  position?: string
  bankAccount?: string
  baseSalary: number
}

export default function EmployeeForm() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [formData, setFormData] = useState<FormData>({
    firstName: '',
    lastName: '',
    cin: '',
    phone: '',
    email: '',
    address: '',
    sex: '',
    maritalStatus: '',
    numberOfChildren: '0',
    department: '',
    position: '',
    bankAccount: '',
    baseSalary: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const newData = { ...prev, [name]: value }

      switch (name) {
        case 'firstName':
          newData.firstName = formatFirstName(value)
          break
        case 'lastName':
          newData.lastName = formatLastName(value)
          break
        case 'cin':
          newData.cin = formatCIN(value)
          break
        case 'phone':
          newData.phone = formatPhoneDigits(value)
          break
        case 'baseSalary':
          newData.baseSalary = formatSalary(value)
          break
        case 'maritalStatus':
          if (value === 'CELIBATAIRE') {
            newData.numberOfChildren = '0'
          }
          break
      }

      return newData
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const submitData: SubmitData = {
      firstName: formData.firstName,
      lastName: formData.lastName,
      cin: formData.cin ? parseCIN(formData.cin) : undefined,
      phone: formData.phone ? `+261${parsePhone(formData.phone)}` : undefined,
      email: formData.email || undefined,
      address: formData.address || undefined,
      sex: formData.sex || undefined,
      maritalStatus: formData.maritalStatus || undefined,
      numberOfChildren: formData.maritalStatus === 'MARIE' ? parseInt(formData.numberOfChildren) || 0 : undefined,
      department: formData.department || undefined,
      position: formData.position || undefined,
      bankAccount: formData.bankAccount || undefined,
      baseSalary: parseSalary(formData.baseSalary),
    }

    const result = await createEmployeeAction(submitData)

    setLoading(false)
    if (result.error) {
      setError(result.error)
    } else {
      router.push('/hr/employees')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card">
      {error && <div className="alert alert-error">{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Prénom *</label>
          <input
            className="form-control"
            name="firstName"
            value={formData.firstName}
            onChange={handleChange}
            required
            placeholder="Prénom"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Nom *</label>
          <input
            className="form-control"
            name="lastName"
            value={formData.lastName}
            onChange={handleChange}
            required
            placeholder="Nom"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">CIN</label>
          <input
            className="form-control"
            name="cin"
            value={formData.cin}
            onChange={handleChange}
            placeholder="CIN"
            maxLength={15}
          />
        </div>
        <div className="form-group">
          <label className="form-label">Téléphone</label>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span
              style={{
                padding: '8px 12px',
                background: '#f3f4f6',
                border: '1px solid #d1d5db',
                borderRadius: 6,
                color: '#374151',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              +261
            </span>
            <input
              className="form-control"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              placeholder="Téléphone"
              maxLength={12}
              style={{ flex: 1 }}
            />
          </div>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Email</label>
          <input
            className="form-control"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="Email"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Adresse</label>
          <input
            className="form-control"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="Adresse"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Sexe</label>
          <select
            className="form-control"
            name="sex"
            value={formData.sex}
            onChange={handleChange}
          >
            <option value="">-- Sélectionner --</option>
            <option value="HOMME">Homme</option>
            <option value="FEMME">Femme</option>
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Situation matrimoniale</label>
          <select
            className="form-control"
            name="maritalStatus"
            value={formData.maritalStatus}
            onChange={handleChange}
          >
            <option value="">-- Sélectionner --</option>
            <option value="CELIBATAIRE">Célibataire</option>
            <option value="MARIE">Marié(e)</option>
          </select>
        </div>
      </div>

      {formData.maritalStatus === 'MARIE' && (
        <div className="form-group">
          <label className="form-label">Nombre d'enfants</label>
          <input
            className="form-control"
            name="numberOfChildren"
            type="number"
            min="0"
            value={formData.numberOfChildren}
            onChange={handleChange}
            placeholder="Nombre d'enfants"
          />
        </div>
      )}

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Poste</label>
          <input
            className="form-control"
            name="position"
            value={formData.position}
            onChange={handleChange}
            placeholder="Poste"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Service / Département</label>
          <input
            className="form-control"
            name="department"
            value={formData.department}
            onChange={handleChange}
            placeholder="Service / Département"
          />
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Compte bancaire</label>
          <input
            className="form-control"
            name="bankAccount"
            value={formData.bankAccount}
            onChange={handleChange}
            placeholder="Compte bancaire"
          />
        </div>
        <div className="form-group">
          <label className="form-label">Salaire de base (Ar) *</label>
          <input
            className="form-control"
            name="baseSalary"
            value={formData.baseSalary}
            onChange={handleChange}
            required
            placeholder="Salaire de base"
          />
        </div>
      </div>

      <div className="btn-group" style={{ marginTop: 24 }}>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Création...' : '✓ Créer l\'employé'}
        </button>
        <button
          type="button"
          className="btn btn-outline"
          onClick={() => router.back()}
        >
          Annuler
        </button>
      </div>
    </form>
  )
}