'use client'
import { useState } from 'react'
import { formatNumber, formatMGA } from '@/lib/utils'
import { addRateAction, toggleCurrencyAction, deleteCurrencyAction, createCurrencyAction, updateCurrencyAction, adjustStockAction, updateDenominationCategoriesAction, getPhysicalDenominationsAction } from '@/actions/currency.actions'

interface CategoryRate { categoryId: number; buyRate: number }
interface Rate { id: number; buyRate: number; sellRate: number; createdAt: Date; note?: string | null; user?: { name: string } | null; categoryRates?: CategoryRate[] }
interface Stock { amount: number; alertLevel: number; isLow: boolean; percentage: number }
interface DenomCat { id: number; currencyId: number; name: string; denominations: string; active: boolean }
interface CurrencyRow { id: number; code: string; name: string; symbol: string | null; flag: string; isActive: boolean; isBase: boolean; currentRate: Rate | null; stock: Stock | null; denominationCategories?: DenomCat[] }
interface RateHistRow { id: number; createdAt: Date; buyRate: number; sellRate: number; note?: string | null; currency: { flag: string; code: string }; user?: { name: string } | null }

interface Props { currencies: CurrencyRow[]; isAdmin: boolean; rateHistory: RateHistRow[] }

type Modal = 'rate' | 'add' | 'edit' | 'stock' | 'delete' | 'rateHistory' | 'categories' | null

export default function CurrenciesClient({ currencies: init, isAdmin, rateHistory }: Props) {
  const [currencies, setCurrencies] = useState(init)
  const [modal, setModal] = useState<Modal>(null)
  const [selected, setSelected] = useState<CurrencyRow | null>(null)
  const [msg, setMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [loading, setLoading] = useState(false)

  // Rate form
  const [rBuy, setRBuy] = useState(''); const [rSell, setRSell] = useState(''); const [rNote, setRNote] = useState('')
  const [rCatRates, setRCatRates] = useState<Record<number, string>>({})
  // Add form
  const [aCode, setACode] = useState(''); const [aName, setAName] = useState(''); const [aSym, setASym] = useState(''); const [aFlag, setAFlag] = useState(''); const [aBuy, setABuy] = useState(''); const [aSell, setASell] = useState(''); const [aStock, setAStock] = useState(''); const [aAlert, setAAlert] = useState('')
  // Stock form
  const [sOp, setSOp] = useState<'DEPOT' | 'RETRAIT' | 'AJUSTEMENT'>('DEPOT'); const [sAmt, setSAmt] = useState(''); const [sNote, setSNote] = useState('')
  // Edit form
  const [eName, setEName] = useState(''); const [eSym, setESym] = useState(''); const [eFlag, setEFlag] = useState('')
  // Categories form
  const [cats, setCats] = useState<Partial<DenomCat>[]>([])
  const [showDenoms, setShowDenoms] = useState(false)
  const [denomsData, setDenomsData] = useState<{ denomination: number; quantity: number }[] | null>(null)
  const [loadingDenoms, setLoadingDenoms] = useState(false)

  function toast(text: string, type: 'success' | 'error' = 'success') {
    setMsg({ text, type }); setTimeout(() => setMsg(null), 3500)
  }

  function openRate(c: CurrencyRow) {
    if (c.isBase) { toast('Le MGA est la devise de référence — taux fixe 1:1', 'error'); return }
    setSelected(c); setRBuy(String(c.currentRate?.buyRate ?? '')); setRSell(String(c.currentRate?.sellRate ?? '')); setRNote('');
    const initCatRates: Record<number, string> = {}
    c.currentRate?.categoryRates?.forEach(cr => { initCatRates[cr.categoryId] = String(cr.buyRate) })
    setRCatRates(initCatRates)
    setModal('rate')
  }
  function openStock(c: CurrencyRow) { setSelected(c); setSOp('DEPOT'); setSAmt(''); setSNote(''); setModal('stock') }
  function openEdit(c: CurrencyRow) { setSelected(c); setEName(c.name); setESym(c.symbol ?? ''); setEFlag(c.flag); setModal('edit') }
  function openCats(c: CurrencyRow) { setSelected(c); setCats(c.denominationCategories?.map(x => ({ ...x })) || []); setModal('categories') }

  async function saveRate() {
    if (!selected) return
    setLoading(true)
    const categoryRates = selected.denominationCategories?.map(c => ({ categoryId: c.id, buyRate: parseFloat(rCatRates[c.id] || '0') })).filter(cr => cr.buyRate > 0)
    const res = await addRateAction({ currencyId: selected.id, buyRate: parseFloat(rBuy), sellRate: parseFloat(rSell), note: rNote || undefined, categoryRates })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setCurrencies(prev => prev.map(c => c.id === selected.id ? { ...c, currentRate: { ...c.currentRate!, buyRate: parseFloat(rBuy), sellRate: parseFloat(rSell), id: Date.now(), createdAt: new Date(), note: rNote || null, categoryRates } } : c))
    setModal(null); toast(`Taux ${selected.code} mis à jour`)
  }

  async function saveCats() {
    if (!selected) return
    setLoading(true)
    const res = await updateDenominationCategoriesAction(selected.id, cats as any)
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(`Catégories enregistrées`); setModal(null)
    setTimeout(() => window.location.reload(), 500)
  }

  async function saveEdit() {
    if (!selected) return
    setLoading(true)
    const res = await updateCurrencyAction(selected.id, { name: eName, symbol: eSym || undefined, flag: eFlag || undefined })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setCurrencies(prev => prev.map(c => c.id === selected.id ? { ...c, name: eName, symbol: eSym || null, flag: eFlag || c.flag } : c))
    setModal(null); toast(`${selected.code} mis à jour`)
  }

  async function saveAdd() {
    setLoading(true)
    const res = await createCurrencyAction({ code: aCode, name: aName, symbol: aSym || undefined, flag: aFlag || '🏳️', buyRate: parseFloat(aBuy), sellRate: parseFloat(aSell), initialStock: parseFloat(aStock) || 0, alertLevel: parseFloat(aAlert) || undefined })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    toast(`Devise ${aCode.toUpperCase()} ajoutée`); setModal(null)
    setTimeout(() => window.location.reload(), 800)
  }

  async function saveStock() {
    if (!selected) return
    setLoading(true)
    const res = await adjustStockAction({ currencyId: selected.id, operation: sOp, amount: parseFloat(sAmt), note: sNote || undefined })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    const newAmount = sOp === 'AJUSTEMENT' ? parseFloat(sAmt) : selected.stock!.amount + (sOp === 'RETRAIT' ? -parseFloat(sAmt) : parseFloat(sAmt))
    setCurrencies(prev => prev.map(c => c.id === selected.id && c.stock ? { ...c, stock: { ...c.stock, amount: newAmount } } : c))
    setModal(null); toast(`Stock ${selected.code} mis à jour`)
  }

  async function loadDenoms() {
    if (!selected) return

    setLoadingDenoms(true)
    setShowDenoms(true)

    const res = await getPhysicalDenominationsAction(selected.id)

    setLoadingDenoms(false)

    if ('error' in res) {
      toast(String(res.error), 'error')
      setShowDenoms(false)
      return
    }

    if (!res.denominations || res.denominations.length === 0) {
      toast('Aucune donnée disponible', 'error')
      setShowDenoms(false)
      return
    }

    setDenomsData(res.denominations)
  }

  async function doToggle(c: CurrencyRow) {
    const res = await toggleCurrencyAction(c.id)
    if (res.error) { toast(res.error, 'error'); return }
    setCurrencies(prev => prev.map(x => x.id === c.id ? { ...x, isActive: !x.isActive } : x))
    toast(`${c.code} ${c.isActive ? 'désactivé' : 'activé'}`)
  }

  async function doDelete(c: CurrencyRow) {
    if (c.isBase) { toast('Impossible de supprimer la devise de référence (MGA)', 'error'); setModal(null); return }
    const res = await deleteCurrencyAction(c.id)
    if (res.error) { toast(res.error, 'error'); setModal(null); return }
    setCurrencies(prev => prev.filter(x => x.id !== c.id)); setModal(null); toast(`${c.code} supprimé`)
  }

  const spread = (b: string, s: string) => { const v = parseFloat(s) - parseFloat(b); return isNaN(v) ? '—' : formatNumber(v) }

  return (
    <div>
      <div className="page-header">
        <div><h1 className="page-title">💹 Devises & Taux</h1><p className="page-subtitle">{currencies.length} devise(s) configurée(s)</p></div>
        <div className="btn-group">
          <button className="btn btn-outline btn-sm" onClick={() => setModal('rateHistory')}>📜 Historique taux</button>
          {isAdmin && <button className="btn btn-primary" onClick={() => { setACode(''); setAName(''); setASym(''); setAFlag(''); setABuy(''); setASell(''); setAStock(''); setAAlert(''); setModal('add') }}>+ Ajouter devise</button>}
        </div>
      </div>

      {msg && <div className={`alert alert-${msg.type === 'success' ? 'success' : 'error'}`}>{msg.text}</div>}

      {/* Stock alerts */}
      {currencies.some(c => c.stock?.isLow) && (
        <div className="alert-banner">
          ⚠️ <strong>Alerte stock faible :</strong>{' '}
          {currencies.filter(c => c.stock?.isLow).map(c => `${c.flag} ${c.code} (${formatNumber(c.stock!.amount, 2)})`).join(' · ')}
        </div>
      )}

      <div className="currencies-grid">
        {currencies.map(c => {
          const stockPct = c.stock && c.stock.alertLevel > 0 ? Math.min(100, Math.round(c.stock.amount / (c.stock.alertLevel * 10) * 100)) : 100
          return (
            <div key={c.id} className={`currency-card ${!c.isActive ? 'currency-inactive' : ''}`}>
              <div className="currency-card-header">
                <span className="currency-flag">{c.flag}</span>
                <div className="currency-info">
                  <div className="currency-code">{c.code} <span className="currency-symbol">{c.symbol}</span></div>
                  <div className="currency-name">{c.name}</div>
                </div>
                {c.isBase && <span className="chip chip-blue" style={{ fontSize: 9, marginLeft: 'auto' }}>RÉF</span>}
                {!c.isActive && !c.isBase && <span className="chip chip-red" style={{ fontSize: 9, marginLeft: 'auto' }}>INACTIF</span>}
              </div>

              <div className="currency-rates">
                <div className="rate-row"><span className="rate-label">Achat</span><span className="rate-value rate-buy">{c.currentRate ? formatNumber(c.currentRate.buyRate) + ' Ar' : '—'}</span></div>
                <div className="rate-row"><span className="rate-label">Vente</span><span className="rate-value rate-sell">{c.currentRate ? formatNumber(c.currentRate.sellRate) + ' Ar' : '—'}</span></div>
                <div className="rate-row"><span className="rate-label">Spread</span><span className="rate-value rate-spread">{c.currentRate ? formatNumber(c.currentRate.sellRate - c.currentRate.buyRate) + ' Ar' : '—'}</span></div>
              </div>

              <div className="stock-section">
                <div className="stock-header">
                  <span className="stock-label">📦 Stock</span>
                  <span className={`stock-amount ${c.stock?.isLow ? 'stock-low' : ''}`}>
                    {c.stock ? formatNumber(c.stock.amount, 2) + ' ' + c.code : '—'}
                    {c.stock?.isLow && <span className="stock-alert-icon">⚠️</span>}
                  </span>
                </div>
                {c.stock && (
                  <div className="stock-bar-track">
                    <div className={`stock-bar-fill ${c.stock.isLow ? 'stock-bar-low' : stockPct < 50 ? 'stock-bar-mid' : 'stock-bar-ok'}`} style={{ width: `${Math.min(100, stockPct)}%` }} />
                  </div>
                )}
                {c.stock && <div className="stock-alert-label">Seuil alerte : {formatNumber(c.stock.alertLevel, 2)} {c.code}</div>}
              </div>

              {/* Actions optimisées - plus compactes */}
              {isAdmin && (
                <div className="currency-actions" style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  marginTop: 12
                }}>
                  {/* Ligne principale */}
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {!c.isBase && (
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openRate(c)}
                        style={{ flex: '1 1 auto', minWidth: '60px', padding: '6px 8px', fontSize: '12px' }}
                      >
                        📈 Taux
                      </button>
                    )}
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={() => openStock(c)}
                      style={{ flex: '1 1 auto', minWidth: '60px', padding: '6px 8px', fontSize: '12px' }}
                    >
                      📦 Stock
                    </button>
                  </div>

                  {/* Ligne secondaire - actions avancées */}
                  <div style={{
                    display: 'flex',
                    gap: 4,
                    flexWrap: 'wrap',
                    paddingTop: 6,
                    borderTop: '1px solid var(--slate-200)'
                  }}>
                    {!c.isBase && (
                      <>
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => openEdit(c)}
                          style={{ flex: '0 1 auto', padding: '4px 8px', fontSize: '11px' }}
                          title="Modifier"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-xs btn-outline"
                          onClick={() => openCats(c)}
                          style={{ flex: '0 1 auto', padding: '4px 6px', fontSize: '11px' }}
                          title={`Catégories (${c.denominationCategories?.length || 0})`}
                        >
                          🏷️ <span style={{ fontSize: '9px' }}>(${c.denominationCategories?.length || 0})</span>
                        </button>
                        <button
                          className={`btn btn-xs ${c.isActive ? 'btn-outline' : 'btn-success'}`}
                          onClick={() => doToggle(c)}
                          style={{ flex: '0 1 auto', padding: '4px 8px', fontSize: '11px', minWidth: '40px' }}
                        >
                          {c.isActive ? 'OFF' : 'ON'}
                        </button>
                        <button
                          className="btn btn-xs btn-danger"
                          onClick={() => { setSelected(c); setModal('delete') }}
                          style={{ flex: '0 1 auto', padding: '4px 8px', fontSize: '11px' }}
                          title="Supprimer"
                        >
                          🗑️
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Rate History Table */}
      {rateHistory.length > 0 && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><span className="card-icon">📜</span><h2 className="card-title">Dernières modifications de taux</h2></div>
          <div className="table-wrap">
            <table><thead><tr><th>Date/Heure</th><th>Devise</th><th>Achat</th><th>Vente</th><th>Spread</th><th>Note</th><th>Par</th></tr></thead>
              <tbody>{rateHistory.slice(0, 15).map(h => (
                <tr key={h.id}>
                  <td className="fs-12 text-muted">{new Date(h.createdAt).toLocaleDateString('fr-FR')} {new Date(h.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</td>
                  <td><strong>{h.currency.flag} {h.currency.code}</strong></td>
                  <td className="text-green fw-600">{formatNumber(h.buyRate)} Ar</td>
                  <td className="text-red fw-600">{formatNumber(h.sellRate)} Ar</td>
                  <td className="text-amber">{formatNumber(h.sellRate - h.buyRate)} Ar</td>
                  <td className="text-muted fs-12">{h.note || '—'}</td>
                  <td className="text-muted fs-12">{h.user?.name || '—'}</td>
                </tr>
              ))}</tbody></table>
          </div>
        </div>
      )}

      {/* ── MODALS ── */}
      {modal === 'rate' && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">{selected.flag} Modifier les taux — {selected.code}</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="alert alert-info" style={{ marginBottom: 16 }}>Le nouveau taux devient immédiatement actif pour toutes les transactions.</div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Taux {selected.denominationCategories?.length ? 'Global ' : ''}d'achat (Ar/{selected.code})</label><input className="form-control" type="number" step="1" value={rBuy} onChange={e => setRBuy(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Taux de vente (Ar/{selected.code})</label><input className="form-control" type="number" step="1" value={rSell} onChange={e => setRSell(e.target.value)} /></div>
            </div>
            {selected.denominationCategories && selected.denominationCategories.length > 0 && (
              <div style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ fontSize: 13, marginBottom: 8 }}>Sous-taux (Catégories)</h4>
                {selected.denominationCategories.map(cat => (
                  <div key={cat.id} className="form-group" style={{ marginBottom: 8 }}>
                    <label className="form-label" style={{ fontSize: 12 }}>Taux d'achat : {cat.name}</label>
                    <input className="form-control" type="number" step="1" placeholder={`Hérite du taux global si vide (${rBuy || 0})`} value={rCatRates[cat.id] || ''} onChange={e => setRCatRates(prev => ({ ...prev, [cat.id]: e.target.value }))} />
                  </div>
                ))}
              </div>
            )}
            <div className="form-group"><label className="form-label">Note / Motif</label><input className="form-control" placeholder="ex: Mise à jour marché" value={rNote} onChange={e => setRNote(e.target.value)} /></div>
            {rBuy && rSell && <div className="info-box" style={{ marginBottom: 16 }}><div className="ib-row"><span className="ib-label">Spread</span><span className="ib-value">{spread(rBuy, rSell)} Ar</span></div></div>}
            <div className="btn-group"><button className="btn btn-primary" onClick={saveRate} disabled={loading}>{loading ? '…' : 'Enregistrer'}</button><button className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </div>
      )}

      {modal === 'stock' && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">📦 Gestion stock — {selected.flag} {selected.code}</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row"><span className="ib-label">Stock actuel</span><span className={`ib-value ${selected.stock?.isLow ? 'text-red' : ''}`}>{selected.stock ? formatNumber(selected.stock.amount, 2) + ' ' + selected.code : '—'}</span></div>
              <div className="ib-row"><span className="ib-label">Seuil alerte</span><span className="ib-value">{selected.stock ? formatNumber(selected.stock.alertLevel, 2) + ' ' + selected.code : '—'}</span></div>
            </div>
            <div className="form-group">
              <label className="form-label">Opération</label>
              <div className="type-selector" style={{ marginBottom: 12 }}>
                {(['DEPOT', 'RETRAIT', 'AJUSTEMENT'] as const).map(op => (
                  <button key={op} className={`type-btn ${sOp === op ? op === 'DEPOT' ? 'type-btn-achat' : op === 'RETRAIT' ? 'type-btn-vente' : 'type-btn-edit' : ''}`} onClick={() => setSOp(op)}>{op === 'DEPOT' ? '📥 Dépôt' : op === 'RETRAIT' ? '📤 Retrait' : '⚖️ Ajust.'}</button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Montant ({selected.code})</label><input className="form-control" type="number" step="0.01" min="0" placeholder="0.00" value={sAmt} onChange={e => setSAmt(e.target.value)} /></div>
            <div className="form-group"><label className="form-label">Note</label><input className="form-control" placeholder="Raison de l'opération..." value={sNote} onChange={e => setSNote(e.target.value)} /></div>
            {sAmt && selected.stock && <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row"><span className="ib-label">Nouveau solde estimé</span><span className="ib-value text-blue">{formatNumber(sOp === 'AJUSTEMENT' ? parseFloat(sAmt || '0') : (selected.stock.amount + (sOp === 'RETRAIT' ? -1 : 1) * parseFloat(sAmt || '0')), 2)} {selected.code}</span></div>
            </div>}
            <div className="btn-group">
              <button className="btn btn-primary" onClick={saveStock} disabled={loading}>
                {loading ? '…' : 'Valider'}
              </button>
              <button className="btn btn-outline" onClick={loadDenoms} disabled={loadingDenoms}>
                {loadingDenoms ? '…' : '🔍 Détail coupures'}
              </button>
              <button className="btn btn-outline" onClick={() => setModal(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {modal === 'add' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header"><h3 className="modal-title">+ Ajouter une devise</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Code ISO *</label><input className="form-control" placeholder="CHF" maxLength={3} value={aCode} onChange={e => setACode(e.target.value.toUpperCase())} /></div>
              <div className="form-group"><label className="form-label">Symbole</label><input className="form-control" placeholder="₣" maxLength={3} value={aSym} onChange={e => setASym(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Nom complet *</label><input className="form-control" placeholder="Franc Suisse" value={aName} onChange={e => setAName(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Emoji drapeau</label><input className="form-control" placeholder="🇨🇭" maxLength={4} value={aFlag} onChange={e => setAFlag(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Taux d'achat (Ar) *</label><input className="form-control" type="number" step="1" placeholder="0" value={aBuy} onChange={e => setABuy(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Taux de vente (Ar) *</label><input className="form-control" type="number" step="1" placeholder="0" value={aSell} onChange={e => setASell(e.target.value)} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Stock initial ({aCode || 'CCY'})</label><input className="form-control" type="number" step="0.01" min="0" placeholder="0" value={aStock} onChange={e => setAStock(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">Seuil alerte</label><input className="form-control" type="number" step="0.01" min="0" placeholder="auto" value={aAlert} onChange={e => setAAlert(e.target.value)} /></div>
            </div>
            <div className="btn-group"><button className="btn btn-primary" onClick={saveAdd} disabled={loading || !aCode || !aName || !aBuy || !aSell}>{loading ? '…' : 'Créer la devise'}</button><button className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </div>
      )}

      {modal === 'delete' && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 400 }}>
            <div className="modal-header"><h3 className="modal-title">🗑️ Supprimer {selected.code}</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="alert alert-error">Supprimer <strong>{selected.flag} {selected.code} — {selected.name}</strong> ? Cette action est irréversible. Impossible si des transactions existent.</div>
            <div className="btn-group mt-16"><button className="btn btn-danger" onClick={() => doDelete(selected)}>Supprimer définitivement</button><button className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </div>
      )}
      {modal === 'edit' && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 440 }}>
            <div className="modal-header"><h3 className="modal-title">✏️ Modifier — {selected.flag} {selected.code}</h3><button className="modal-close" onClick={() => setModal(null)}>×</button></div>
            <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row"><span className="ib-label">Code ISO</span><span className="ib-value fw-600">{selected.code}</span></div>
            </div>
            <div className="form-group"><label className="form-label">Nom complet *</label><input className="form-control" value={eName} onChange={e => setEName(e.target.value)} placeholder="ex: Euro" /></div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Symbole</label><input className="form-control" maxLength={3} value={eSym} onChange={e => setESym(e.target.value)} placeholder="€" /></div>
              <div className="form-group"><label className="form-label">Emoji drapeau</label><input className="form-control" maxLength={4} value={eFlag} onChange={e => setEFlag(e.target.value)} placeholder="🇪🇺" /></div>
            </div>
            <div className="btn-group"><button className="btn btn-primary" onClick={saveEdit} disabled={loading || !eName}>{loading ? '…' : 'Enregistrer'}</button><button className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button></div>
          </div>
        </div>
      )}

      {modal === 'categories' && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div className="modal" style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h3 className="modal-title">🏷️ Catégories de coupures — {selected.code}</h3>
              <button className="modal-close" onClick={() => setModal(null)}>×</button>
            </div>
            <p className="text-muted fs-13 mb-16">Définissez des groupes de coupures pour appliquer des taux d'achat variables dans les transactions.</p>

            {cats.map((c, idx) => (
              <div key={idx} style={{ background: 'var(--slate-50)', padding: 12, borderRadius: 8, marginBottom: 12, position: 'relative' }}>
                <button className="modal-close" style={{ position: 'absolute', top: 8, right: 8, fontSize: 16 }} onClick={() => setCats(prev => prev.filter((_, i) => i !== idx))}>×</button>
                <div className="form-group">
                  <label className="form-label">Nom de la catégorie</label>
                  <input className="form-control" placeholder="ex: Gros Billets" value={c.name || ''} onChange={e => setCats(prev => prev.map((x, i) => i === idx ? { ...x, name: e.target.value } : x))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Coupures (valeurs séparées par virgule)</label>
                  <input className="form-control" placeholder="ex: 500, 200, 100, 50" value={c.denominations || ''} onChange={e => setCats(prev => prev.map((x, i) => i === idx ? { ...x, denominations: e.target.value } : x))} />
                </div>
              </div>
            ))}

            <button className="btn btn-sm btn-outline mb-16" onClick={() => setCats(prev => [...prev, { name: '', denominations: '' }])}>+ Ajouter Catégorie</button>
            <div className="btn-group">
              <button className="btn btn-primary" onClick={saveCats} disabled={loading}>{loading ? '…' : 'Enregistrer les catégories'}</button>
              <button className="btn btn-outline" onClick={() => setModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {showDenoms && selected && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowDenoms(false)}>
          <div className="modal">
            <div className="modal-header">
              <h3 className="modal-title">📦 Inventaire physique — {selected.flag} {selected.code}</h3>
              <button className="modal-close" onClick={() => setShowDenoms(false)}>×</button>
            </div>

            <div className="info-box" style={{ marginBottom: 16 }}>
              <div className="ib-row">
                <span className="ib-label">Stock total</span>
                <span className="ib-value text-blue">{formatNumber(selected.stock?.amount ?? 0, 2)} {selected.code}</span>
              </div>
            </div>

            {denomsData && denomsData.length > 0 ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Coupure</th>
                      <th>Quantité</th>
                      <th>Sous-total</th>
                      <th>% du stock</th>
                    </tr>
                  </thead>
                  <tbody>
                    {denomsData.map((d, idx) => {
                      const subtotal = d.denomination * d.quantity
                      const percentage = selected.stock?.amount ? (subtotal / selected.stock.amount * 100).toFixed(1) : '0'
                      return (
                        <tr key={idx}>
                          <td><strong>{formatNumber(d.denomination)}</strong></td>
                          <td>{formatNumber(d.quantity, 0)}</td>
                          <td>{formatNumber(subtotal, 2)}</td>
                          <td><span className="text-muted">{percentage}%</span></td>
                        </tr>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ fontWeight: 600, borderTop: '2px solid var(--slate-200)' }}>
                      <td>Total</td>
                      <td>{formatNumber(denomsData.reduce((sum, d) => sum + d.quantity, 0), 0)} billets</td>
                      <td>{formatNumber(denomsData.reduce((sum, d) => sum + (d.denomination * d.quantity), 0), 2)}</td>
                      <td>100%</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="empty-icon">📭</div>
                <div>Aucun détail de coupures enregistré</div>
                <div className="text-muted fs-12" style={{ marginTop: 8 }}>
                  Les coupures sont automatiquement enregistrées lors des achats de devises
                </div>
              </div>
            )}

            <div className="btn-group" style={{ marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setShowDenoms(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}