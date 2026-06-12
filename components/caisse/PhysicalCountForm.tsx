'use client'

/**
 * components/caisse/PhysicalCountForm.tsx
 *
 * Formulaire de clôture — comptage physique par coupure (Q3).
 * Affiche un résumé de la session puis demande le comptage par devise.
 * Redirige vers /caisse/rapport/[sessionId] après clôture.
 */

import { useState, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { closeSessionAction }      from '@/actions/cash-session.actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionData {
  id:        string
  sessionNo: string
  openedAt:  string
  userId:    string
  user:      { name: string }
  _count?:   { transactions: number; expenses: number }
  balances:  Array<{
    balanceType: string
    amount:      number
    currency:    { id: number; code: string; flag: string }
  }>
}

interface CurrencyData {
  id:     number
  code:   string
  name:   string
  flag:   string
  symbol: string | null
  denominationCategories: Array<{ name: string; denominations: string; active: boolean }>
}

interface Props {
  session:    SessionData
  currencies: CurrencyData[]
  onCancel:   () => void
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDenominations(str: string): number[] {
  try {
    const arr = JSON.parse(str)
    if (Array.isArray(arr)) return arr.map(Number).filter(n => n > 0).sort((a, b) => b - a)
  } catch {}
  return str.split(',').map(s => Number(s.trim())).filter(n => n > 0).sort((a, b) => b - a)
}

function formatDuration(openedAt: string): string {
  const diff    = Date.now() - new Date(openedAt).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(minutes / 60)
  const mins    = minutes % 60
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}min`
  return `${minutes}min`
}

function fmt(n: number, code: string): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' ' + code
}

// ── Initialisation des comptages ──────────────────────────────────────────────

interface CurrencyCountState {
  currencyId:        number
  currencyCode:      string
  currencyFlag:      string
  openingBalance:    number
  hasDenominations:  boolean
  denomGroups:       Array<{ label: string; rows: Array<{ denomination: number; quantity: number }> }>
  simpleAmount:      number   // pour devises sans coupures
}

function buildCountState(currencies: CurrencyData[], session: SessionData): CurrencyCountState[] {
  return currencies.map(c => {
    const openingBal = session.balances.find(
      b => b.balanceType === 'OPENING' && b.currency.id === c.id
    )

    const groups = c.denominationCategories.map(cat => ({
      label: cat.name,
      rows:  parseDenominations(cat.denominations).map(d => ({ denomination: d, quantity: 0 })),
    })).filter(g => g.rows.length > 0)

    return {
      currencyId:       c.id,
      currencyCode:     c.code,
      currencyFlag:     c.flag,
      openingBalance:   openingBal?.amount ?? 0,
      hasDenominations: groups.length > 0,
      denomGroups:      groups,
      simpleAmount:     0,
    }
  })
}

function computeCurrencyTotal(state: CurrencyCountState): number {
  if (!state.hasDenominations) return state.simpleAmount
  return state.denomGroups.reduce(
    (sum, g) => sum + g.rows.reduce((s, r) => s + r.denomination * r.quantity, 0),
    0
  )
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function PhysicalCountForm({ session, currencies, onCancel }: Props) {
  const router    = useRouter()
  const [isPending, startTransition] = useTransition()

  const [counts, setCounts]         = useState<CurrencyCountState[]>(() => buildCountState(currencies, session))
  const [closingNote, setClosingNote] = useState('')
  const [error, setError]           = useState<string | null>(null)
  const [confirmed, setConfirmed]   = useState(false)

  // ── Mise à jour quantité ──────────────────────────────────────────────────

  function updateQty(ci: number, gi: number, ri: number, qty: number) {
    setCounts(prev => prev.map((c, i) => {
      if (i !== ci) return c
      return {
        ...c,
        denomGroups: c.denomGroups.map((g, j) =>
          j !== gi ? g : {
            ...g,
            rows: g.rows.map((r, k) =>
              k !== ri ? r : { ...r, quantity: Math.max(0, qty) }
            ),
          }
        ),
      }
    }))
  }

  function updateSimple(ci: number, val: number) {
    setCounts(prev => prev.map((c, i) =>
      i !== ci ? c : { ...c, simpleAmount: Math.max(0, val) }
    ))
  }

  // ── Soumission ────────────────────────────────────────────────────────────

  function handleSubmit() {
    setError(null)

    const physicalCounts = counts.map(c => {
      if (!c.hasDenominations) {
        return {
          currencyId:   c.currencyId,
          denominations: c.simpleAmount > 0
            ? [{ denomination: 1, quantity: c.simpleAmount }]
            : [],
        }
      }
      return {
        currencyId:   c.currencyId,
        denominations: c.denomGroups
          .flatMap(g => g.rows)
          .filter(r => r.quantity > 0),
      }
    })

    startTransition(async () => {
      const result = await closeSessionAction({
        sessionId:     session.id,
        closingNote:   closingNote || undefined,
        physicalCounts,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      router.push(`/caisse/rapport/${session.id}`)
    })
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 720 }}>

      {/* En-tête clôture */}
      <div style={{
        background: 'linear-gradient(135deg, #fff1f2 0%, #ffe4e6 100%)',
        border: '1px solid #fecdd3', borderRadius: 12, padding: 20, marginBottom: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 style={{ margin: '0 0 4px', fontSize: 17, fontWeight: 700, color: '#9f1239' }}>
              🔒 Clôture — {session.sessionNo}
            </h2>
            <p style={{ margin: 0, fontSize: 13, color: '#be123c' }}>
              Caissier : {session.user.name} · Durée : {formatDuration(session.openedAt)}
              {session._count && ` · ${session._count.transactions} transaction(s) · ${session._count.expenses} dépense(s)`}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            style={{
              background: 'none', border: '1px solid #fda4af', borderRadius: 6,
              padding: '4px 12px', fontSize: 12, cursor: 'pointer', color: '#9f1239',
            }}
          >
            ← Annuler
          </button>
        </div>
      </div>

      {/* Instructions */}
      <div style={{
        background: '#f0f9ff', border: '1px solid #bae6fd',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20, fontSize: 12, color: '#0369a1',
      }}>
        <strong>Comment procéder :</strong> Comptez physiquement les billets et pièces de chaque devise
        et saisissez les quantités ci-dessous. Le rapport calculera automatiquement les écarts.
      </div>

      {/* Comptage par devise */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
        {counts.map((c, ci) => {
          const total = computeCurrencyTotal(c)

          return (
            <div key={c.currencyId} style={{
              background: 'white', border: '1px solid #e5e7eb',
              borderRadius: 10, overflow: 'hidden',
            }}>
              {/* En-tête devise */}
              <div style={{
                padding: '10px 16px', background: '#f9fafb',
                borderBottom: '1px solid #e5e7eb',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 22 }}>{c.currencyFlag}</span>
                  <span style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>{c.currencyCode}</span>
                  {c.openingBalance > 0 && (
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>
                      (ouverture : {fmt(c.openingBalance, c.currencyCode)})
                    </span>
                  )}
                </div>
                <span style={{
                  fontWeight: 700, fontSize: 15,
                  color: total > 0 ? '#111827' : '#9ca3af',
                }}>
                  Total compté : {fmt(total, c.currencyCode)}
                </span>
              </div>

              {/* Corps */}
              <div style={{ padding: 16 }}>
                {!c.hasDenominations ? (
                  /* Saisie directe */
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: 13, color: '#6b7280', minWidth: 120 }}>
                      Montant compté :
                    </label>
                    <input
                      type="number" min="0" step="0.01"
                      value={c.simpleAmount || ''}
                      onChange={e => updateSimple(ci, parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      style={{
                        padding: '7px 12px', border: '1px solid #d1d5db',
                        borderRadius: 6, fontSize: 14, width: 160, textAlign: 'right',
                      }}
                    />
                    <span style={{ fontSize: 13, color: '#6b7280' }}>{c.currencyCode}</span>
                  </div>
                ) : (
                  /* Grille de coupures par catégorie */
                  c.denomGroups.map((g, gi) => (
                    <div key={gi} style={{ marginBottom: gi < c.denomGroups.length - 1 ? 14 : 0 }}>
                      <p style={{
                        margin: '0 0 8px', fontSize: 11, fontWeight: 600,
                        color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em',
                      }}>
                        {g.label}
                      </p>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                        gap: '6px 12px',
                      }}>
                        {g.rows.map((r, ri) => (
                          <div key={ri} style={{
                            display: 'flex', alignItems: 'center', gap: 8,
                            background: r.quantity > 0 ? '#f0fdf4' : '#fafafa',
                            border: `1px solid ${r.quantity > 0 ? '#86efac' : '#e5e7eb'}`,
                            borderRadius: 6, padding: '6px 10px',
                            transition: 'all 0.15s',
                          }}>
                            <span style={{ fontSize: 12, color: '#6b7280', minWidth: 64, textAlign: 'right' }}>
                              {r.denomination.toLocaleString('fr-FR')}
                            </span>
                            <span style={{ color: '#9ca3af', fontSize: 11 }}>×</span>
                            <input
                              type="number" min="0"
                              value={r.quantity || ''}
                              onChange={e => updateQty(ci, gi, ri, parseInt(e.target.value) || 0)}
                              placeholder="0"
                              style={{
                                width: 52, padding: '3px 6px',
                                border: '1px solid #d1d5db', borderRadius: 4,
                                fontSize: 13, textAlign: 'center',
                              }}
                            />
                            {r.quantity > 0 && (
                              <span style={{ fontSize: 11, color: '#16a34a', marginLeft: 'auto' }}>
                                = {(r.denomination * r.quantity).toLocaleString('fr-FR')}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Note de clôture */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          Note de clôture (optionnelle)
        </label>
        <textarea
          value={closingNote}
          onChange={e => setClosingNote(e.target.value)}
          placeholder="Ex : Fin de service normal, passation à Caissier B..."
          rows={2}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Confirmation */}
      <div style={{
        background: '#fefce8', border: '1px solid #fde047',
        borderRadius: 8, padding: '10px 14px', marginBottom: 20,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <input
          type="checkbox"
          id="confirm-close"
          checked={confirmed}
          onChange={e => setConfirmed(e.target.checked)}
          style={{ width: 16, height: 16, cursor: 'pointer' }}
        />
        <label htmlFor="confirm-close" style={{ fontSize: 13, color: '#713f12', cursor: 'pointer' }}>
          Je confirme avoir effectué le comptage physique et souhaite clôturer cette session.
        </label>
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16, color: '#dc2626', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary"
          disabled={isPending}
          style={{ padding: '12px 24px' }}
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isPending || !confirmed}
          className="btn btn-danger"
          style={{
            flex: 1, padding: '12px 24px', fontSize: 15, fontWeight: 700,
            opacity: !confirmed ? 0.5 : 1,
          }}
        >
          {isPending ? 'Clôture en cours…' : '🔒 Confirmer la clôture'}
        </button>
      </div>

    </div>
  )
}
