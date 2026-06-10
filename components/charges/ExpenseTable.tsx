'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { deleteExpenseAction } from '@/actions/charges.actions'
import { formatMGA } from '@/lib/utils'

interface Account {
  id: number
  code: string
  name: string
}

import type { Expense } from '@/services/charges.service'

interface Account {
  id: number
  code: string
  name: string
}

interface Props {
  expenses: Expense[]
}

const CATEGORY_LABELS: Record<string, string> = {
  LOYER: '🏠 Loyer',
  ELECTRICITE: '💡 Électricité',
  EAU: '💧 Eau',
  INTERNET: '🌐 Internet',
  CARBURANT: '⛽ Carburant',
  FOURNITURES: '📎 Fournitures',
  ENTRETIEN: '🔧 Entretien',
  TRANSPORT: '🚗 Transport',
  ASSURANCE: '🛡️ Assurance',
  SERVICES_BANCAIRES: '🏦 Banque',
  AUTRES: '📋 Autres',
}

export default function ExpenseTable({ expenses }: Props) {
  const router = useRouter()
  const [loadingId, setLoadingId] = useState<number | null>(null)

  const handleDelete = async (id: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette dépense ?\n\n⚠️ L\'écriture comptable associée ne sera PAS supprimée automatiquement.')) {
      return
    }

    setLoadingId(id)
    const result = await deleteExpenseAction(id)
    setLoadingId(null)

    if (result.error) {
      alert(`Erreur : ${result.error}`)
    } else {
      router.refresh()
    }
  }

  if (expenses.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">💸</div>
          <h3>Aucune dépense enregistrée</h3>
          <p className="text-muted">
            Utilisez le formulaire ci-dessus pour saisir une dépense
          </p>
        </div>
      </div>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📋</span>
        <h2 className="card-title">Historique des dépenses</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {expenses.length} dépense(s) — Total : {formatMGA(total)}
        </span>
      </div>

      <div className="table-responsive">
        <table className="table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Catégorie</th>
              <th>Description</th>
              <th>Fournisseur</th>
              <th>Compte</th>
              <th className="text-right">Montant</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map((expense) => (
              <tr key={expense.id}>
                <td>
                  {new Date(expense.date).toLocaleDateString('fr-FR')}
                </td>
                <td>
                  <span className="chip chip-outline" style={{ fontSize: 11 }}>
                    {CATEGORY_LABELS[expense.category] || expense.category}
                  </span>
                </td>
                <td>
                  <div style={{ fontWeight: 500 }}>{expense.description}</div>
                  {expense.period && (
                    <div className="text-muted fs-12">Période : {expense.period}</div>
                  )}
                </td>
                <td className="text-muted">
                  {expense.supplier || '—'}
                </td>
                <td>
                  <span className="text-muted fs-12">
                    {expense.account.code}
                  </span>
                </td>
                <td className="text-right fw-600 text-red">
                  {formatMGA(expense.amount)}
                </td>
                <td className="text-right">
                  <button
                    className="btn btn-sm btn-outline"
                    style={{ borderColor: 'var(--red)', color: 'var(--red)' }}
                    onClick={() => handleDelete(expense.id)}
                    disabled={loadingId === expense.id}
                    title="Supprimer"
                  >
                    {loadingId === expense.id ? '...' : '🗑️'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}