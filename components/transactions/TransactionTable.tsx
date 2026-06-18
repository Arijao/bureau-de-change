'use client'
import { useState, useEffect } from 'react'
import { formatMGA, formatCurrency, formatDate, formatTime, formatNumber } from '@/lib/utils'
import TicketModal from '@/components/ticket/TicketModal'
import AttestationModal from '@/components/ticket/AttestationModal'
import { deleteTransactionAction, updateTransactionAction, deleteTransactionWithOverrideAction, updateTransactionWithOverrideAction } from '@/actions/transaction.actions'
import CurrencyFlag from '@/components/ui/CurrencyFlag'

interface TxDetail {
  categoryName: string
  denomination: number
  quantity: number
  rateApplied: number
  subtotalAmount: number
  subtotalMGA: number
}

interface TxRow {
  id: string; receiptNo: string; type: string; createdAt: Date
  amount: number; rate: number; commission: number; totalMGA: number
  note: string|null; deletedAt?: Date|null
  currency: { id: number; code: string; flag: string; name: string }
  user: { name: string }|null
  size?: string  // Taille du ticket (MM58 ou MM80)
  details?: TxDetail[]
}

interface Props {
  transactions: TxRow[]; total: number; isAdmin: boolean
  bureauName: string; bureauAddress: string; bureauPhone: string; bureauFooter: string
  bureauNif?: string | null
  bureauStat?: string | null
  bureauEmail?: string | null
  bureauRib?: string | null
  bureauLogo?:   string | null
}

type Modal =
  | null
  | { mode: 'delete'; tx: TxRow }
  | { mode: 'edit';   tx: TxRow }

export default function TransactionTable({
  transactions, total, isAdmin,
  bureauName, bureauAddress, bureauPhone, bureauFooter,
  bureauNif, bureauStat, bureauEmail, bureauRib, bureauLogo,
}: Props) {
  const [ticketTx, setTicketTx]   = useState<TxRow|null>(null)
  const [attestationTx, setAttestationTx] = useState<TxRow|null>(null)
  const [printMenuTx, setPrintMenuTx] = useState<TxRow|null>(null)
  const [existingAttestation, setExistingAttestation] = useState<any>(null)
  const [modal, setModal]         = useState<Modal>(null)
  const [loading, setLoading]     = useState(false)
  const [feedback, setFeedback]   = useState<{text:string; type:'success'|'error'}|null>(null)

  // Champs édition
  const [editAmount, setEditAmount]         = useState('')
  const [editRate, setEditRate]             = useState('')
  const [editCommission, setEditCommission] = useState('')
  const [editNote, setEditNote]             = useState('')

  // Override admin (depuis poste caissier)
  // overridePending = action en attente de validation admin
  const [overridePending, setOverridePending] = useState<
    null | { action: 'delete'; tx: TxRow } | { action: 'edit'; tx: TxRow }
  >(null)
  const [overrideUsername, setOverrideUsername] = useState('')
  const [overridePassword, setOverridePassword] = useState('')
  const [overrideError, setOverrideError]       = useState('')

  function openEdit(tx: TxRow) {
    setEditAmount(String(tx.amount))
    setEditRate(String(tx.rate))
    setEditCommission(String(tx.commission))
    setEditNote(tx.note ?? '')
    setFeedback(null)
    if (isAdmin) {
      // Admin connecté → accès direct, pas d'override
      setModal({ mode: 'edit', tx })
    } else {
      // Caissier → passer par le modal override
      setOverridePending({ action: 'edit', tx })
      setOverrideUsername(''); setOverridePassword(''); setOverrideError('')
    }
  }

  function openDelete(tx: TxRow) {
    setFeedback(null)
    if (isAdmin) {
      setModal({ mode: 'delete', tx })
    } else {
      setOverridePending({ action: 'delete', tx })
      setOverrideUsername(''); setOverridePassword(''); setOverrideError('')
    }
  }

  function toast(text: string, type: 'success'|'error' = 'success') {
    setFeedback({ text, type })
    if (type === 'success') setTimeout(() => setFeedback(null), 4000)
  }

  // Calcul prévisuel du total MGA dans le modal édition
  const previewMGA = (() => {
    if (modal?.mode !== 'edit') return null
    const a = parseFloat(editAmount || '0')
    const r = parseFloat(editRate   || '0')
    const c = parseFloat(editCommission || '0')
    if (!a || !r) return null
    return modal.tx.type === 'ACHAT' ? a * r - c : a * r + c
  })()

  async function handleDelete() {
    if (modal?.mode !== 'delete') return
    setLoading(true)
    const res = await deleteTransactionAction(modal.tx.id)
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setModal(null)
    toast(`Transaction ${modal.tx.receiptNo} supprimée`)
    // Rafraîchir — la page est force-dynamic donc un reload suffit
    setTimeout(() => window.location.reload(), 1500)
  }

  async function handleEdit() {
    if (modal?.mode !== 'edit') return
    const amount     = parseFloat(editAmount)
    const rate       = parseFloat(editRate)
    const commission = parseFloat(editCommission || '0')
    if (!amount || amount <= 0) { toast('Montant invalide', 'error'); return }
    if (!rate   || rate   <= 0) { toast('Taux invalide',   'error'); return }
    if (commission < 0)          { toast('Commission invalide', 'error'); return }
    setLoading(true)
    const res = await updateTransactionAction(modal.tx.id, { amount, rate, commission, note: editNote || undefined })
    setLoading(false)
    if (res.error) { toast(res.error, 'error'); return }
    setModal(null)
    toast(`Transaction ${modal.tx.receiptNo} modifiée`)
    setTimeout(() => window.location.reload(), 1500)
  }

  // Validation override admin depuis poste caissier
  async function handleOverride() {
    if (!overridePending) return
    if (!overrideUsername.trim()) { setOverrideError('Identifiant admin requis'); return }
    if (!overridePassword)        { setOverrideError('Mot de passe requis'); return }

    setLoading(true)
    setOverrideError('')

    if (overridePending.action === 'delete') {
      const res = await deleteTransactionWithOverrideAction(
        overridePending.tx.id, overrideUsername.trim(), overridePassword
      )
      setLoading(false)
      if (res.error) { setOverrideError(res.error); return }
      setOverridePending(null)
      toast(`Transaction ${overridePending.tx.receiptNo} supprimée — validée par ${(res as any).adminName}`)
      setTimeout(() => window.location.reload(), 1500)
    } else {
      // edit — passer au modal edit standard une fois les credentials validés
      // On valide d'abord les champs de saisie
      const amount     = parseFloat(editAmount)
      const rate       = parseFloat(editRate)
      const commission = parseFloat(editCommission || '0')
      if (!amount || amount <= 0) { setLoading(false); setOverrideError('Montant invalide'); return }
      if (!rate   || rate   <= 0) { setLoading(false); setOverrideError('Taux invalide');   return }
      if (commission < 0)          { setLoading(false); setOverrideError('Commission invalide'); return }
      const res = await updateTransactionWithOverrideAction(
        overridePending.tx.id,
        { amount, rate, commission, note: editNote || undefined },
        overrideUsername.trim(), overridePassword
      )
      setLoading(false)
      if (res.error) { setOverrideError(res.error); return }
      setOverridePending(null)
      toast(`Transaction ${overridePending.tx.receiptNo} modifiée — validée par ${(res as any).adminName}`)
      setTimeout(() => window.location.reload(), 1500)
    }
  }

  async function exportExcel() {
    const XLSX = await import('xlsx')

    const rows = transactions
      .filter(tx => !tx.deletedAt)
      .map(tx => ({
        'N° Reçu':     tx.receiptNo,
        'Date':        formatDate(tx.createdAt),
        'Heure':       formatTime(tx.createdAt),
        'Type':        tx.type,
        'Devise':      tx.currency.code,
        'Montant':     tx.amount,
        'Taux':        tx.rate,
        'Commission':  tx.commission,
        'Total MGA':   tx.totalMGA,
        'Caissier':    tx.user?.name || '',
      }))

    const ws = XLSX.utils.json_to_sheet(rows)

    // Largeurs colonnes
    ws['!cols'] = [
      { wch: 14 }, { wch: 12 }, { wch: 8 }, { wch: 8 },
      { wch: 8 },  { wch: 12 }, { wch: 10 }, { wch: 12 },
      { wch: 14 }, { wch: 16 },
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Transactions')
    XLSX.writeFile(wb, `transactions_${new Date().toISOString().slice(0, 10)}.xlsx`)
  }

  function printSummary() {
    // Lire les filtres actifs depuis l'URL
    const sp = new URLSearchParams(window.location.search)
    const filterParts: string[] = []
    if (sp.get('dateFrom')) filterParts.push(`Du : ${sp.get('dateFrom')}`)
    if (sp.get('dateTo'))   filterParts.push(`Au : ${sp.get('dateTo')}`)
    if (sp.get('type'))     filterParts.push(`Type : ${sp.get('type')}`)

    const activeTx = transactions.filter(t => !t.deletedAt)
    const tAchat   = activeTx.filter(t => t.type === 'ACHAT').reduce((s, t) => s + t.totalMGA, 0)
    const tVente   = activeTx.filter(t => t.type === 'VENTE').reduce((s, t) => s + t.totalMGA, 0)

    const logoHtml = bureauLogo && bureauLogo.startsWith('data:image/')
      ? `<img src="${bureauLogo}" style="max-height:50px;max-width:120px;object-fit:contain"/>`
      : ''

    const filtersHtml = filterParts.length > 0
      ? `<div class="filters">Filtres actifs : ${filterParts.join(' — ')}</div>`
      : `<div class="filters">Toutes les transactions</div>`

    const rows = activeTx.map(tx => `
      <tr>
        <td>${tx.receiptNo}</td>
        <td>${formatDate(tx.createdAt)}</td>
        <td>${formatTime(tx.createdAt)}</td>
        <td><span class="chip ${tx.type === 'ACHAT' ? 'chip-green' : 'chip-red'}">${tx.type}</span></td>
        <td>${tx.currency.code}</td>
        <td class="num">${formatCurrency(tx.amount, tx.currency.code)}</td>
        <td class="num">${formatNumber(tx.rate)}</td>
        <td class="num">${tx.commission > 0 ? formatMGA(tx.commission) : '—'}</td>
        <td class="num fw">${formatMGA(tx.totalMGA)}</td>
        <td>${tx.user?.name || '—'}</td>
      </tr>
    `).join('')

    const html = `<!DOCTYPE html>
  <html lang="fr">
  <head>
  <meta charset="UTF-8">
  <title>État des transactions — ${new Date().toLocaleDateString('fr-FR')}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0 }
    body { font-family: Arial, sans-serif; font-size: 10pt; color: #1a1a1a; padding: 15mm 15mm; }

    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 2px solid #1a3a6b; padding-bottom: 10px; margin-bottom: 12px; }
    .bureau-name { font-size: 16pt; font-weight: 700; color: #1a3a6b; }
    .bureau-detail { font-size: 9pt; color: #555; margin-top: 3px; }
    .doc-title { text-align: center; font-size: 13pt; font-weight: 700;
                text-transform: uppercase; letter-spacing: 1px; color: #1a3a6b;
                margin-bottom: 8px; }
    .filters { text-align: center; font-size: 9pt; color: #555;
              background: #f0f4ff; border: 1px solid #c7d7f5;
              padding: 5px 10px; border-radius: 4px; margin-bottom: 12px; }
    .stats { display: flex; gap: 12px; margin-bottom: 12px; }
    .stat { flex: 1; border: 1px solid #e2e8f0; border-radius: 4px;
            padding: 8px 12px; text-align: center; }
    .stat-label { font-size: 8pt; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 11pt; font-weight: 700; color: #1a3a6b; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; font-size: 9pt; }
    thead tr { background: #1a3a6b; color: white; }
    th { padding: 6px 8px; text-align: left; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #e2e8f0; }
    tr:nth-child(even) td { background: #f8fafc; }
    .num { text-align: right; }
    .fw  { font-weight: 700; }
    .chip { padding: 1px 6px; border-radius: 10px; font-size: 8pt; font-weight: 600; }
    .chip-green { background: #dcfce7; color: #166534; }
    .chip-red   { background: #fee2e2; color: #991b1b; }
    .totals { margin-top: 12px; border-top: 2px solid #1a3a6b; padding-top: 10px;
              display: flex; gap: 16px; justify-content: flex-end; }
    .total-item { text-align: right; }
    .total-label { font-size: 9pt; color: #555; }
    .total-value { font-size: 11pt; font-weight: 700; color: #1a3a6b; }
    .footer { margin-top: 16px; text-align: center; font-size: 8pt; color: #aaa;
              border-top: 1px solid #e2e8f0; padding-top: 8px; }
    @media print { body { padding: 10mm; } }
  </style>
  </head>
  <body>

  <div class="header">
    <div>
      ${logoHtml}
      <div class="bureau-name">${bureauName}</div>
      <div class="bureau-detail">${bureauAddress}</div>
      <div class="bureau-detail">Tél : ${bureauPhone}</div>
    </div>
    <div style="text-align:right; font-size:9pt; color:#555">
      Édité le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR', {hour:'2-digit', minute:'2-digit'})}
    </div>
  </div>

  <div class="doc-title">État récapitulatif des transactions</div>
  ${filtersHtml}

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Transactions</div>
      <div class="stat-value">${activeTx.length}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total achats</div>
      <div class="stat-value">${formatMGA(tAchat)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Total ventes</div>
      <div class="stat-value">${formatMGA(tVente)}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Volume total</div>
      <div class="stat-value">${formatMGA(tAchat + tVente)}</div>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th>N° Reçu</th><th>Date</th><th>Heure</th><th>Type</th>
        <th>Devise</th><th>Montant</th><th>Taux</th><th>Commission</th>
        <th>Total MGA</th><th>Caissier</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="totals">
    <div class="total-item">
      <div class="total-label">Total achats</div>
      <div class="total-value">${formatMGA(tAchat)}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Total ventes</div>
      <div class="total-value">${formatMGA(tVente)}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Volume total</div>
      <div class="total-value">${formatMGA(tAchat + tVente)}</div>
    </div>
  </div>

  <div class="footer">
    ${bureauFooter} — Document généré automatiquement par Travel EXChange
  </div>

  <script>window.onload = () => { window.print() }<\/script>
  </body>
  </html>`

    const win = window.open('', '_blank', 'width=1000,height=800')
    if (!win) { alert('Veuillez autoriser les popups pour imprimer.'); return }
    win.document.write(html)
    win.document.close()
  }

  // Exclure les soft-deleted de l'affichage et des totaux
  const active      = transactions.filter(t => !t.deletedAt)
  const totalAchat  = active.filter(t => t.type==='ACHAT').reduce((s,t) => s+t.totalMGA, 0)
  const totalVente  = active.filter(t => t.type==='VENTE').reduce((s,t) => s+t.totalMGA, 0)

  return (
    <>
      {/* Feedback global (succès/erreur hors modal) */}
      {feedback && !modal && (
        <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} style={{marginBottom:12}}>
          {feedback.text}
        </div>
      )}

      <div className="history-stats">
        <div className="stat-card"><div className="stat-label">Transactions</div><div className="stat-value">{total}</div></div>
        <div className="stat-card stat-green"><div className="stat-label">Total achats</div><div className="stat-value">{formatMGA(totalAchat)}</div></div>
        <div className="stat-card stat-red"><div className="stat-label">Total ventes</div><div className="stat-value">{formatMGA(totalVente)}</div></div>
        <div className="stat-card stat-blue"><div className="stat-label">Volume total</div><div className="stat-value">{formatMGA(totalAchat+totalVente)}</div></div>
      </div>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📋 Liste ({total})</h2>
          <div style={{display:'flex', gap:6, marginLeft:'auto'}}>
            <button className="btn btn-sm btn-outline" onClick={exportExcel}>⬇ Excel</button>
            <button className="btn btn-sm btn-outline" onClick={printSummary}>🖨️ État</button>
          </div>
        </div>

        {transactions.length === 0
          ? <div className="empty-state"><div className="empty-icon">📋</div><div>Aucune transaction</div></div>
          : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Reçu</th><th>Date</th><th>Heure</th><th>Type</th>
                  <th>Devise</th><th>Montant</th><th>Taux</th><th>Commission</th>
                  <th>Total MGA</th><th>Caissier</th><th>🧾</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map(tx => (
                  <tr key={tx.id} style={tx.deletedAt ? { opacity: 0.4, textDecoration: 'line-through' } : undefined}>
                    <td><strong>{tx.receiptNo}</strong>{tx.deletedAt && <span className="chip chip-red" style={{fontSize:9,marginLeft:4}}>SUPPRIMÉE</span>}</td>
                    <td>{formatDate(tx.createdAt)}</td>
                    <td>{formatTime(tx.createdAt)}</td>
                    <td><span className={`chip ${tx.type==='ACHAT'?'chip-green':'chip-red'}`}>{tx.type}</span></td>
                    <td><CurrencyFlag code={tx.currency.code} flag={tx.currency.flag} size={16} /> {tx.currency.code}</td>
                    <td className="fw-600">{formatCurrency(tx.amount, tx.currency.code)}</td>
                    <td>{formatNumber(tx.rate)}</td>
                    <td>{tx.commission > 0 ? formatMGA(tx.commission) : '—'}</td>
                    <td className="fw-600">{formatMGA(tx.totalMGA)}</td>
                    <td>{tx.user?.name||'—'}</td>
                    <td>
                      {!tx.deletedAt && (
                        <button 
                          className="btn btn-sm btn-outline" 
                          onClick={() => setPrintMenuTx(tx)}
                          title="Imprimer"
                        >
                          🖨️
                        </button>
                      )}
                    </td>
                    <td>
                      {!tx.deletedAt && (
                        <div style={{display:'flex', gap:4}}>
                          <button
                            className="btn btn-sm btn-outline"
                            title={isAdmin ? 'Modifier' : 'Modifier (validation admin requise)'}
                            onClick={() => openEdit(tx)}
                          >✏️</button>
                          <button
                            className="btn btn-sm btn-outline"
                            style={{color:'var(--danger,#e53e3e)'}}
                            title={isAdmin ? 'Supprimer' : 'Supprimer (validation admin requise)'}
                            onClick={() => openDelete(tx)}
                          >🗑️</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 100 && (
          <div className="table-footer">100 premières sur {total} — affinez avec les filtres</div>
        )}
      </div>

      {/* ── MODAL SUPPRESSION ─────────────────────────────────────────── */}
      {modal?.mode === 'delete' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && setModal(null)}>
          <div className="modal" style={{maxWidth:420}}>
            <div className="modal-header">
              <h3 className="modal-title">🗑️ Supprimer la transaction</h3>
              <button className="modal-close" onClick={() => setModal(null)} disabled={loading}>×</button>
            </div>

            {feedback && (
              <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} style={{marginBottom:12}}>
                {feedback.text}
              </div>
            )}

            <div className="alert alert-error" style={{marginBottom:16}}>
              ⚠️ Cette action est <strong>irréversible</strong>. La transaction sera marquée comme supprimée et son impact sur le stock sera annulé.
            </div>

            <div className="info-box">
              <div className="ib-row"><span className="ib-label">N° Reçu</span><span className="ib-value fw-600">{modal.tx.receiptNo}</span></div>
              <div className="ib-row"><span className="ib-label">Type</span><span className="ib-value">{modal.tx.type}</span></div>
              <div className="ib-row"><span className="ib-label">Devise</span><span className="ib-value"><CurrencyFlag code={modal.tx.currency.code} flag={modal.tx.currency.flag} size={14} /> {modal.tx.currency.code}</span></div>
              <div className="ib-row"><span className="ib-label">Montant</span><span className="ib-value">{formatCurrency(modal.tx.amount, modal.tx.currency.code)}</span></div>
              <div className="ib-row"><span className="ib-label">Total MGA</span><span className="ib-value fw-600">{formatMGA(modal.tx.totalMGA)}</span></div>
              <div className="ib-row"><span className="ib-label">Caissier</span><span className="ib-value">{modal.tx.user?.name||'—'}</span></div>
            </div>

            <div className="btn-group mt-16">
              <button
                className="btn btn-danger btn-lg"
                onClick={handleDelete}
                disabled={loading}
              >
                {loading ? 'Suppression…' : '🗑️ Confirmer la suppression'}
              </button>
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={loading}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL MODIFICATION ───────────────────────────────────────────── */}
      {modal?.mode === 'edit' && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && setModal(null)}>
          <div className="modal" style={{maxWidth:480}}>
            <div className="modal-header">
              <h3 className="modal-title">✏️ Modifier — {modal.tx.receiptNo}</h3>
              <button className="modal-close" onClick={() => setModal(null)} disabled={loading}>×</button>
            </div>

            {feedback && (
              <div className={`alert alert-${feedback.type === 'success' ? 'success' : 'error'}`} style={{marginBottom:12}}>
                {feedback.text}
              </div>
            )}

            <div className="alert alert-info" style={{marginBottom:16, fontSize:13}}>
              L'impact sur le stock sera recalculé automatiquement.
              {modal.tx.type === 'ACHAT' && ' Le stock disponible sera vérifié.'}
            </div>

            {/* Ligne devise + type — non modifiables */}
            <div className="info-box" style={{marginBottom:16}}>
              <div className="ib-row">
                <span className="ib-label">Devise</span>
                <span className="ib-value"><CurrencyFlag code={modal.tx.currency.code} flag={modal.tx.currency.flag} size={14} /> {modal.tx.currency.code}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Type</span>
                <span className="ib-value">
                  <span className={`chip ${modal.tx.type==='ACHAT'?'chip-green':'chip-red'}`}>{modal.tx.type}</span>
                </span>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Montant ({modal.tx.currency.code}) *</label>
                <input
                  className="form-control" type="number" step="0.01" min="0"
                  value={editAmount}
                  onChange={e => setEditAmount(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEdit()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Taux (Ar/{modal.tx.currency.code}) *</label>
                <input
                  className="form-control" type="number" step="1" min="0"
                  value={editRate}
                  onChange={e => setEditRate(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleEdit()}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Commission (Ar)</label>
              <input
                className="form-control" type="number" step="100" min="0"
                value={editCommission}
                onChange={e => setEditCommission(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Note</label>
              <input
                className="form-control"
                placeholder="Référence, remarque…"
                value={editNote}
                onChange={e => setEditNote(e.target.value)}
              />
            </div>

            {/* Prévisualisation du nouveau total MGA */}
            {previewMGA !== null && (
              <div className="info-box" style={{marginBottom:12}}>
                <div className="ib-row">
                  <span className="ib-label">Ancien total MGA</span>
                  <span className="ib-value" style={{textDecoration:'line-through', opacity:0.6}}>
                    {formatMGA(modal.tx.totalMGA)}
                  </span>
                </div>
                <div className="ib-row">
                  <span className="ib-label">Nouveau total MGA</span>
                  <span className="ib-value fw-600" style={{color:'var(--primary,#2563eb)'}}>
                    {formatMGA(previewMGA)}
                  </span>
                </div>
              </div>
            )}

            <div className="btn-group mt-16">
              <button
                className="btn btn-primary btn-lg"
                onClick={handleEdit}
                disabled={loading}
              >
                {loading ? 'Enregistrement…' : '✏️ Enregistrer les modifications'}
              </button>
              <button className="btn btn-outline" onClick={() => setModal(null)} disabled={loading}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {ticketTx && (
        <TicketModal
          transaction={{...ticketTx, createdAt: ticketTx.createdAt.toISOString(), mgaAmount: ticketTx.totalMGA}}
          bureauName={bureauName} bureauAddress={bureauAddress}
          bureauPhone={bureauPhone} bureauFooter={bureauFooter}
          logoBase64={bureauLogo}
          onClose={() => setTicketTx(null)}
        />
      )}

      {attestationTx && (
        <AttestationModal
          transaction={attestationTx}
          bureau={{
            bureauName, bureauAddress, bureauPhone, bureauFooter,
            nif: bureauNif, stat: bureauStat, email: bureauEmail, rib: bureauRib,
            logoBase64 : bureauLogo ?? null,
          }}
          existingAttestation={existingAttestation}
          onClose={() => {
            setAttestationTx(null)
            setExistingAttestation(null)
          }}
        />
      )}

      {/* ── MODAL CHOIX D'IMPRESSION ─────────────────────────────────────── */}
      {printMenuTx && (
        <div className="modal-overlay" onClick={() => setPrintMenuTx(null)}>
          <div className="modal" style={{maxWidth:400}} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3 className="modal-title">🖨️ Options d'impression</h3>
              <button className="modal-close" onClick={() => setPrintMenuTx(null)}>×</button>
            </div>

            <div className="info-box" style={{marginBottom:16}}>
              <div className="ib-row">
                <span className="ib-label">N° Reçu</span>
                <span className="ib-value fw-600">{printMenuTx.receiptNo}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Type</span>
                <span className="ib-value">
                  <span className={`chip ${printMenuTx.type==='ACHAT'?'chip-green':'chip-red'}`}>
                    {printMenuTx.type}
                  </span>
                </span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Devise</span>
                <span className="ib-value"><CurrencyFlag code={printMenuTx.currency.code} flag={printMenuTx.currency.flag} size={14} /> {printMenuTx.currency.code}</span>
              </div>
            </div>

            <div style={{display:'flex', flexDirection:'column', gap:8}}>
              <button 
                className="btn btn-lg" 
                style={{background:'var(--bg2,#ffffff)', border:'1px solid var(--border,#e2e8f0)', color:'var(--text,#1a1916)'}}
                onClick={() => {
                  setTicketTx(printMenuTx)
                  setPrintMenuTx(null)
                }}
              >
                🧾 Ticket 58 mm
              </button>

              <button 
                className="btn btn-lg" 
                style={{background:'var(--bg2,#ffffff)', border:'1px solid var(--border,#e2e8f0)', color:'var(--text,#1a1916)'}}
                onClick={() => {
                  setTicketTx({...printMenuTx, size:'MM80'})
                  setPrintMenuTx(null)
                }}
              >
                🧾 Ticket 80 mm
              </button>
              
              {printMenuTx.type === 'VENTE' && (
                <button 
                  className="btn btn-lg" 
                  style={{background:'var(--primary,#2563eb)', color:'white'}}
                  onClick={async () => {
                    // Vérifier si une attestation existe déjà pour cette transaction
                    if (printMenuTx.id) {
                      const { getAttestationByTransactionIdAction } = await import('@/actions/transaction.actions')
                      const res = await getAttestationByTransactionIdAction(printMenuTx.id)
                      if (res.success && res.attestation) {
                        // Attestation existe → ouvrir en mode édition
                        setExistingAttestation(res.attestation)
                      } else {
                        // Pas d'attestation → mode création
                        setExistingAttestation(null)
                      }
                    }
                    setAttestationTx(printMenuTx)
                    setPrintMenuTx(null)
                  }}
                >
                  📄 Attestation de change
                </button>
              )}
            </div>

            <div className="btn-group mt-16">
              <button className="btn btn-outline btn-block" onClick={() => setPrintMenuTx(null)}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL ADMIN OVERRIDE (depuis poste caissier) ─────────────────── */}
      {overridePending && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && !loading && setOverridePending(null)}>
          <div className="modal" style={{maxWidth: 420}}>
            <div className="modal-header">
              <h3 className="modal-title">🔐 Validation administrateur requise</h3>
              <button className="modal-close" onClick={() => setOverridePending(null)} disabled={loading}>×</button>
            </div>

            {/* Contexte de l'action demandée */}
            <div className="alert alert-info" style={{marginBottom: 16, fontSize: 13}}>
              {overridePending.action === 'delete' ? (
                <>Suppression de <strong>{overridePending.tx.receiptNo}</strong> — un administrateur doit valider cette action.</>
              ) : (
                <>Modification de <strong>{overridePending.tx.receiptNo}</strong> — un administrateur doit valider cette action.</>
              )}
            </div>

            {/* Champs edit affichés en cas d'action edit */}
            {overridePending.action === 'edit' && (
              <div style={{background:'var(--surface-2,#f8fafc)', borderRadius:8, padding:12, marginBottom:16}}>
                <div style={{fontSize:12, color:'var(--muted,#6b7280)', marginBottom:8, fontWeight:600}}>
                  MODIFICATIONS À APPLIQUER
                </div>
                <div className="form-row">
                  <div className="form-group" style={{marginBottom:8}}>
                    <label className="form-label" style={{fontSize:12}}>Montant ({overridePending.tx.currency.code})</label>
                    <input className="form-control" type="number" step="0.01" min="0"
                      value={editAmount} onChange={e => setEditAmount(e.target.value)} />
                  </div>
                  <div className="form-group" style={{marginBottom:8}}>
                    <label className="form-label" style={{fontSize:12}}>Taux (Ar)</label>
                    <input className="form-control" type="number" step="1" min="0"
                      value={editRate} onChange={e => setEditRate(e.target.value)} />
                  </div>
                </div>
                <div className="form-group" style={{marginBottom:8}}>
                  <label className="form-label" style={{fontSize:12}}>Commission (Ar)</label>
                  <input className="form-control" type="number" step="100" min="0"
                    value={editCommission} onChange={e => setEditCommission(e.target.value)} />
                </div>
                <div className="form-group" style={{marginBottom:0}}>
                  <label className="form-label" style={{fontSize:12}}>Note</label>
                  <input className="form-control" placeholder="Remarque…"
                    value={editNote} onChange={e => setEditNote(e.target.value)} />
                </div>
              </div>
            )}

            {/* Credentials admin */}
            <div style={{borderTop:'1px solid var(--border,#e2e8f0)', paddingTop:16, marginBottom:8}}>
              <div style={{fontSize:12, color:'var(--muted,#6b7280)', marginBottom:10, fontWeight:600}}>
                🔑 IDENTIFIANTS ADMINISTRATEUR
              </div>
              <div className="form-group">
                <label className="form-label">Identifiant admin</label>
                <input
                  className="form-control"
                  placeholder="ex: admin"
                  autoFocus
                  autoComplete="off"
                  value={overrideUsername}
                  onChange={e => { setOverrideUsername(e.target.value); setOverrideError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleOverride()}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Mot de passe admin</label>
                <input
                  className="form-control"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  value={overridePassword}
                  onChange={e => { setOverridePassword(e.target.value); setOverrideError('') }}
                  onKeyDown={e => e.key === 'Enter' && handleOverride()}
                />
              </div>
            </div>

            {overrideError && (
              <div className="alert alert-error" style={{marginBottom: 12}}>
                ❌ {overrideError}
              </div>
            )}

            <div className="btn-group mt-16">
              <button
                className={`btn btn-lg ${overridePending.action === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                onClick={handleOverride}
                disabled={loading || !overrideUsername || !overridePassword}
              >
                {loading
                  ? 'Validation…'
                  : overridePending.action === 'delete'
                    ? '🗑️ Valider la suppression'
                    : '✏️ Valider la modification'
                }
              </button>
              <button className="btn btn-outline" onClick={() => setOverridePending(null)} disabled={loading}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
