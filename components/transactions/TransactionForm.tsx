'use client'
import { useState, useEffect, useCallback } from 'react'
import { createTransactionAction } from '@/actions/transaction.actions'
import { formatMGA, formatCurrency, formatNumber } from '@/lib/utils'
import TicketModal from '@/components/ticket/TicketModal'
import AttestationModal from '@/components/ticket/AttestationModal'
import CurrencyFlag from '@/components/ui/CurrencyFlag'

interface CategoryRate { categoryId: number; buyRate: number }
interface Rate { buyRate: number; sellRate: number; categoryRates?: CategoryRate[] }
interface Stock { amount: number; alertLevel: number; isLow: boolean }
interface DenomCat { id: number; name: string; denominations: string }
interface Currency { id: number; code: string; name: string; symbol: string | null; flag: string; currentRate: Rate | null; stock: Stock | null; denominationCategories?: DenomCat[] }

interface Props {
  currencies: Currency[]
  userName: string
  bureauName: string; bureauAddress: string; bureauPhone: string; bureauFooter: string
  // Informations officielles pour les attestations
  bureauNif?: string | null
  bureauStat?: string | null
  bureauEmail?: string | null
  bureauRib?: string | null
  logoBase64?: string | null
}

export default function TransactionForm({ currencies, userName, bureauName, bureauAddress, bureauPhone, bureauFooter, bureauNif, bureauStat, bureauEmail, bureauRib, logoBase64 }: Props) {
  const [type, setType] = useState<'ACHAT' | 'VENTE'>('ACHAT')
  const [currencyId, setCurrencyId] = useState<number | ''>('')
  const [amount, setAmount] = useState('')
  const [denomInputs, setDenomInputs] = useState<Record<string, number>>({})
  const [commission, setCommission] = useState('0')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [lastTx, setLastTx] = useState<any>(null)
  const [showTicket, setShowTicket] = useState(false)
  const [showAttestation, setShowAttestation] = useState(false)

  const selectedCurrency = currencies.find(c => c.id === currencyId)
  const activeRate = selectedCurrency?.currentRate
  const stock = selectedCurrency?.stock

  const hasCategories = type === 'ACHAT' && (selectedCurrency?.denominationCategories?.length ?? 0) > 0

  let totalAmount = 0
  let totalMGAWithoutCommission = 0
  let calculatedDetails: any[] = []

  if (hasCategories && selectedCurrency && activeRate) {
    selectedCurrency.denominationCategories!.forEach(cat => {
      const catRateObj = activeRate.categoryRates?.find(cr => cr.categoryId === cat.id)
      const catBuyRate = catRateObj && catRateObj.buyRate > 0 ? catRateObj.buyRate : activeRate.buyRate

      const denoms = cat.denominations.split(',').map(d => parseFloat(d.trim())).filter(d => !isNaN(d))
      denoms.forEach(d => {
        const qty = denomInputs[`${cat.id}_${d}`] || 0
        if (qty > 0) {
          const subtotal = d * qty
          const subMGA = subtotal * catBuyRate
          totalAmount += subtotal
          totalMGAWithoutCommission += subMGA
          calculatedDetails.push({
            categoryName: cat.name,
            denomination: d,
            quantity: qty,
            rateApplied: catBuyRate,
            subtotalAmount: subtotal,
            subtotalMGA: subMGA
          })
        }
      })
    })
  }

  const standardAppliedRate = activeRate ? (type === 'ACHAT' ? activeRate.buyRate : activeRate.sellRate) : null
  const effectiveAmount = hasCategories ? totalAmount : parseFloat(amount || '0')
  const baseMGA = hasCategories ? totalMGAWithoutCommission : (effectiveAmount * (standardAppliedRate || 0))
  const mgaAmount = (effectiveAmount > 0 && standardAppliedRate !== null)
    ? (type === 'ACHAT' ? baseMGA - parseFloat(commission || '0') : baseMGA + parseFloat(commission || '0'))
    : null

  const effectiveRate = hasCategories && effectiveAmount > 0
    ? (totalMGAWithoutCommission / effectiveAmount)
    : standardAppliedRate

  const mgaCurrency = currencies.find(c => c.code === 'MGA')
  const mgaStock = mgaCurrency?.stock?.amount ?? 0

  const mgaStockError = type === 'ACHAT' && mgaAmount !== null && mgaAmount > mgaStock
    ? `Stock MGA insuffisant. Disponible: ${formatNumber(mgaStock, 0)} Ar, Requis: ${formatNumber(mgaAmount, 0)} Ar`
    : null

  // Stock validation
  const stockError = type === 'VENTE' && stock && amount && parseFloat(amount) > stock.amount
    ? `Stock insuffisant : ${formatNumber(stock.amount, 2)} ${selectedCurrency?.code} disponible`
    : null

  const handleSubmit = useCallback(async () => {
    if (!currencyId || effectiveAmount <= 0) { setError('Remplissez tous les champs ou saisissez au moins une quantité'); return }
    if (stockError) { setError(stockError); return }
    if (mgaStockError) { setError(mgaStockError); return }
    if (!effectiveRate) { setError('Taux introuvable'); return }

    setLoading(true); setError('')
    const res = await createTransactionAction({
      type,
      currencyId: currencyId as number,
      amount: effectiveAmount,
      commission: parseFloat(commission || '0'),
      note: note || undefined,
      overrideRate: hasCategories ? effectiveRate : undefined,
      details: hasCategories ? calculatedDetails : undefined
    })
    setLoading(false)
    if (res.error) { setError(res.error); return }
    setLastTx(res.transaction)
    setAmount(''); setDenomInputs({}); setNote(''); setCommission('0')
  }, [type, currencyId, effectiveAmount, commission, note, effectiveRate, stockError, hasCategories, calculatedDetails, mgaStockError])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.ctrlKey && e.key === 'Enter') handleSubmit() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSubmit])

  return (
    <div className="tx-form-grid">
      <div className="card">
        <div className="card-header"><span className="card-icon card-icon-blue">💱</span><h2 className="card-title">Nouvelle transaction</h2></div>

        {error && <div className="alert alert-error">{error}</div>}
        {lastTx && (
          <div className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span>✓ <strong>{lastTx.receiptNo}</strong> créée !</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button className="btn btn-sm btn-outline" onClick={() => setShowTicket(true)}>🧾 Ticket</button>
              {lastTx.type === 'VENTE' && (
                <button className="btn btn-sm btn-outline" onClick={() => setShowAttestation(true)} title="Générer l'attestation de change">
                  📄 Attestation
                </button>
              )}
            </div>
          </div>
        )}

        <div className="type-selector">
          <button className={`type-btn ${type === 'ACHAT' ? 'type-btn-achat' : ''}`} onClick={() => setType('ACHAT')}>📥 ACHAT <small>client donne devise</small></button>
          <button className={`type-btn ${type === 'VENTE' ? 'type-btn-vente' : ''}`} onClick={() => setType('VENTE')}>📤 VENTE <small>client donne MGA</small></button>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Devise *</label>
            <select className="form-control" value={currencyId} onChange={e => setCurrencyId(parseInt(e.target.value) || '')}>
              <option value="">— Choisir —</option>
              {currencies.map(c => (
                <option key={c.id} value={c.id}>{c.flag} {c.code} — {c.name} {c.stock?.isLow ? '⚠️' : ''}</option>
              ))}
            </select>
          </div>
          {hasCategories ? (
            <div className="form-group" style={{ gridColumn: '1 / -1' }}>
              <label className="form-label">Détail des coupures ({selectedCurrency?.code}) *</label>
              <div className="matrix-table-wrap" style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 8 }}>
                <table className="matrix-table" style={{ width: '100%', fontSize: 13, textAlign: 'left', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--slate-200)' }}>
                      <th style={{ paddingBottom: 8 }}>Coupure</th>
                      <th style={{ paddingBottom: 8 }}>Catégorie</th>
                      <th style={{ paddingBottom: 8 }}>Taux</th>
                      <th style={{ paddingBottom: 8, width: 80 }}>Quantité</th>
                      <th style={{ paddingBottom: 8, textAlign: 'right' }}>S/Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedCurrency?.denominationCategories!.map(cat => {
                      const catRateObj = activeRate?.categoryRates?.find(cr => cr.categoryId === cat.id)
                      const catBuyRate = catRateObj && catRateObj.buyRate > 0 ? catRateObj.buyRate : (activeRate?.buyRate || 0)
                      const denoms = cat.denominations.split(',').map(d => parseFloat(d.trim())).filter(d => !isNaN(d)).sort((a, b) => b - a)
                      return denoms.map(d => (
                        <tr key={`${cat.id}_${d}`} style={{ borderBottom: '1px solid var(--slate-100)' }}>
                          <td style={{ padding: '6px 0', fontWeight: 600 }}>{formatNumber(d)}</td>
                          <td style={{ padding: '6px 0', color: 'var(--slate-500)' }}>{cat.name}</td>
                          <td style={{ padding: '6px 0' }}>{formatNumber(catBuyRate)} <span style={{ fontSize: 10, color: 'var(--slate-400)' }}>Ar</span></td>
                          <td style={{ padding: '6px 0' }}>
                            <input
                              type="number" min="0" step="1"
                              style={{ width: '100%', padding: '4px 8px', border: '1px solid var(--slate-200)', borderRadius: 4, outline: 'none' }}
                              value={denomInputs[`${cat.id}_${d}`] || ''}
                              onChange={e => setDenomInputs(prev => ({ ...prev, [`${cat.id}_${d}`]: parseInt(e.target.value) || 0 }))}
                            />
                          </td>
                          <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 500 }}>
                            {formatNumber((denomInputs[`${cat.id}_${d}`] || 0) * d)}
                          </td>
                        </tr>
                      ))
                    })}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} style={{ paddingTop: 8, fontWeight: 600 }}>Total Devise</td>
                      <td style={{ paddingTop: 8, textAlign: 'right', fontWeight: 600, color: 'var(--blue)' }}>{formatNumber(effectiveAmount)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Montant ({selectedCurrency?.code || 'devise'}) *</label>
              <div className="input-addon">
                <input className="form-control" type="number" step="0.01" min="0" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
                <span className="input-addon-text">{selectedCurrency?.code || 'CCY'}</span>
              </div>
            </div>
          )}
        </div>

        {/* Rate display — read-only, always from DB */}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Taux appliqué (moyen pondéré)</label>
            <div className="input-addon">
              <input className="form-control" readOnly value={effectiveRate ? formatNumber(effectiveRate) : ''} placeholder="Automatique" />
              <span className="input-addon-text">Ar/{selectedCurrency?.code || 'CCY'}</span>
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">Commission (Ar) {hasCategories && type === 'ACHAT' ? '— déduite' : ''}</label>
            <input className="form-control" type="number" step="100" min="0" placeholder="0" value={commission} onChange={e => setCommission(e.target.value)} />
          </div>
        </div>

        <div className="form-group">
          <label className="form-label">Note (optionnel)</label>
          <input className="form-control" placeholder="Réf. client, numéro passeport..." value={note} onChange={e => setNote(e.target.value)} />
        </div>

        <button className={`btn btn-lg btn-block ${type === 'ACHAT' ? 'btn-success' : 'btn-danger'}`} onClick={handleSubmit} disabled={loading || !!stockError || !!mgaStockError}>
          {loading ? 'Traitement…' : type === 'ACHAT' ? '📥 Valider l\'Achat' : '📤 Valider la Vente'}
        </button>
        <div className="kbd-hint"><span className="kbd">Ctrl+Enter</span> pour valider rapidement</div>
      </div>

      <div className="tx-side">
        {selectedCurrency && (
          <div className="card">
            <div className="section-title">📊 <CurrencyFlag code={selectedCurrency.code} flag={selectedCurrency.flag} size={16} /> {selectedCurrency.code} — {selectedCurrency.name}</div>
            <div className="info-box">
              <div className="ib-row"><span className="ib-label">Taux achat (bureau achète)</span><span className="ib-value text-green">{activeRate ? formatNumber(activeRate.buyRate) + ' Ar' : '—'}</span></div>
              <div className="ib-row"><span className="ib-label">Taux vente (bureau vend)</span><span className="ib-value text-red">{activeRate ? formatNumber(activeRate.sellRate) + ' Ar' : '—'}</span></div>
              <div className="ib-row"><span className="ib-label">Spread</span><span className="ib-value text-amber">{activeRate ? formatNumber(activeRate.sellRate - activeRate.buyRate) + ' Ar' : '—'}</span></div>
            </div>

            <div className={`stock-info-block ${stock?.isLow ? 'stock-info-low' : ''}`} style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span className="stock-label">📦 Stock disponible</span>
                {stock?.isLow && <span className="chip chip-red" style={{ fontSize: 10 }}>⚠️ Faible</span>}
              </div>
              <div className={`stock-amount-big ${stock?.isLow ? 'text-red' : ''}`}>{stock ? formatNumber(stock.amount, 2) + ' ' + selectedCurrency.code : '—'}</div>
              {stock && <div className="stock-bar-track" style={{ marginTop: 6 }}>
                <div className={`stock-bar-fill ${stock.isLow ? 'stock-bar-low' : ''}`} style={{ width: `${Math.min(100, Math.round(stock.amount / (stock.alertLevel * 10) * 100))}%` }} />
              </div>}
              {effectiveAmount > 0 && stock && (
                <div style={{ marginTop: 6, fontSize: 12, color: effectiveAmount > stock.amount && type === 'VENTE' ? 'var(--red)' : 'var(--text2)' }}>
                  Après transaction : <strong>{formatNumber(type === 'ACHAT' ? stock.amount + effectiveAmount : stock.amount - effectiveAmount, 2)} {selectedCurrency.code}</strong>
                </div>
              )}

              {/* Affichage erreur stock MGA pour ACHAT */}
              {type === 'ACHAT' && mgaStockError && (
                <div className="alert alert-error" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
                  ⛔ {mgaStockError}
                </div>
              )}

              {stockError && <div className="alert alert-error" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>⛔ {stockError}</div>}
            </div>
          </div>
        )}

        <div className="card">
          <div className="section-title">🧮 Récapitulatif</div>
          {mgaAmount !== null && selectedCurrency && effectiveRate ? (
            <div className="info-box">
              <div className="ib-row"><span className="ib-label">Devise</span><span className="ib-value"><CurrencyFlag code={selectedCurrency.code} flag={selectedCurrency.flag} size={14} /> {formatCurrency(effectiveAmount, selectedCurrency.code)}</span></div>
              <div className="ib-row"><span className="ib-label">Taux ({type === 'ACHAT' ? (hasCategories ? 'moyen pondéré' : 'achat') : 'vente'})</span><span className="ib-value">{formatNumber(effectiveRate)} Ar/{selectedCurrency.code}</span></div>
              <div className="ib-row"><span className="ib-label">Montant brut</span><span className="ib-value">{formatMGA(baseMGA)}</span></div>
              {parseFloat(commission) > 0 && <div className="ib-row"><span className="ib-label">Commission</span><span className="ib-value">{type === 'ACHAT' ? '- ' : '+ '}{formatMGA(parseFloat(commission))}</span></div>}
              <div className="ib-row ib-total"><span className="ib-label">{type === 'ACHAT' ? 'Client reçoit' : 'Client paie'}</span><span className="ib-value ib-value-big">{formatMGA(mgaAmount)}</span></div>
            </div>
          ) : (
            <div className="empty-state" style={{ padding: '24px 0' }}><div className="empty-icon">🔢</div><div>Remplissez le formulaire</div></div>
          )}
        </div>

        <div className="hint-card"><div className="hint-title">💡 Info</div><div className="fs-12">Le taux est récupéré en temps réel depuis la base. Il ne peut pas être modifié manuellement ici — utilisez la page Devises pour mettre à jour les taux.</div></div>
      </div>

      {showTicket && lastTx && (
        <TicketModal transaction={lastTx} bureauName={bureauName} bureauAddress={bureauAddress} bureauPhone={bureauPhone} bureauFooter={bureauFooter} onClose={() => setShowTicket(false)} />
      )}

      {showAttestation && lastTx && lastTx.type === 'VENTE' && (
        <AttestationModal
          transaction={lastTx}
          bureau={{
            bureauName, bureauAddress, bureauPhone, bureauFooter,
            nif: bureauNif, stat: bureauStat, email: bureauEmail, rib: bureauRib,
            logoBase64,
          }}
          onClose={() => setShowAttestation(false)}
        />
      )}
    </div>
  )
}
