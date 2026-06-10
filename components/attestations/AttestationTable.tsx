'use client'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { formatMGA, formatCurrency, formatDate, formatTime, formatNumber } from '@/lib/utils'
import { mgaToWords } from '@/lib/number-to-words'
import AttestationModal from '@/components/ticket/AttestationModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttestationRow {
  id:                string
  attestationNo:     string
  transactionId?:    string | null
  receiptNo:         string
  clientName:        string
  passportNo:        string
  passportIssuedAt:  string
  passportExpiresAt: string
  nationality:       string
  clientAddress:     string | null
  destination:       string | null
  travelNature:      string | null
  transportTitle:    string | null
  ticketNo:          string | null
  departureDate:     string | null
  returnDate:        string | null
  currencyCode:      string
  currencyFlag:      string
  amount:            number
  rate:              number
  commission:        number
  totalMGA:          number
  createdAt:         Date | string
  user:              { name: string } | null
}

interface Props {
  attestations:  AttestationRow[]
  total:         number
  // Données bureau transmises depuis la page pour la réimpression
  bureauName:    string
  bureauAddress: string
  bureauPhone:   string
  bureauFooter:  string
  bureauNif?:    string | null
  bureauStat?:   string | null
  bureauEmail?:  string | null
  bureauRib?:    string | null
  logoBase64?:   string | null
}

// ── Formateurs ────────────────────────────────────────────────────────────────

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

function formatDateQr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}-${m}-${y}`
}

// ── Génération du HTML pour réimpression ─────────────────────────────────────

async function buildReprintHtml(a: AttestationRow, bureau: {
  bureauName: string; bureauAddress: string; bureauPhone: string; bureauFooter: string
  nif?: string|null; stat?: string|null; email?: string|null; rib?: string|null
  logoBase64?: string|null
}): Promise<string> {  // [MODIFIÉ] : async pour permettre la génération du QR code localement
  const txDate = new Date(a.createdAt)

  const logoHtml = bureau.logoBase64?.startsWith('data:image/')
    ? `<img src="${bureau.logoBase64}" alt="Logo" style="max-height:60px;max-width:150px;object-fit:contain;display:block;"/>`
    : ''

  // [CORRECTION] : QR code généré localement (hors ligne)
  const qrLines = [
    `Ref : ${a.attestationNo}`,
    `Client : ${a.clientName}`,
    `Devise : ${a.currencyCode}`,
    `Montant : ${a.amount} ${a.currencyCode}`,
    `Taux : ${a.rate} Ar/${a.currencyCode}`,
    `Total MGA : ${a.totalMGA} Ar`,
    `Date : ${formatDateQr(txDate.toISOString().slice(0, 10))}`,
  ].join('\n')

  // [CORRECTION] : Générer le QR localement (asynchrone)
  const { generateQrSvg } = await import('@/lib/qr-generator')
  const qrSvg = await generateQrSvg(qrLines)

  // Attestation payante (transactionId = null) :
  //   montantAffiche = amount × rate  (valeur change affichée sur le document)
  //   a.totalMGA                      (prix de l'attestation, historique uniquement)
  // Attestation liée à vente (transactionId != null) :
  //   montantAffiche = a.totalMGA     (valeur réelle de l'opération)
  const isPayante = !a.transactionId
  const montantAffiche = isPayante ? a.amount * a.rate : a.totalMGA
  const montantLettres = mgaToWords(montantAffiche)

  const formatDate2 = (d: Date) => d.toLocaleDateString('fr-FR')
  const formatTime2 = (d: Date) => d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  const formatMGA2  = (n: number) => n.toLocaleString('fr-FR') + ' Ar'
  const formatNum   = (n: number) => n.toLocaleString('fr-FR')
  const formatCur   = (n: number, code: string) => n.toLocaleString('fr-FR') + ' ' + code

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Attestation — ${a.attestationNo}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body { font-family: 'Times New Roman', Times, serif; font-size: 12pt; color: #1a1a1a; background: #fff; width: 210mm; min-height: 297mm; padding: 18mm 20mm }
  .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #1a3a6b; padding-bottom: 12px; margin-bottom: 16px }
  .header-left { display: flex; align-items: flex-start; gap: 14px; flex: 1 }
  .bureau-name { font-size: 17pt; font-weight: 700; color: #1a3a6b }
  .bureau-detail { font-size: 9.5pt; color: #444; margin-top: 3px; line-height: 1.5 }
  .attestation-ref { text-align: right; font-size: 9pt; color: #555; min-width: 160px }
  .ref-no { font-size: 10.5pt; font-weight: 700; color: #1a3a6b }
  .doc-title { text-align: center; margin: 18px 0 14px; font-size: 15pt; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #1a3a6b; border: 2px solid #1a3a6b; padding: 8px }
  .section { margin-bottom: 14px }
  .section-title { font-size: 10pt; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #1a3a6b; border-bottom: 1px solid #1a3a6b; padding-bottom: 3px; margin-bottom: 8px }
  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px }
  .data-row { display: flex; gap: 6px; font-size: 10.5pt; line-height: 1.6 }
  .data-label { color: #555; white-space: nowrap; min-width: 130px }
  .data-label::after { content: ' :' }
  .data-value { font-weight: 600; color: #1a1a1a }
  .amount-box { border: 2px solid #1a3a6b; border-radius: 4px; padding: 12px 16px; margin: 14px 0; background: #f7f9fc }
  .amount-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px }
  .amount-label { font-size: 10.5pt; color: #444; font-weight: 600 }
  .amount-value { font-size: 16pt; font-weight: 700; color: #1a3a6b }
  .amount-words { font-size: 10pt; font-style: italic; color: #333; border-top: 1px dashed #ccc; padding-top: 8px; line-height: 1.5 }
  .amount-words strong { font-style: normal; font-weight: 700 }
  .details-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 6px }
  .details-table th { background: #1a3a6b; color: #fff; padding: 5px 10px; text-align: left; font-size: 9.5pt }
  .details-table td { padding: 5px 10px; border-bottom: 1px solid #e0e0e0 }
  .details-table td:last-child { text-align: right; font-weight: 600 }
  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px }
  .sign-block { text-align: center }
  .sign-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 6px }
  .sign-label { font-size: 9.5pt; color: #555 }
  .stamp-area { height: 70px; border: 1px dashed #aaa; border-radius: 50%; width: 100px; margin: 10px auto 0; display: flex; align-items: center; justify-content: center; color: #aaa; font-size: 8pt; text-align: center }
  .doc-footer-wrap { margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px; display: flex; justify-content: space-between; align-items: flex-end; gap: 16px }
  .doc-footer-text { flex: 1; font-size: 8.5pt; color: #777; line-height: 1.6 }
  .doc-footer-qr { flex-shrink: 0; text-align: center }
  .doc-footer-qr img { display: block; width: 100px; height: 100px }
  .doc-footer-qr div { font-size: 7pt; color: #aaa; margin-top: 3px }
  .reprint-banner { background: #fff8e1; border: 1px solid #f59e0b; border-radius: 4px; padding: 4px 10px; font-size: 8pt; color: #92400e; text-align: center; margin-bottom: 12px }
  @media print { @page { size: A4; margin: 0 } body { padding: 15mm 18mm } .reprint-banner { display: none } }
</style>
</head>
<body>

<div class="reprint-banner">⚠️ Duplicata — Document original émis le ${formatDate2(txDate)} à ${formatTime2(txDate)}</div>

<div class="header">
  <div class="header-left">
    ${logoHtml ? `<div style="flex-shrink:0;margin-right:4px">${logoHtml}</div>` : ''}
    <div>
      <div class="bureau-name">${bureau.bureauName}</div>
      <div class="bureau-detail">📍 ${bureau.bureauAddress}<br>📞 ${bureau.bureauPhone}${bureau.email ? `&nbsp;&nbsp;✉️ ${bureau.email}` : ''}</div>
      ${bureau.nif || bureau.stat ? `<div class="bureau-detail" style="margin-top:4px">${bureau.nif ? `NIF : <strong>${bureau.nif}</strong>` : ''}${bureau.nif && bureau.stat ? ' | ' : ''}${bureau.stat ? `STAT : <strong>${bureau.stat}</strong>` : ''}</div>` : ''}
      ${bureau.rib ? `<div class="bureau-detail">RIB : <strong>${bureau.rib}</strong></div>` : ''}
    </div>
  </div>
  <div class="attestation-ref">
    <div style="font-size:8.5pt;color:#888;margin-bottom:4px">ATTESTATION N°</div>
    <div class="ref-no">${a.attestationNo}</div>
    <div style="margin-top:6px;font-size:9pt">Date : <strong>${formatDate2(txDate)}</strong><br>Heure : <strong>${formatTime2(txDate)}</strong></div>
  </div>
</div>

<div class="doc-title">Attestation de Change de Devises</div>

<div class="section">
  <div class="section-title">👤 Informations du client</div>
  <div class="data-grid">
    <div class="data-row"><span class="data-label">Nom et prénom</span><span class="data-value">${a.clientName}</span></div>
    <div class="data-row"><span class="data-label">Nationalité</span><span class="data-value">${a.nationality}</span></div>
    <div class="data-row"><span class="data-label">Passeport N°</span><span class="data-value">${a.passportNo}</span></div>
    <div class="data-row"><span class="data-label">Date de délivrance</span><span class="data-value">${formatDateDisplay(a.passportIssuedAt)}</span></div>
    <div class="data-row"><span class="data-label">Date d'expiration</span><span class="data-value">${formatDateDisplay(a.passportExpiresAt)}</span></div>
    ${a.clientAddress ? `<div class="data-row"><span class="data-label">Adresse</span><span class="data-value">${a.clientAddress}</span></div>` : ''}
  </div>
</div>

${(a.destination || a.travelNature || a.transportTitle || a.ticketNo || a.departureDate || a.returnDate) ? `
<div class="section">
  <div class="section-title">✈️ Informations du voyage</div>
  <div class="data-grid">
    ${a.destination    ? `<div class="data-row"><span class="data-label">Destination</span><span class="data-value">${a.destination}</span></div>` : ''}
    ${a.travelNature   ? `<div class="data-row"><span class="data-label">Nature du voyage</span><span class="data-value">${a.travelNature}</span></div>` : ''}
    ${a.transportTitle ? `<div class="data-row"><span class="data-label">Titre de transport</span><span class="data-value">${a.transportTitle}</span></div>` : ''}
    ${a.ticketNo       ? `<div class="data-row"><span class="data-label">Numéro de billet</span><span class="data-value">${a.ticketNo}</span></div>` : ''}
    ${a.departureDate  ? `<div class="data-row"><span class="data-label">Date de départ</span><span class="data-value">${formatDateDisplay(a.departureDate)}</span></div>` : ''}
    ${a.returnDate     ? `<div class="data-row"><span class="data-label">Date de retour</span><span class="data-value">${formatDateDisplay(a.returnDate)}</span></div>` : ''}
  </div>
</div>` : ''}

<div class="section">
  <div class="section-title">💱 Détails de l'opération</div>
  <table class="details-table">
    <thead><tr><th>Désignation</th><th>Devise étrangère</th><th>Taux appliqué</th><th>Montant MGA</th></tr></thead>
    <tbody>
      <tr>
        <td>Vente de devises</td>
        <td>${a.currencyFlag} ${formatCur(a.amount, a.currencyCode)}</td>
        <td>${a.rate > 0 ? `${formatNum(a.rate)} Ar/${a.currencyCode}` : '—'}</td>
        <td>${a.rate > 0 ? formatMGA2(a.amount * a.rate) : formatMGA2(montantAffiche)}</td>
      </tr>
      ${a.commission > 0 ? `<tr><td>Commission</td><td>—</td><td>—</td><td>- ${formatMGA2(a.commission)}</td></tr>` : ''}
    </tbody>
  </table>
</div>

<div class="amount-box">
  <div class="amount-main">
    <span class="amount-label">Montant total remis au client :</span>
    <span class="amount-value">${formatMGA2(montantAffiche)}</span>
  </div>
  <div class="amount-words">Arrêté à la somme de : <strong>${montantLettres}</strong></div>
</div>

<div class="section">
  <div class="section-title">📋 Référence de la transaction</div>
  <div class="data-grid">
    <div class="data-row"><span class="data-label">N° de reçu</span><span class="data-value">${a.receiptNo}</span></div>
    <div class="data-row"><span class="data-label">Type d'opération</span><span class="data-value">VENTE DE DEVISES</span></div>
    <div class="data-row"><span class="data-label">Caissier</span><span class="data-value">${a.user?.name ?? '—'}</span></div>
    <div class="data-row"><span class="data-label">Date / Heure</span><span class="data-value">${formatDate2(txDate)} à ${formatTime2(txDate)}</span></div>
  </div>
</div>

<div class="signatures">
  <div class="sign-block">
    <div class="sign-line"></div>
    <div class="sign-label">Signature du client<br><em>${a.clientName}</em></div>
  </div>
  <div class="sign-block">
    <div class="sign-line"><div class="stamp-area">Cachet<br>Bureau</div></div>
    <div class="sign-label">Le responsable<br><em>${bureau.bureauName}</em></div>
  </div>
</div>

<div class="doc-footer-wrap">
  <div class="doc-footer-text">
    <div>${bureau.bureauFooter}</div>
    <div style="margin-top:3px">Document officiel — Valide uniquement avec cachet et signature du responsable autorisé</div>
    <div style="margin-top:3px;font-size:7.5pt;color:#aaa">Réf. ${a.attestationNo} — Scannez le QR code pour vérifier l'authenticité</div>
  </div>
    <div class="doc-footer-qr">
    ${qrSvg}
    <div>Vérification</div>
  </div>
</div>

<script>window.onload = () => { window.print() }<\/script>
</body>
</html>`
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function AttestationTable({
  attestations, total,
  bureauName, bureauAddress, bureauPhone, bureauFooter,
  bureauNif, bureauStat, bureauEmail, bureauRib, logoBase64,
}: Props) {
  const router = useRouter()
  const sp     = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const [dateFrom, setDateFrom] = useState(sp.get('dateFrom') || '')
  const [dateTo,   setDateTo]   = useState(sp.get('dateTo')   || '')
  const [search,   setSearch]   = useState(sp.get('search')   || '')
  const [detail,   setDetail]   = useState<AttestationRow | null>(null)
  const [editingAttestation, setEditingAttestation] = useState<AttestationRow | null>(null)

  function applyFilters() {
    const p = new URLSearchParams()
    if (dateFrom) p.set('dateFrom', dateFrom)
    if (dateTo)   p.set('dateTo',   dateTo)
    if (search)   p.set('search',   search)
    startTransition(() => router.push('/transactions/attestations?' + p.toString()))
  }

  function resetFilters() {
    setDateFrom(''); setDateTo(''); setSearch('')
    startTransition(() => router.push('/transactions/attestations'))
  }

  function exportCSV() {
    const rows = [['N° Attestation','N° Reçu','Date','Client','Nationalité','Passeport','Devise','Montant','Taux','Total MGA','Destination','Caissier']]
    attestations.forEach(a => rows.push([
      a.attestationNo, a.receiptNo, formatDate(new Date(a.createdAt)),
      a.clientName, a.nationality, a.passportNo,
      a.currencyCode, String(a.amount), String(a.rate), String(a.totalMGA),
      a.destination ?? '', a.user?.name ?? '',
    ]))
    const csv  = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href = url; a.download = `attestations_${new Date().toISOString().slice(0, 10)}.csv`
    a.click(); URL.revokeObjectURL(url)
  }

  async function handleReprint(a: AttestationRow) {
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) { alert('Veuillez autoriser les popups pour imprimer.'); return }
    
    // Afficher un loader pendant la génération
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#1a3a6b;font-size:16px}</style>
    </head><body>⏳ Génération du duplicata…</body></html>`)
    
    try {
      const html = await buildReprintHtml(a, {
        bureauName, bureauAddress, bureauPhone, bureauFooter,
        nif: bureauNif, stat: bureauStat, email: bureauEmail, rib: bureauRib,
        logoBase64,
      })
      win.document.open()
      win.document.write(html)
      win.document.close()
    } catch (error) {
      console.error('Erreur impression:', error)
      win.close()
      alert('Erreur lors de la génération du duplicata.')
    }
  }

  return (
    <>
      {/* ── Filtres ─────────────────────────────────────────────────────── */}
      <div className="card filter-bar">
        <div className="filter-grid">
          <div className="form-group mb-0">
            <label className="form-label">Date début</label>
            <input className="form-control" type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}/>
          </div>
          <div className="form-group mb-0">
            <label className="form-label">Date fin</label>
            <input className="form-control" type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}/>
          </div>
          <div className="form-group mb-0" style={{gridColumn:'span 2'}}>
            <label className="form-label">Recherche</label>
            <input className="form-control"
              placeholder="N° attestation, N° reçu, nom client, passeport..."
              value={search} onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && applyFilters()}
            />
          </div>
          <div className="filter-actions">
            <button className="btn btn-primary" onClick={applyFilters} disabled={isPending}>Filtrer</button>
            <button className="btn btn-outline" onClick={resetFilters}>Réinit.</button>
          </div>
        </div>
      </div>

      {/* ── Tableau ─────────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">📄 Attestations ({total})</h2>
          <button className="btn btn-sm btn-outline" onClick={exportCSV}>⬇ CSV</button>
        </div>

        {attestations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📄</div>
            <div>Aucune attestation enregistrée</div>
            <div style={{fontSize:12, color:'var(--muted,#9ca3af)', marginTop:4}}>
              Les attestations sont archivées automatiquement lors de l'impression depuis l'historique des transactions
            </div>
          </div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>N° Attestation</th>
                  <th>N° Reçu</th>
                  <th>Date</th>
                  <th>Heure</th>
                  <th>Client</th>
                  <th>Nationalité</th>
                  <th>Devise</th>
                  <th>Montant</th>
                  <th>Total MGA</th>
                  <th>Destination</th>
                  <th>Caissier</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attestations.map(a => (
                  <tr key={a.id}>
                    <td><strong style={{fontFamily:'monospace', fontSize:11}}>{a.attestationNo}</strong></td>
                    <td><span style={{fontSize:11, color:'var(--muted,#6b7280)'}}>{a.receiptNo}</span></td>
                    <td>{formatDate(new Date(a.createdAt))}</td>
                    <td>{formatTime(new Date(a.createdAt))}</td>
                    <td className="fw-600">{a.clientName}</td>
                    <td>{a.nationality}</td>
                    <td>{a.currencyFlag} {a.currencyCode}</td>
                    <td>{formatCurrency(a.amount, a.currencyCode)}</td>
                    <td className="fw-600">{formatMGA(a.totalMGA)}</td>
                    <td>{a.destination ?? '—'}</td>
                    <td>{a.user?.name ?? '—'}</td>
                    <td>
                      <div style={{display:'flex', gap:4}}>
                        <button className="btn btn-sm btn-outline" onClick={() => setDetail(a)} title="Consulter">🔍</button>
                        <button className="btn btn-sm btn-outline" onClick={() => handleReprint(a)} title="Réimprimer">🖨️</button>
                        <button className="btn btn-sm btn-outline" style={{color:'var(--warning,#f59e0b)'}} onClick={() => setEditingAttestation(a)} title="Modifier">✏️</button>
                      </div>
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

      {/* ── Modal détail ─────────────────────────────────────────────────── */}
      {detail && (
        <div className="modal-overlay" onClick={e => e.target === e.currentTarget && setDetail(null)}>
          <div className="modal" style={{maxWidth: 580, maxHeight: '90vh', overflowY: 'auto'}}>
            <div className="modal-header">
              <h3 className="modal-title">📄 {detail.attestationNo}</h3>
              <button className="modal-close" onClick={() => setDetail(null)}>×</button>
            </div>

            <div style={{fontSize:11, color:'var(--muted,#6b7280)', marginBottom:12}}>
              Émise le {formatDate(new Date(detail.createdAt))} à {formatTime(new Date(detail.createdAt))}
              {detail.user && ` — par ${detail.user.name}`}
            </div>

            <div style={{fontWeight:700, fontSize:11, color:'var(--primary,#2563eb)', borderBottom:'1px solid var(--border,#e2e8f0)', paddingBottom:4, marginBottom:8}}>
              👤 IDENTITÉ DU CLIENT
            </div>
            <div className="info-box" style={{marginBottom:12}}>
              <div className="ib-row"><span className="ib-label">Client</span><span className="ib-value fw-600">{detail.clientName}</span></div>
              <div className="ib-row"><span className="ib-label">Nationalité</span><span className="ib-value">{detail.nationality}</span></div>
              <div className="ib-row"><span className="ib-label">Passeport N°</span><span className="ib-value">{detail.passportNo}</span></div>
              <div className="ib-row"><span className="ib-label">Délivré le</span><span className="ib-value">{formatDateDisplay(detail.passportIssuedAt)}</span></div>
              <div className="ib-row"><span className="ib-label">Expire le</span><span className="ib-value">{formatDateDisplay(detail.passportExpiresAt)}</span></div>
              {detail.clientAddress && <div className="ib-row"><span className="ib-label">Adresse</span><span className="ib-value">{detail.clientAddress}</span></div>}
            </div>

            {(detail.destination || detail.travelNature) && (
              <>
                <div style={{fontWeight:700, fontSize:11, color:'var(--primary,#2563eb)', borderBottom:'1px solid var(--border,#e2e8f0)', paddingBottom:4, marginBottom:8}}>✈️ VOYAGE</div>
                <div className="info-box" style={{marginBottom:12}}>
                  {detail.destination  && <div className="ib-row"><span className="ib-label">Destination</span><span className="ib-value fw-600">{detail.destination}</span></div>}
                  {detail.travelNature && <div className="ib-row"><span className="ib-label">Nature</span><span className="ib-value">{detail.travelNature}</span></div>}
                  {detail.transportTitle && <div className="ib-row"><span className="ib-label">Transport</span><span className="ib-value">{detail.transportTitle}</span></div>}
                  {detail.ticketNo && <div className="ib-row"><span className="ib-label">N° billet</span><span className="ib-value">{detail.ticketNo}</span></div>}
                  {detail.departureDate && <div className="ib-row"><span className="ib-label">Départ</span><span className="ib-value">{formatDateDisplay(detail.departureDate)}</span></div>}
                  {detail.returnDate && <div className="ib-row"><span className="ib-label">Retour</span><span className="ib-value">{formatDateDisplay(detail.returnDate)}</span></div>}
                </div>
              </>
            )}

            <div style={{fontWeight:700, fontSize:11, color:'var(--primary,#2563eb)', borderBottom:'1px solid var(--border,#e2e8f0)', paddingBottom:4, marginBottom:8}}>💱 OPÉRATION DE CHANGE</div>
            <div className="info-box" style={{marginBottom:12}}>
              <div className="ib-row"><span className="ib-label">N° Reçu</span><span className="ib-value">{detail.receiptNo}</span></div>
              <div className="ib-row"><span className="ib-label">Devise</span><span className="ib-value">{detail.currencyFlag} {detail.currencyCode}</span></div>
              <div className="ib-row"><span className="ib-label">Montant</span><span className="ib-value">{formatCurrency(detail.amount, detail.currencyCode)}</span></div>
              <div className="ib-row"><span className="ib-label">Taux</span><span className="ib-value">{formatNumber(detail.rate)} Ar/{detail.currencyCode}</span></div>
              {detail.commission > 0 && <div className="ib-row"><span className="ib-label">Commission</span><span className="ib-value">- {formatMGA(detail.commission)}</span></div>}
              <div className="ib-row"><span className="ib-label">Total MGA remis</span><span className="ib-value fw-600" style={{color:'var(--primary,#2563eb)'}}>{formatMGA(detail.totalMGA)}</span></div>
            </div>

            <div className="btn-group mt-16">
              <button className="btn btn-primary" onClick={() => { handleReprint(detail); setDetail(null) }}>
                🖨️ Réimprimer
              </button>
              <button className="btn btn-outline" onClick={() => setDetail(null)}>Fermer</button>
            </div>
          </div>
        </div>
            )}

      {/* ── Modal édition ─────────────────────────────────────────────────── */}
      {editingAttestation && (
        <AttestationModal
          transaction={{
            id: editingAttestation.transactionId || undefined,
            receiptNo: editingAttestation.receiptNo,
            createdAt: editingAttestation.createdAt,
            amount: editingAttestation.amount,
            rate: editingAttestation.rate,
            commission: editingAttestation.commission,
            totalMGA: editingAttestation.totalMGA,
            currency: {
              code: editingAttestation.currencyCode,
              flag: editingAttestation.currencyFlag,
              name: editingAttestation.currencyCode,
            },
            user: editingAttestation.user,
          }}
          bureau={{
            bureauName,
            bureauAddress,
            bureauPhone,
            bureauFooter,
            nif: bureauNif,
            stat: bureauStat,
            email: bureauEmail,
            rib: bureauRib,
            logoBase64,
          }}
          existingAttestation={editingAttestation}
          onClose={() => {
            setEditingAttestation(null)
            // Recharger la page pour voir les modifications
            setTimeout(() => window.location.reload(), 500)
          }}
        />
      )}
    </>
  )
}
