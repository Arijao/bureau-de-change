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
  const [searchTerm, setSearchTerm] = useState('')
  const [detailExpense, setDetailExpense] = useState<Expense | null>(null)

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

  const filtered = expenses.filter(e => {
    if (!searchTerm.trim()) return true
    const q = searchTerm.toLowerCase()
    return (
      e.description.toLowerCase().includes(q) ||
      (e.supplier ?? '').toLowerCase().includes(q) ||
      (e.reference ?? '').toLowerCase().includes(q) ||
      (e.note ?? '').toLowerCase().includes(q) ||
      (e.period ?? '').toLowerCase().includes(q) ||
      (CATEGORY_LABELS[e.category] ?? e.category).toLowerCase().includes(q) ||
      e.account.code.includes(q) ||
      e.account.name.toLowerCase().includes(q) ||
      new Date(e.date).toLocaleDateString('fr-FR').includes(q)
    )
  })

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

  const total = filtered.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-icon card-icon-blue">📋</span>
        <h2 className="card-title">Historique des dépenses</h2>
        <span className="text-muted fs-12" style={{ marginLeft: 'auto' }}>
          {filtered.length} / {expenses.length} dépense(s) — Total : {formatMGA(total)}
        </span>
      </div>

      <div style={{ marginBottom: 12 }}>
        <input
          className="form-control"
          type="text"
          placeholder="🔍 Rechercher par description, fournisseur, référence, catégorie, note…"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
        />
        {searchTerm.trim() !== '' && filtered.length === 0 && (
          <div className="text-muted fs-12" style={{ marginTop: 6 }}>
            Aucun résultat pour « {searchTerm} »
          </div>
        )}
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
            {filtered.map((expense) => (
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
                <td style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setDetailExpense(expense)}
                    title="Voir les détails"
                  >
                    👁️
                  </button>
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

      {detailExpense && (
        <div className="modal-overlay" onClick={() => setDetailExpense(null)}>
          <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">📋 Détail de la dépense</h3>
              <button className="modal-close" onClick={() => setDetailExpense(null)}>×</button>
            </div>
            <div className="info-box">
              <div className="ib-row">
                <span className="ib-label">Date</span>
                <span className="ib-value">{new Date(detailExpense.date).toLocaleDateString('fr-FR')}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Catégorie</span>
                <span className="ib-value">{CATEGORY_LABELS[detailExpense.category] || detailExpense.category}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Description</span>
                <span className="ib-value">{detailExpense.description}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Montant</span>
                <span className="ib-value fw-600 text-red">{formatMGA(detailExpense.amount)}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Fournisseur</span>
                <span className="ib-value">{detailExpense.supplier || '—'}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">N° Référence</span>
                <span className="ib-value">{detailExpense.reference || '—'}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Période</span>
                <span className="ib-value">{detailExpense.period || '—'}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Note</span>
                <span className="ib-value">{detailExpense.note || '—'}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Compte comptable</span>
                <span className="ib-value">{detailExpense.account.code} — {detailExpense.account.name}</span>
              </div>
            </div>
            <div className="btn-group mt-16">
              <button className="btn btn-outline btn-block" onClick={() => setDetailExpense(null)}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}