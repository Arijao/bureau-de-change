'use client'
import { useState } from 'react'
import { formatNumber, formatMGA, formatDate, formatTime } from '@/lib/utils'
import { adjustStockAction, getCashClosingReportAction, updateAlertLevelAction } from '@/actions/currency.actions'
import CurrencyFlag from '@/components/ui/CurrencyFlag'

interface StockRow { id: number; amount: number; alertLevel: number; isLow: boolean; percentage: number; currency: { id: number; code: string; name: string; flag: string } }
interface LogRow { id: number; operation: string; delta: number; balanceBefore: number; balanceAfter: number; note: string|null; createdAt: Date; stock: { currency: { code: string; flag: string } }; user: { name: string }|null; transactionId: string|null }

interface Props { stocks: StockRow[]; logs: LogRow[]; isAdmin: boolean }

export default function StockClient({ stocks, logs, isAdmin }: Props) {
  const [selected, setSelected] = useState<StockRow|null>(null)
  const [op, setOp] = useState<'DEPOT'|'RETRAIT'|'AJUSTEMENT'>('DEPOT')
  const [amt, setAmt] = useState(''); const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState<{text:string;type:'success'|'error'}|null>(null)
  const [localStocks, setLocalStocks] = useState(stocks)
  const totalLowCount = localStocks.filter(s=>s.isLow).length

  // États pour le rapport de clôture
  const [showReport, setShowReport] = useState(false)
  const [reportDate, setReportDate] = useState(new Date().toISOString().split('T')[0])
  const [reportCurrencyId, setReportCurrencyId] = useState<number>(stocks[0]?.currency.id ?? 0)
  const [reportData, setReportData] = useState<any>(null)
  const [loadingReport, setLoadingReport] = useState(false)
  
  const [alertEdit, setAlertEdit] = useState('')

  async function generateReport() {
    if (!reportCurrencyId) return
    setLoadingReport(true)
    const res = await getCashClosingReportAction(reportCurrencyId, reportDate)
    setLoadingReport(false)
    if (res.error) { setMsg({text: res.error, type: 'error'}); return }
    setReportData(res)
  }

  async function saveAdj() {
    if (!selected) return
    setLoading(true)
    const res = await adjustStockAction({ currencyId: selected.currency.id, operation: op, amount: parseFloat(amt), note: note||undefined })
    setLoading(false)
    if (res.error) { setMsg({text:res.error,type:'error'}); return }
    
    // Mise à jour immédiate du stock local
    setLocalStocks(prev => prev.map(s => {
      if (s.id !== selected.id) return s
      
      let newAmount: number
      if (op === 'AJUSTEMENT') {
        //  AJUSTEMENT : Le nouveau solde est le montant saisi
        newAmount = parseFloat(amt)
      } else {
        //  DEPOT / RETRAIT : On ajoute ou soustrait
        const delta = op === 'RETRAIT' ? -parseFloat(amt) : parseFloat(amt)
        newAmount = s.amount + delta
      }
      
      return {
        ...s,
        amount: newAmount,
        isLow: newAmount <= s.alertLevel,
        percentage: s.alertLevel > 0 ? Math.round((newAmount / (s.alertLevel * 10)) * 100) : 100,
      }
    }))
    
    setSelected(null); setAmt(''); setNote('')
    setMsg({text:`Stock ${selected.currency.code} mis à jour`,type:'success'})
    setTimeout(()=>setMsg(null),3000)
  }

  const opColor = (op: string) => op==='ACHAT'?'chip-red':op==='VENTE'?'chip-green':op==='DEPOT'?'chip-blue':'chip-amber'

  return (
    <div>
      {msg && <div className={`alert alert-${msg.type==='success'?'success':'error'}`}>{msg.text}</div>}

      {totalLowCount > 0 && (
        <div className="alert-banner">⚠️ <strong>{totalLowCount} devise(s) en stock faible</strong> — rechargement recommandé</div>
      )}

         <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <button className="btn btn-outline" onClick={() => { setShowReport(true); setReportData(null); }}>
              Rapport de clôture
          </button>
        </div>

        <div className= "grid-3 " style={{marginBottom:24}} >
        <div className="stat-card stat-blue"><div className="stat-label">Devises actives</div><div className="stat-value">{localStocks.length}</div></div>
        <div className="stat-card stat-amber"><div className="stat-label">Stocks faibles</div><div className="stat-value">{totalLowCount}</div><div className="stat-sub">sous le seuil d'alerte</div></div>
        <div className="stat-card stat-green"><div className="stat-label">Stocks OK</div><div className="stat-value">{localStocks.length-totalLowCount}</div></div>
      </div>

      <div className="card" style={{marginBottom:24}}>
        <div className="card-header"><span className="card-icon card-icon-blue">📦</span><h2 className="card-title">Liquidité par devise</h2></div>
        <table>
          <thead><tr><th>Devise</th><th>Stock actuel</th><th>Seuil alerte</th><th>Niveau</th><th>Statut</th>{isAdmin&&<th>Action</th>}</tr></thead>
          <tbody>
            {localStocks.map(s=>(
              <tr key={s.id}>
                <td><strong><CurrencyFlag code={s.currency.code} flag={s.currency.flag} size={16} /> {s.currency.code}</strong> <span className="text-muted fs-12">{s.currency.name}</span></td>
                <td className={`fw-600 ${s.isLow?'text-red':''}`}>{formatNumber(s.amount,2)} {s.currency.code}</td>
                <td className="text-muted fs-12">{formatNumber(s.alertLevel,2)} {s.currency.code}</td>
                <td style={{minWidth:120}}>
                  <div className="stock-bar-track">
                    <div className={`stock-bar-fill ${s.isLow?'stock-bar-low':s.percentage<50?'stock-bar-mid':'stock-bar-ok'}`} style={{width:`${Math.min(100,s.percentage)}%`}}/>
                  </div>
                  <div className="fs-12 text-muted" style={{marginTop:2}}>{Math.min(100,s.percentage)}%</div>
                </td>
                <td>{s.isLow?<span className="chip chip-red">⚠️ Faible</span>:<span className="chip chip-green">✓ OK</span>}</td>
                {isAdmin&&<td><button className="btn btn-sm btn-outline" onClick={()=>{setSelected(s);setOp('DEPOT');setAmt('');setNote('')}}>Ajuster</button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <div className="card-header"><span className="card-icon card-icon-amber">📋</span><h2 className="card-title">Journal des mouvements ({logs.length})</h2></div>
        {logs.length===0?<div className="empty-state"><div className="empty-icon">📋</div><div>Aucun mouvement enregistré</div></div>:(
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th>Heure</th><th>Devise</th><th>Opération</th><th>Mouvement</th><th>Avant</th><th>Après</th><th>Note</th><th>Par</th></tr></thead>
              <tbody>
                {logs.map(l=>(
                  <tr key={l.id}>
                    <td className="fs-12">{formatDate(l.createdAt)}</td>
                    <td className="fs-12 text-muted">{formatTime(l.createdAt)}</td>
                    <td><strong><CurrencyFlag code={l.stock.currency.code} flag={l.stock.currency.flag} size={16} /> {l.stock.currency.code}</strong></td>
                    <td><span className={`chip ${opColor(l.operation)}`} style={{fontSize:10}}>{l.operation}</span></td>
                    <td className={`fw-600 ${l.delta>=0?'text-green':'text-red'}`}>{l.delta>=0?'+':''}{formatNumber(l.delta,2)}</td>
                    <td className="fs-12 text-muted">{formatNumber(l.balanceBefore,2)}</td>
                    <td className="fw-600">{formatNumber(l.balanceAfter,2)}</td>
                    <td className="fs-12 text-muted" style={{maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.note||'—'}</td>
                    <td className="fs-12 text-muted">{l.user?.name||'—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div className="modal">
            <div className="modal-header"><h3 className="modal-title">📦 Ajuster stock — <CurrencyFlag code={selected.currency.code} flag={selected.currency.flag} size={16} /> {selected.currency.code}</h3><button className="modal-close" onClick={()=>setSelected(null)}>×</button></div>
            <div className="info-box" style={{marginBottom:16}}>
              <div className="ib-row"><span className="ib-label">Stock actuel</span><span className={`ib-value ${selected.isLow?'text-red':''}`}>{formatNumber(selected.amount,2)} {selected.currency.code}</span></div>
              <div className="ib-row"><span className="ib-label">Seuil alerte</span><span className="ib-value">{formatNumber(selected.alertLevel,2)} {selected.currency.code}</span></div>
            </div>
            <div className="form-group">
              <label className="form-label">Modifier le seuil d'alerte ({selected.currency.code})</label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="form-control"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={String(selected.alertLevel)}
                  value={alertEdit}
                  onChange={e => setAlertEdit(e.target.value)}
                />
                <button
                  className="btn btn-outline btn-sm"
                  disabled={!alertEdit || loading}
                  onClick={async () => {
                    setLoading(true)
                    const res = await updateAlertLevelAction(selected.currency.id, parseFloat(alertEdit))
                    setLoading(false)
                    if (res.error) { setMsg({ text: res.error, type: 'error' }); return }
                    setLocalStocks(prev => prev.map(s =>
                      s.id !== selected.id ? s : {
                        ...s,
                        alertLevel: parseFloat(alertEdit),
                        isLow: s.amount <= parseFloat(alertEdit),
                      }
                    ))
                    setSelected(prev => prev ? { ...prev, alertLevel: parseFloat(alertEdit) } : null)
                    setAlertEdit('')
                    setMsg({ text: `Seuil ${selected.currency.code} mis à jour`, type: 'success' })
                    setTimeout(() => setMsg(null), 3000)
                  }}
                >
                  ✓ Appliquer
                </button>
              </div>
            </div>
            <div className="form-group">
              <div className="type-selector">
                {(['DEPOT','RETRAIT','AJUSTEMENT'] as const).map(o=>(
                  <button key={o} className={`type-btn ${op===o?o==='DEPOT'?'type-btn-achat':o==='RETRAIT'?'type-btn-vente':'type-btn-edit':''}`} onClick={()=>setOp(o)}>
                    {o==='DEPOT'?'📥 Dépôt':o==='RETRAIT'?'📤 Retrait':'⚖️ Ajustement'}
                  </button>
                ))}
              </div>
            </div>
            <div className="form-group"><label className="form-label">Montant ({selected.currency.code})</label><input className="form-control" type="number" step="0.01" min="0" placeholder="0.00" value={amt} onChange={e=>setAmt(e.target.value)}/></div>
            <div className="form-group"><label className="form-label">Note / Motif</label><input className="form-control" placeholder="Raison de l'opération..." value={note} onChange={e=>setNote(e.target.value)}/></div>
            {amt && <div className="info-box" style={{marginBottom:16}}>
              <div className="ib-row">
                <span className="ib-label">Nouveau solde</span>
                <span className="ib-value text-blue">
                  {formatNumber(
                    op === 'AJUSTEMENT'
                      ? parseFloat(amt || '0')
                      : selected.amount + (op === 'RETRAIT' ? -1 : 1) * parseFloat(amt || '0'),
                    2
                  )} {selected.currency.code}
                </span>
              </div>
            </div>}
            <div className="btn-group"><button className="btn btn-primary" onClick={saveAdj} disabled={loading||!amt}>{loading?'…':'Valider'}</button><button className="btn btn-outline" onClick={()=>setSelected(null)}>Annuler</button></div>
          </div>
        </div>
      )}

      {/* ── MODAL RAPPORT DE CLÔTURE ── */}
      {showReport && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setShowReport(false)}>
          <div className="modal" style={{ maxWidth: 700 }}>
            <div className="modal-header">
              <h3 className="modal-title"> Rapport de Clôture de Caisse</h3>
              <button className="modal-close" onClick={() => setShowReport(false)}>×</button>
            </div>

            {/* Filtres */}
            <div className="form-row" style={{ marginBottom: 16 }}>
              <div className="form-group">
                <label className="form-label">Date du rapport</label>
                <input className="form-control" type="date" value={reportDate} onChange={e => setReportDate(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Devise</label>
                <select className="form-control" value={reportCurrencyId} onChange={e => setReportCurrencyId(parseInt(e.target.value))}>
                  {stocks.map(s => (
                    <option key={s.currency.id} value={s.currency.id}>
                      <CurrencyFlag code={s.currency.code} flag={s.currency.flag} size={14} /> {s.currency.code} — {s.currency.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="btn-group" style={{ marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={generateReport} disabled={loadingReport}>
                {loadingReport ? 'Génération…' : '🔄 Générer le rapport'}
              </button>
              {reportData && (
                <button className="btn btn-outline" onClick={() => window.print()}>
                  🖨️ Imprimer
                </button>
              )}
            </div>

            {/* Résultats */}
            {reportData && (
              <div id="closing-report-content">
                {/* Soldes */}
                <div className="grid-3" style={{ marginBottom: 16 }}>
                  <div className="stat-card stat-blue">
                    <div className="stat-label">Solde d'ouverture</div>
                    <div className="stat-value">{formatNumber(reportData.openingBalance, 2)}</div>
                  </div>
                  <div className={`stat-card ${reportData.totalDelta >= 0 ? 'stat-green' : 'stat-amber'}`}>
                    <div className="stat-label">Mouvement net</div>
                    <div className="stat-value">{reportData.totalDelta >= 0 ? '+' : ''}{formatNumber(reportData.totalDelta, 2)}</div>
                  </div>
                  <div className="stat-card stat-blue">
                    <div className="stat-label">Solde théorique</div>
                    <div className="stat-value">{formatNumber(reportData.closingBalance, 2)}</div>
                  </div>
                </div>

                {/* Tableau des mouvements */}
                {reportData.movements.length > 0 ? (
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Heure</th>
                          <th>Opération</th>
                          <th>Mouvement</th>
                          <th>Solde après</th>
                          <th>Note</th>
                          <th>Par</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.movements.map((m: any) => (
                          <tr key={m.id}>
                            <td className="fs-12 text-muted">{formatTime(m.createdAt)}</td>
                            <td><span className={`chip ${opColor(m.operation)}`} style={{fontSize:10}}>{m.operation}</span></td>
                            <td className={`fw-600 ${m.delta >= 0 ? 'text-green' : 'text-red'}`}>
                              {m.delta >= 0 ? '+' : ''}{formatNumber(m.delta, 2)}
                            </td>
                            <td className="fw-600">{formatNumber(m.balanceAfter, 2)}</td>
                            <td className="fs-12 text-muted" style={{maxWidth:150, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap'}}>{m.note || '—'}</td>
                            <td className="fs-12 text-muted">{m.user?.name || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="empty-state" style={{ padding: '24px 0' }}>
                    <div className="empty-icon"></div>
                    <div>Aucun mouvement pour cette date</div>
                  </div>
                )}
              </div>
            )}

            <div className="btn-group" style={{ marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => setShowReport(false)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div >
  )
}
