'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createExpenseAction } from '@/actions/charges.actions'

interface Account {
  id: number
  code: string
  name: string
}

interface Props {
  accounts: Account[]
}

const CATEGORIES = [
  { value: 'LOYER', label: '🏠 Loyer' },
  { value: 'ELECTRICITE', label: '💡 Électricité' },
  { value: 'EAU', label: '💧 Eau' },
  { value: 'INTERNET', label: '🌐 Internet / Télécom' },
  { value: 'CARBURANT', label: '⛽ Carburant' },
  { value: 'FOURNITURES', label: '📎 Fournitures bureau' },
  { value: 'ENTRETIEN', label: '🔧 Entretien' },
  { value: 'TRANSPORT', label: '🚗 Transport / Déplacement' },
  { value: 'ASSURANCE', label: '🛡️ Assurance' },
  { value: 'SERVICES_BANCAIRES', label: '🏦 Services bancaires' },
  { value: 'AUTRES', label: '📋 Autres' },
]

// Mapping catégorie → code compte comptable
const CATEGORY_ACCOUNT_MAP: Record<string, string> = {
  LOYER: '613000',
  ELECTRICITE: '653000',
  EAU: '654000',
  INTERNET: '626000',
  CARBURANT: '652000',
  FOURNITURES: '651000',
  ENTRETIEN: '615000',
  TRANSPORT: '625000',
  ASSURANCE: '616000',
  SERVICES_BANCAIRES: '627000',
  AUTRES: '628000',
}

export default function ExpenseForm({ accounts }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const today = new Date().toISOString().split('T')[0]

  // Trouver le compte par défaut pour la catégorie LOYER
  const defaultAccount = accounts.find(a => a.code === CATEGORY_ACCOUNT_MAP['LOYER'])

  const [formData, setFormData] = useState({
    date: today,
    amount: '',
    accountId: defaultAccount?.id.toString() || '',
    category: 'LOYER',
    supplier: '',
    description: '',
    reference: '',
    period: '',
    note: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => {
      const updated = { ...prev, [name]: value }
      
      // Auto-sélection du compte comptable selon la catégorie
      if (name === 'category') {
        const accountCode = CATEGORY_ACCOUNT_MAP[value]
        const account = accounts.find(a => a.code === accountCode)
        if (account) {
          updated.accountId = account.id.toString()
        }
      }
      
      return updated
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (!formData.accountId) {
      setError('Aucun compte comptable trouvé pour cette catégorie. Vérifiez le plan comptable.')
      setLoading(false)
      return
    }

    const result = await createExpenseAction({
      date: formData.date,
      amount: parseFloat(formData.amount) || 0,
      accountId: parseInt(formData.accountId),
      category: formData.category,
      supplier: formData.supplier || undefined,
      description: formData.description,
      reference: formData.reference || undefined,
      period: formData.period || undefined,
      note: formData.note || undefined,
    })

    setLoading(false)

    if (result.error) {
      setError(result.error)
    } else {
      setSuccess('✓ Dépense enregistrée et écriture comptable générée')
      setFormData({
        date: today,
        amount: '',
        accountId: formData.accountId,
        category: 'LOYER',
        supplier: '',
        description: '',
        reference: '',
        period: '',
        note: '',
      })
      
      // Forcer le rechargement complet pour rafraîchir la liste des dépenses
      setTimeout(() => {
        window.location.reload()
      }, 500)
      
      setTimeout(() => setSuccess(''), 3000)
    }
  }

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">💸</span>
        <h2 className="card-title">Nouvelle dépense</h2>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {success && <div className="alert alert-success">{success}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date *</label>
            <input
              type="date"
              className="form-control"
              name="date"
              value={formData.date}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Catégorie *</label>
            <select
              className="form-control"
              name="category"
              value={formData.category}
              onChange={handleChange}
              required
            >
              {CATEGORIES.map(cat => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
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
                min="1"
                step="1"
                required
                placeholder="0"
            />
            <small className="text-muted fs-12">
                Saisissez le montant exact en Ariary
            </small>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Compte comptable *</label>
            <select
              className="form-control"
              name="accountId"
              value={formData.accountId}
              onChange={handleChange}
              required
            >
              <option value="">— Sélectionner —</option>
              {accounts.map(acc => (
                <option key={acc.id} value={acc.id}>
                  {acc.code} — {acc.name}
                </option>
              ))}
            </select>
            <small className="text-muted fs-12">
              Auto-sélectionné selon la catégorie
            </small>
          </div>

          <div className="form-group">
            <label className="form-label">Fournisseur / Bénéficiaire</label>
            <input
              type="text"
              className="form-control"
              name="supplier"
              value={formData.supplier}
              onChange={handleChange}
              placeholder="Nom du fournisseur"
            />
          </div>

          <div className="form-group">
            <label className="form-label">N° Facture / Référence</label>
            <input
              type="text"
              className="form-control"
              name="reference"
              value={formData.reference}
              onChange={handleChange}
              placeholder="Référence du document"
            />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Description *</label>
          <input
            type="text"
            className="form-control"
            name="description"
            value={formData.description}
            onChange={handleChange}
            required
            placeholder="Description de la dépense"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Période concernée</label>
            <input
              type="text"
              className="form-control"
              name="period"
              value={formData.period}
              onChange={handleChange}
              placeholder="Ex: Juin 2026"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Note (optionnel)</label>
            <input
              type="text"
              className="form-control"
              name="note"
              value={formData.note}
              onChange={handleChange}
              placeholder="Commentaire"
            />
          </div>
        </div>

        <div className="btn-group" style={{ marginTop: 16 }}>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading || !formData.amount || !formData.description}
          >
            {loading ? 'Enregistrement...' : '✓ Enregistrer la dépense'}
          </button>
        </div>
      </form>
    </div>
  )
}