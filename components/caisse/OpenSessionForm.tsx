'use client'

/**
 *
 * Formulaire d'ouverture d'une session de caisse.
 *
 * Comportement (Q2 — Hybride) :
 *  - Si une session précédente existe, ses soldes de clôture sont pré-chargés
 *  - Le caissier peut modifier chaque montant et saisir le détail par coupure
 *  - Sans session précédente (premier démarrage) : saisie manuelle des soldes
 */

import { useState, useEffect, useTransition } from 'react'
import { useRouter }               from 'next/navigation'
import { openSessionAction, getPreviousBalancesAction } from '@/actions/cash-session.actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface DenominationCategory {
  id:           number
  name:         string
  denominations: string   // JSON ou CSV
  active:       boolean
}

interface CurrencyData {
  id:     number
  code:   string
  name:   string
  flag:   string
  symbol: string | null
  denominationCategories: DenominationCategory[]
}

interface LastClosed {
  id:        string
  sessionNo: string
  closedAt:  string | null
  user:      { name: string }
  balances:  Array<{
    balanceType: string
    amount:      number
    currency:    { id: number; code: string }
    countDetails: Array<{ denomination: number; quantity: number }>
  }>
}

interface Props {
  user:       { id: string; name: string; role: string }
  lastClosed: LastClosed | null
  currencies: CurrencyData[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseDenominations(str: string): number[] {
  try {
    const arr = JSON.parse(str)
    if (Array.isArray(arr)) return arr.map(Number).filter(n => n > 0).sort((a, b) => b - a)
  } catch {}
  return str.split(',').map(s => Number(s.trim())).filter(n => n > 0).sort((a, b) => b - a)
}

function getAvailableDenominations(currency: CurrencyData): number[] {
  return currency.denominationCategories
    .flatMap(cat => parseDenominations(cat.denominations))
    .filter((d, i, arr) => arr.indexOf(d) === i)
    .sort((a, b) => b - a)
}

function computeTotal(rows: Array<{ denomination: number; quantity: number }>): number {
  return rows.reduce((s, r) => s + r.denomination * r.quantity, 0)
}

// ── État initial des soldes ───────────────────────────────────────────────────

function buildInitialBalances(currencies: CurrencyData[]) {
  return currencies.map(c => ({
    currencyId:    c.id,
    currencyCode:  c.code,
    currencyFlag:  c.flag,
    amount:        0,
    denominations: getAvailableDenominations(c).map(d => ({ denomination: d, quantity: 0 })),
    showDetail:    false,
    hasDenominations: getAvailableDenominations(c).length > 0,
  }))
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function OpenSessionForm({ user, lastClosed, currencies }: Props) {
  const router          = useRouter()
  const [isPending, startTransition] = useTransition()

  const [balances, setBalances]                   = useState(() => buildInitialBalances(currencies))
  const [openingNote, setOpeningNote]             = useState('')
  const [previousSessionId, setPreviousSessionId] = useState<string | null>(null)
  const [loadingInherit, setLoadingInherit]       = useState(false)
  const [error, setError]                         = useState<string | null>(null)
  const [inheritApplied, setInheritApplied]       = useState(false)
  const [inheritedAmounts, setInheritedAmounts]   = useState<Record<number, number>>({}) 

  // ── Héritage des soldes de la session précédente (Q2) ────────────────────

  async function handleInheritPrevious() {
    if (!lastClosed) return
    setLoadingInherit(true)
    setError(null)

    const result = await getPreviousBalancesAction(lastClosed.id)
    setLoadingInherit(false)

    if ('error' in result) { setError(result.error ?? 'Erreur'); return }

    const prev = result.balances ?? []
    const newInheritedAmounts: Record<number, number> = {}

    setBalances(cur => cur.map(b => {
      const match = prev.find(p => p.currencyId === b.currencyId)
      if (!match) return b

      newInheritedAmounts[b.currencyId] = match.amount 
      const denoms = match.denominations ?? []
      const newDenoms = b.denominations.map(d => {
        const found = denoms.find((dd: { denomination: number; quantity: number }) => dd.denomination === d.denomination)
        return found ? { ...d, quantity: found.quantity } : d
      })

      return {
        ...b,
        amount:    match.amount,
        denominations: newDenoms,
        showDetail: denoms.length > 0,
      }
    }))

    setInheritedAmounts(newInheritedAmounts)
    setPreviousSessionId(lastClosed.id)
    setInheritApplied(true)
  }

  // ── Mise à jour quantité d'une coupure ────────────────────────────────────

  function updateDenom(currencyIdx: number, denomIdx: number, qty: number) {
    setBalances(prev => prev.map((b, i) => {
      if (i !== currencyIdx) return b
      const newDenoms = b.denominations.map((d, j) =>
        j === denomIdx ? { ...d, quantity: Math.max(0, qty) } : d
      )
      return { ...b, denominations: newDenoms, amount: computeTotal(newDenoms) }
    }))
  }

  function updateAmount(currencyIdx: number, val: number) {
    setBalances(prev => prev.map((b, i) =>
      i !== currencyIdx ? b : { ...b, amount: Math.max(0, val) }
    ))
  }

  function toggleDetail(currencyIdx: number) {
    setBalances(prev => prev.map((b, i) =>
      i !== currencyIdx ? b : { ...b, showDetail: !b.showDetail }
    ))
  }

  // ── Soumission ────────────────────────────────────────────────────────────

  function handleSubmit() {
    setError(null)

    // ── Validation : Justification obligatoire en cas d'écart ──────────
    if (inheritApplied && openingNote.trim() === '') {
      let hasDiscrepancy = false
      for (const b of balances) {
        const inherited = inheritedAmounts[b.currencyId]
        if (inherited !== undefined && inherited !== b.amount) {
          hasDiscrepancy = true
          break
        }
      }
      if (hasDiscrepancy) {
        setError("⚠️ Les soldes diffèrent de la session précédente. Une justification est obligatoire dans la note d'ouverture.")
        return
      }
    }

    const openingBalances = balances
      .filter(b => b.amount > 0 || b.denominations.some(d => d.quantity > 0))
      .map(b => ({
        currencyId: b.currencyId,
        amount:     b.hasDenominations
                      ? computeTotal(b.denominations)
                      : b.amount,
        denominations: b.hasDenominations
                         ? b.denominations.filter(d => d.quantity > 0)
                         : undefined,
      }))

    startTransition(async () => {
      const result = await openSessionAction({
        openingNote:       openingNote || undefined,
        previousSessionId: previousSessionId ?? undefined,
        openingBalances,
      })

      if ('error' in result && result.error) {
        setError(result.error)
        return
      }

      router.refresh()
    })
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 680 }}>

      {/* Alerte : pas de session ouverte */}
      <div style={{
        background: '#fff7ed', border: '1px solid #fed7aa',
        borderRadius: 10, padding: '14px 18px', marginBottom: 24,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <span style={{ fontSize: 20 }}>⚠️</span>
        <div>
          <p style={{ fontWeight: 600, color: '#92400e', margin: 0, fontSize: 14 }}>
            Aucune session ouverte
          </p>
          <p style={{ color: '#b45309', margin: '2px 0 0', fontSize: 12 }}>
            Vous devez ouvrir une session pour créer des transactions.
          </p>
        </div>
      </div>

      {/* Passation depuis session précédente */}
      {lastClosed && (
        <div style={{
          background: '#f0f9ff', border: '1px solid #bae6fd',
          borderRadius: 10, padding: '14px 18px', marginBottom: 20,
        }}>
          <p style={{ margin: '0 0 10px', fontSize: 13, color: '#075985', fontWeight: 600 }}>
            💼 Passation disponible — Session {lastClosed.sessionNo}
          </p>
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#0369a1' }}>
            Caissier précédent : <strong>{lastClosed.user.name}</strong>
            {lastClosed.closedAt && ` — clôturée le ${new Date(lastClosed.closedAt).toLocaleString('fr-FR', { day:'2-digit', month:'2-digit', hour:'2-digit', minute:'2-digit' })}`}
          </p>

          {inheritApplied ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#16a34a', fontWeight: 600, fontSize: 13 }}>
                ✓ Soldes hérités — modifiez-les ci-dessous si nécessaire
              </span>
              <button
                type="button"
                onClick={() => { setBalances(buildInitialBalances(currencies)); setInheritApplied(false); setPreviousSessionId(null); setInheritedAmounts({}) }}
                style={{ fontSize: 11, color: '#6b7280', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
              >
                Réinitialiser
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleInheritPrevious}
              disabled={loadingInherit}
              style={{ fontSize: 13 }}
            >
              {loadingInherit ? 'Chargement…' : '↙ Hériter des soldes de clôture'}
            </button>
          )}
        </div>
      )}

      {/* Soldes d'ouverture par devise */}
      <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
        <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>
            Soldes d'ouverture par devise
          </h3>
          <p style={{ margin: '2px 0 0', fontSize: 11, color: '#9ca3af' }}>
            Saisissez les montants comptés en caisse à l'ouverture du poste
          </p>
        </div>

        <div style={{ padding: '8px 0' }}>
          {balances.map((b, ci) => (
            <div key={b.currencyId} style={{ borderBottom: '1px solid #f3f4f6' }}>

              {/* Ligne principale */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px',
              }}>
                <span style={{ fontSize: 20, minWidth: 28 }}>{b.currencyFlag}</span>
                <span style={{ fontWeight: 600, color: '#374151', minWidth: 48 }}>{b.currencyCode}</span>

                {b.hasDenominations ? (
                  /* Montant calculé depuis les coupures */
                  <span style={{ flex: 1, fontWeight: 700, color: '#111827', fontSize: 15 }}>
                    {computeTotal(b.denominations).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                  </span>
                ) : (
                  /* Saisie directe du montant */
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={b.amount || ''}
                    onChange={e => updateAmount(ci, parseFloat(e.target.value) || 0)}
                    placeholder="0.00"
                    style={{
                      flex: 1, padding: '6px 10px', border: '1px solid #d1d5db',
                      borderRadius: 6, fontSize: 14, fontWeight: 600, textAlign: 'right',
                    }}
                  />
                )}

                {b.hasDenominations && (
                  <button
                    type="button"
                    onClick={() => toggleDetail(ci)}
                    style={{
                      background: b.showDetail ? '#f3f4f6' : 'none',
                      border: '1px solid #d1d5db', borderRadius: 6,
                      padding: '4px 10px', fontSize: 11, cursor: 'pointer', color: '#6b7280',
                    }}
                  >
                    {b.showDetail ? '▲ Coupures' : '▼ Coupures'}
                  </button>
                )}
              </div>

              {/* Détail par coupure */}
              {b.hasDenominations && b.showDetail && (
                <div style={{
                  background: '#fafafa', borderTop: '1px solid #f3f4f6',
                  padding: '10px 16px 12px 60px',
                }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: '6px 12px', alignItems: 'center' }}>
                    {b.denominations.map((d, di) => (
                      <>
                        <span key={`lbl-${di}`} style={{ fontSize: 12, color: '#6b7280', textAlign: 'right', minWidth: 60 }}>
                          {d.denomination.toLocaleString('fr-FR')} ×
                        </span>
                        <input
                          key={`qty-${di}`}
                          type="number"
                          min="0"
                          value={d.quantity || ''}
                          onChange={e => updateDenom(ci, di, parseInt(e.target.value) || 0)}
                          placeholder="0"
                          style={{
                            padding: '4px 8px', border: '1px solid #d1d5db',
                            borderRadius: 4, fontSize: 13, textAlign: 'center',
                            maxWidth: 80,
                          }}
                        />
                        <span key={`tot-${di}`} style={{ fontSize: 12, color: '#374151', minWidth: 90, textAlign: 'right' }}>
                          = {(d.denomination * d.quantity).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        </span>
                      </>
                    ))}
                  </div>
                  <div style={{
                    marginTop: 8, paddingTop: 8, borderTop: '1px dashed #e5e7eb',
                    display: 'flex', justifyContent: 'flex-end', gap: 8,
                    fontSize: 13, fontWeight: 700, color: '#111827',
                  }}>
                    Total : {computeTotal(b.denominations).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} {b.currencyCode}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Note d'ouverture */}
      <div style={{ marginBottom: 20 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 6 }}>
          Note d'ouverture (optionnelle)
        </label>
        <textarea
          value={openingNote}
          onChange={e => setOpeningNote(e.target.value)}
          placeholder="Ex : Reprise de caisse normale, soldes transmis par le caissier A..."
          rows={2}
          style={{
            width: '100%', padding: '8px 12px', border: '1px solid #d1d5db',
            borderRadius: 8, fontSize: 13, resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      {/* Erreur */}
      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca',
          borderRadius: 8, padding: '10px 14px', marginBottom: 16,
          color: '#dc2626', fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Bouton submit */}
      <button
        type="button"
        className="btn btn-primary"
        onClick={handleSubmit}
        disabled={isPending}
        style={{ width: '100%', padding: '13px 24px', fontSize: 15, fontWeight: 700 }}
      >
        {isPending ? 'Ouverture en cours…' : '✓ Ouvrir ma session'}
      </button>

    </div>
  )
}
