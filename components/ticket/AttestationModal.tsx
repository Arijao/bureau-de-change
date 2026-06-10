'use client'
import { useState } from 'react'
import { formatMGA, formatCurrency, formatNumber, formatDate, formatTime } from '@/lib/utils'
import { mgaToWords } from '@/lib/number-to-words'
import { saveAttestationAction } from '@/actions/transaction.actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AttestationTx {
  id?: string
  receiptNo: string
  createdAt: string | Date
  amount: number
  rate: number
  commission: number
  totalMGA?: number
  mgaAmount?: number
  currency: { code: string; flag: string; name: string }
  user?: { name: string } | null
}

interface Bureau {
  bureauName: string
  bureauAddress: string
  bureauPhone: string
  bureauFooter: string
  nif?: string | null
  stat?: string | null
  email?: string | null
  rib?: string | null
  logoBase64?: string | null
}

interface ExistingAttestation {
  id: string
  attestationNo: string
  clientName: string
  passportNo: string
  passportIssuedAt: string
  passportExpiresAt: string
  nationality: string
  clientAddress?: string | null
  destination?: string | null
  travelNature?: string | null
  transportTitle?: string | null
  ticketNo?: string | null
  departureDate?: string | null
  returnDate?: string | null
}

interface Props {
  transaction: AttestationTx
  bureau: Bureau
  existingAttestation?: ExistingAttestation | null
  onClose: () => void
}

// ── Formateur de date depuis input type="date" (YYYY-MM-DD → DD/MM/YYYY) ─────
function formatDateInput(dateStr: string): string {
  if (!dateStr) return '—'
  const [y, m, d] = dateStr.split('-')
  return `${d}/${m}/${y}`
}

// ── Formateur de date pour le QR code (YYYY-MM-DD → DD-MM-YYYY) ──────────────
function formatDateQr(isoDate: string): string {
  const [y, m, d] = isoDate.split('-')
  return `${d}-${m}-${y}`
}

// ── Génération QR code — texte multiligne lisible ─────────────────────────────
// [CORRIGÉ] : texte brut formaté sur plusieurs lignes, séparées par %0A (newline encodé).
// Lisible directement par tout lecteur QR (Google Lens, apps mobiles).
// [CORRECTION] : QR code généré localement (hors ligne)
async function buildQrSvg(attestationNo: string, data: {
  client: string; devise: string; montant: number; taux: number; total: number; date: string
}): Promise<string> {
  const lines = [
    `Ref : ${attestationNo}`,
    `Client : ${data.client}`,
    `Devise : ${data.devise}`,
    `Montant : ${data.montant} ${data.devise}`,
    `Taux : ${data.taux} Ar/${data.devise}`,
    `Total MGA : ${data.total} Ar`,
    `Date : ${formatDateQr(data.date)}`,
  ]
  const text = lines.join('\n')
  const { generateQrSvg } = await import('@/lib/qr-generator')
  return generateQrSvg(text)
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function AttestationModal({ transaction: tx, bureau, existingAttestation, onClose }: Props) {
  const isEditMode = !!existingAttestation
  // ── Identité client ───────────────────────────────────────────────────────
  const [clientName,        setClientName]        = useState(existingAttestation?.clientName ?? '')
  const [passportNo,        setPassportNo]        = useState(existingAttestation?.passportNo ?? '')
  const [passportIssuedAt,  setPassportIssuedAt]  = useState(existingAttestation?.passportIssuedAt ?? '')
  const [passportExpiresAt, setPassportExpiresAt] = useState(existingAttestation?.passportExpiresAt ?? '')
  const [nationality,       setNationality]       = useState(existingAttestation?.nationality ?? '')
  const [clientAddress,     setClientAddress]     = useState(existingAttestation?.clientAddress ?? '')

  // ── Informations du voyage ────────────────────────────────────────────────
  const [transportTitle,    setTransportTitle]    = useState(existingAttestation?.transportTitle ?? '')
  const [ticketNo,          setTicketNo]          = useState(existingAttestation?.ticketNo ?? '')
  const [departureDate,     setDepartureDate]     = useState(existingAttestation?.departureDate ?? '')
  const [returnDate,        setReturnDate]        = useState(existingAttestation?.returnDate ?? '')
  const [destination,       setDestination]       = useState(existingAttestation?.destination ?? '')
  const [travelNature,      setTravelNature]      = useState(existingAttestation?.travelNature ?? '')

  const [step, setStep] = useState<'form' | 'preview'>('form')

  // ── Archivage ─────────────────────────────────────────────────────────────
  const [archiveStatus, setArchiveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
    isEditMode ? 'saved' : 'idle'
  )
  const [attestationNo, setAttestationNo] = useState<string>(
    existingAttestation?.attestationNo ?? ''
  )

  const total          = Number(tx.totalMGA ?? tx.mgaAmount ?? 0)
  const montantLettres = mgaToWords(total)

  // ── Archivage ─────────────────────────────────────────────────────────────
  // [CORRIGÉ] : retourne le numéro pour que handlePrint puisse l'utiliser
  // synchronement dans buildHtml() sans dépendre de l'état React (qui est async).

  async function archiveAndGetNo(): Promise<string> {
    // Si déjà archivée, retourner le numéro existant
    if (archiveStatus === 'saved' && attestationNo) return attestationNo

    setArchiveStatus('saving')
    try {
      const inputData = {
        transactionId:     tx.id,
        receiptNo:         tx.receiptNo,
        clientName:        clientName.trim(),
        passportNo:        passportNo.trim(),
        passportIssuedAt,
        passportExpiresAt,
        nationality:       nationality.trim(),
        clientAddress:     clientAddress.trim()  || undefined,
        destination:       destination.trim()    || undefined,
        travelNature:      travelNature.trim()   || undefined,
        transportTitle:    transportTitle.trim() || undefined,
        ticketNo:          ticketNo.trim()        || undefined,
        departureDate:     departureDate          || undefined,
        returnDate:        returnDate             || undefined,
        currencyCode:      tx.currency.code,
        currencyFlag:      tx.currency.flag,
        amount:            tx.amount,
        rate:              tx.rate,
        commission:        tx.commission,
        totalMGA:          total,
      }

      let res
      if (isEditMode && existingAttestation) {
        // Mode édition : mise à jour
        const { updateAttestationAction } = await import('@/actions/transaction.actions')
        res = await updateAttestationAction(existingAttestation.id, inputData)
      } else {
        // Mode création : nouvelle attestation
        res = await saveAttestationAction(inputData)
      }

      if (res.error || !res.attestation) {
        setArchiveStatus('error')
        // Fallback : générer un numéro temporaire local pour ne pas bloquer l'impression
        const now  = new Date()
        const yy   = String(now.getFullYear() % 100).padStart(2, '0')
        const mm   = String(now.getMonth() + 1).padStart(2, '0')
        return `ATT/${mm}/${yy}-${tx.receiptNo}`
      }

      const no = res.attestation.attestationNo
      setAttestationNo(no)
      setArchiveStatus('saved')
      return no
    } catch {
      setArchiveStatus('error')
      return `ATT-${tx.receiptNo}`
    }
  }

  // ── Génération du HTML imprimable ─────────────────────────────────────────

  // [CORRECTION] : buildHtml est maintenant async pour générer le QR localement
  async function buildHtml(no: string): Promise<string> {
  const txDate    = new Date(tx.createdAt)
  // [CORRECTION] : Générer le QR code localement
  const qrData = {
    client:  clientName,
    devise:  tx.currency.code,
    montant: tx.amount,
    taux:    tx.rate,
    total,
    date:    txDate.toISOString().slice(0, 10),
  }
  const qrLines = [
    `Ref : ${no}`,
    `Client : ${qrData.client}`,
    `Devise : ${qrData.devise}`,
    `Montant : ${qrData.montant} ${qrData.devise}`,
    `Taux : ${qrData.taux} Ar/${qrData.devise}`,
    `Total MGA : ${qrData.total} Ar`,
    `Date : ${formatDateQr(qrData.date)}`,
  ].join('\n')
  const { generateQrDataUrl } = await import('@/lib/qr-generator')
  const qrUrl = await generateQrDataUrl(qrLines)

    // [CORRIGÉ] : logo affiché seulement si non null et non vide
    const logoHtml = bureau.logoBase64 && bureau.logoBase64.startsWith('data:image/')
      ? `<img src="${bureau.logoBase64}" alt="Logo" style="max-height:60px;max-width:150px;object-fit:contain;display:block;"/>`
      : ''

    return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Attestation de change — ${no}</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0 }
  body {
    font-family: 'Times New Roman', Times, serif;
    font-size: 12pt;
    color: #1a1a1a;
    background: #fff;
    width: 210mm;
    min-height: 297mm;
    padding: 18mm 20mm;
  }

  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 3px double #1a3a6b;
    padding-bottom: 12px;
    margin-bottom: 16px;
  }
  .header-left { display: flex; align-items: flex-start; gap: 14px; flex: 1 }
  .bureau-info { flex: 1 }
  .bureau-name { font-size: 17pt; font-weight: 700; color: #1a3a6b; letter-spacing: 0.5px }
  .bureau-detail { font-size: 9.5pt; color: #444; margin-top: 3px; line-height: 1.5 }
  .attestation-ref { text-align: right; font-size: 9pt; color: #555; min-width: 160px }
  .attestation-ref .ref-no { font-size: 10.5pt; font-weight: 700; color: #1a3a6b }

  .doc-title {
    text-align: center;
    margin: 18px 0 14px;
    font-size: 15pt;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #1a3a6b;
    border: 2px solid #1a3a6b;
    padding: 8px;
  }

  .section { margin-bottom: 14px }
  .section-title {
    font-size: 10pt; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #1a3a6b;
    border-bottom: 1px solid #1a3a6b; padding-bottom: 3px; margin-bottom: 8px;
  }

  .data-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 5px 24px }
  .data-row { display: flex; gap: 6px; font-size: 10.5pt; line-height: 1.6 }
  .data-label { color: #555; white-space: nowrap; min-width: 130px }
  .data-label::after { content: ' :' }
  .data-value { font-weight: 600; color: #1a1a1a }

  .amount-box {
    border: 2px solid #1a3a6b; border-radius: 4px;
    padding: 12px 16px; margin: 14px 0; background: #f7f9fc;
  }
  .amount-main { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px }
  .amount-label { font-size: 10.5pt; color: #444; font-weight: 600 }
  .amount-value { font-size: 16pt; font-weight: 700; color: #1a3a6b }
  .amount-words {
    font-size: 10pt; font-style: italic; color: #333;
    border-top: 1px dashed #ccc; padding-top: 8px; line-height: 1.5;
  }
  .amount-words strong { font-style: normal; font-weight: 700 }

  .details-table { width: 100%; border-collapse: collapse; font-size: 10.5pt; margin-top: 6px }
  .details-table th {
    background: #1a3a6b; color: #fff;
    padding: 5px 10px; text-align: left; font-size: 9.5pt; font-weight: 600
  }
  .details-table td { padding: 5px 10px; border-bottom: 1px solid #e0e0e0 }
  .details-table tr:last-child td { border-bottom: none }
  .details-table td:last-child { text-align: right; font-weight: 600 }

  .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 30px }
  .sign-block { text-align: center }
  .sign-line { border-bottom: 1px solid #333; height: 50px; margin-bottom: 6px }
  .sign-label { font-size: 9.5pt; color: #555 }

  .doc-footer-wrap {
    margin-top: 24px; border-top: 1px solid #ccc; padding-top: 12px;
    display: flex; justify-content: space-between; align-items: flex-end; gap: 16px;
  }
  .doc-footer-text { flex: 1; font-size: 8.5pt; color: #777; line-height: 1.6 }
  .doc-footer-qr { flex-shrink: 0; text-align: center }
  .doc-footer-qr img { display: block; width: 100px; height: 100px }
  .doc-footer-qr div { font-size: 7pt; color: #aaa; margin-top: 3px }

  .stamp-area {
    height: 70px; border: 1px dashed #aaa; border-radius: 50%; width: 100px;
    margin: 10px auto 0; display: flex; align-items: center; justify-content: center;
    color: #aaa; font-size: 8pt; text-align: center;
  }

  @media print {
    @page { size: A4; margin: 0 }
    body { padding: 15mm 18mm }
  }
</style>
</head>
<body>

<div class="header">
  <div class="header-left">
    ${logoHtml ? `<div style="flex-shrink:0;margin-right:4px">${logoHtml}</div>` : ''}
    <div class="bureau-info">
      <div class="bureau-name">${bureau.bureauName}</div>
      <div class="bureau-detail">
        📍 ${bureau.bureauAddress}<br>
        📞 ${bureau.bureauPhone}${bureau.email ? `&nbsp;&nbsp;✉️ ${bureau.email}` : ''}
      </div>
      ${bureau.nif || bureau.stat ? `<div class="bureau-detail" style="margin-top:4px">
        ${bureau.nif  ? `NIF : <strong>${bureau.nif}</strong>` : ''}
        ${bureau.nif && bureau.stat ? '&nbsp;|&nbsp;' : ''}
        ${bureau.stat ? `STAT : <strong>${bureau.stat}</strong>` : ''}
      </div>` : ''}
      ${bureau.rib ? `<div class="bureau-detail">RIB : <strong>${bureau.rib}</strong></div>` : ''}
    </div>
  </div>
  <div class="attestation-ref">
    <div style="font-size:8.5pt;color:#888;margin-bottom:4px">ATTESTATION N°</div>
    <div class="ref-no">${no}</div>
    <div style="margin-top:6px;font-size:9pt">
      Date : <strong>${formatDate(txDate)}</strong><br>
      Heure : <strong>${formatTime(txDate)}</strong>
    </div>
  </div>
</div>

<div class="doc-title">Attestation de Change de Devises</div>

<div class="section">
  <div class="section-title">👤 Informations du client</div>
  <div class="data-grid">
    <div class="data-row">
      <span class="data-label">Nom et prénom</span>
      <span class="data-value">${clientName || '—'}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Nationalité</span>
      <span class="data-value">${nationality || '—'}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Passeport N°</span>
      <span class="data-value">${passportNo || '—'}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Date de délivrance</span>
      <span class="data-value">${formatDateInput(passportIssuedAt)}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Date d'expiration</span>
      <span class="data-value">${formatDateInput(passportExpiresAt)}</span>
    </div>
    ${clientAddress ? `<div class="data-row">
      <span class="data-label">Adresse</span>
      <span class="data-value">${clientAddress}</span>
    </div>` : ''}
  </div>
</div>

${(destination || travelNature || transportTitle || ticketNo || departureDate || returnDate) ? `
<div class="section">
  <div class="section-title">✈️ Informations du voyage</div>
  <div class="data-grid">
    ${destination    ? `<div class="data-row"><span class="data-label">Destination</span><span class="data-value">${destination}</span></div>` : ''}
    ${travelNature   ? `<div class="data-row"><span class="data-label">Nature du voyage</span><span class="data-value">${travelNature}</span></div>` : ''}
    ${transportTitle ? `<div class="data-row"><span class="data-label">Titre de transport</span><span class="data-value">${transportTitle}</span></div>` : ''}
    ${ticketNo       ? `<div class="data-row"><span class="data-label">Numéro de billet</span><span class="data-value">${ticketNo}</span></div>` : ''}
    ${departureDate  ? `<div class="data-row"><span class="data-label">Date de départ</span><span class="data-value">${formatDateInput(departureDate)}</span></div>` : ''}
    ${returnDate     ? `<div class="data-row"><span class="data-label">Date de retour</span><span class="data-value">${formatDateInput(returnDate)}</span></div>` : ''}
  </div>
</div>` : ''}

<div class="section">
  <div class="section-title">💱 Détails de l'opération</div>
  <table class="details-table">
    <thead>
      <tr>
        <th>Désignation</th>
        <th>Devise étrangère</th>
        <th>Taux appliqué</th>
        <th>Montant MGA</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Vente de devises</td>
        <td>${tx.currency.flag} ${formatCurrency(tx.amount, tx.currency.code)} (${tx.currency.name})</td>
        <td>${tx.rate > 0 ? `${formatNumber(tx.rate)} Ar/${tx.currency.code}` : '—'}</td>
        <td>${tx.rate > 0 ? formatMGA(tx.amount * tx.rate) : formatMGA(total)}</td>
      </tr>
      ${Number(tx.commission) > 0 ? `<tr>
        <td>Commission</td><td>—</td><td>—</td>
        <td>- ${formatMGA(Number(tx.commission))}</td>
      </tr>` : ''}
    </tbody>
  </table>
</div>

<div class="amount-box">
  <div class="amount-main">
    <span class="amount-label">Montant total remis au client :</span>
    <span class="amount-value">${formatMGA(total)}</span>
  </div>
  <div class="amount-words">
    Arrêté à la somme de : <strong>${montantLettres}</strong>
  </div>
</div>

<div class="section">
  <div class="section-title">📋 Référence de la transaction</div>
  <div class="data-grid">
    <div class="data-row">
      <span class="data-label">Type d'opération</span>
      <span class="data-value">VENTE DE DEVISES</span>
    </div>
    <div class="data-row">
      <span class="data-label">Caissier</span>
      <span class="data-value">${tx.user?.name ?? '—'}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Date / Heure</span>
      <span class="data-value">${formatDate(txDate)} à ${formatTime(txDate)}</span>
    </div>
  </div>
</div>

<div class="signatures">
  <div class="sign-block">
    <div class="sign-line"></div>
    <div class="sign-label">Signature du client<br><em>${clientName || '...............'}</em></div>
  </div>
  <div class="sign-block">
    <div class="sign-line" style="position:relative">
      <div class="stamp-area">Cachet<br>Bureau</div>
    </div>
    <div class="sign-label">Le responsable<br><em>${bureau.bureauName}</em></div>
  </div>
</div>

<div class="doc-footer-wrap">
  <div class="doc-footer-text">
    <div>${bureau.bureauFooter}</div>
    <div style="margin-top:3px">Document officiel — Valide uniquement avec cachet et signature du responsable autorisé</div>
    <div style="margin-top:3px;font-size:7.5pt;color:#aaa">Réf. ${no} — Scannez le QR code pour vérifier l'authenticité</div>
  </div>
  <div class="doc-footer-qr">
    <img src="${qrUrl}" alt="QR Code vérification" />
    <div>Vérification</div>
  </div>
</div>

<script>window.onload = () => { window.print() }<\/script>
</body>
</html>`
  }

  // ── Impression ────────────────────────────────────────────────────────────
  // [CORRIGÉ] : handlePrint attend le numéro d'attestation avant d'ouvrir la popup.
  // L'impression ne peut pas être différée (popup blocker) — on ouvre la fenêtre
  // d'abord avec un loader, puis on injecte le HTML une fois l'archivage terminé.

  const [printing, setPrinting] = useState(false)

  async function handlePrint() {
    setPrinting(true)
    const win = window.open('', '_blank', 'width=900,height=1100')
    if (!win) {
      alert('Veuillez autoriser les popups pour imprimer.')
      setPrinting(false)
      return
    }
    win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
      <style>body{display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#1a3a6b;font-size:16px}</style>
    </head><body>⏳ Génération de l'attestation…</body></html>`)

    try {
      const no = await archiveAndGetNo()
      
      // [CORRECTION] : buildHtml génère son propre QR en interne (via generateQrDataUrl)
      win.document.open()
      win.document.write(await buildHtml(no))  // buildHtml est async et génère le QR
      win.document.close()
      setTimeout(() => { onClose() }, 1000)
    } catch {
      win.close()
      alert("Erreur lors de la génération de l'attestation.")
    } finally {
      setPrinting(false)
    }
  }

  // ── Validation ────────────────────────────────────────────────────────────

  const canGenerate =
    clientName.trim().length > 0 &&
    passportNo.trim().length > 0 &&
    passportIssuedAt.trim().length > 0 &&
    passportExpiresAt.trim().length > 0 &&
    nationality.trim().length > 0

  // Numéro à afficher dans l'aperçu (avant archivage : placeholder lisible)
  const displayNo = attestationNo || `— (généré à l'impression)`

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{maxWidth: 680, maxHeight: '90vh', overflowY: 'auto'}}>
        <div className="modal-header">
          <h3 className="modal-title">
            {isEditMode ? '✏️ Modifier l\'attestation' : '📄 Attestation de change'} — {tx.receiptNo}
            {attestationNo && <span style={{ fontSize: 13, color: 'var(--muted,#6b7280)', marginLeft: 8 }}>{attestationNo}</span>}
          </h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        {archiveStatus === 'saved' && (
          <div className="alert alert-success" style={{marginBottom:8, fontSize:12, padding:'6px 12px'}}>
            ✓ Attestation archivée {attestationNo && `— Réf. ${attestationNo}`}
          </div>
        )}
        {archiveStatus === 'error' && (
          <div className="alert alert-error" style={{marginBottom:8, fontSize:12, padding:'6px 12px'}}>
            ⚠️ Archivage non disponible — l'impression reste fonctionnelle
          </div>
        )}

        {step === 'form' && (
          <>
            {isEditMode && (
              <div className="alert alert-info" style={{marginBottom: 12, fontSize: 13}}>
                ℹ️ Vous modifiez une attestation existante. Les modifications seront sauvegardées automatiquement lors de l'impression.
              </div>
            )}
            <div className="alert alert-info" style={{marginBottom: 16, fontSize: 13}}>
              Renseignez les informations du client et du voyage pour générer l'attestation officielle.
            </div>

            {/* Récapitulatif transaction */}
            <div className="info-box" style={{marginBottom: 16}}>
              <div className="ib-row">
                <span className="ib-label">Transaction</span>
                <span className="ib-value fw-600">{tx.receiptNo}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Montant</span>
                <span className="ib-value">{tx.currency.flag} {formatCurrency(tx.amount, tx.currency.code)}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Taux</span>
                <span className="ib-value">{formatNumber(tx.rate)} Ar/{tx.currency.code}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">Total MGA remis</span>
                <span className="ib-value fw-600" style={{color:'var(--primary,#2563eb)'}}>{formatMGA(total)}</span>
              </div>
              <div className="ib-row">
                <span className="ib-label">En lettres</span>
                <span className="ib-value" style={{fontSize:12, fontStyle:'italic'}}>{montantLettres}</span>
              </div>
              {/* [AJOUT] Logo bureau — aperçu discret si configuré */}
              {bureau.logoBase64 && (
                <div className="ib-row" style={{marginTop:6}}>
                  <span className="ib-label">Logo</span>
                  <span className="ib-value">
                    <img src={bureau.logoBase64} alt="Logo" style={{maxHeight:28, maxWidth:80, objectFit:'contain', verticalAlign:'middle'}}/>
                    <span style={{fontSize:11, color:'var(--success,#16a34a)', marginLeft:6}}>✓ sera affiché</span>
                  </span>
                </div>
              )}
            </div>

            {/* ── Section : Identité ─────────────────────────────────── */}
            <div style={{marginBottom: 6, fontWeight: 600, fontSize: 13, color: 'var(--primary,#2563eb)', borderBottom: '1px solid var(--border,#e2e8f0)', paddingBottom: 4}}>
              👤 Identité du client
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Nom et prénom *</label>
                <input className="form-control" placeholder="Ex : Jean Rakoto" autoFocus
                  value={clientName} onChange={e => setClientName(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Nationalité *</label>
                <input className="form-control" placeholder="Ex : Française, Malgache..."
                  value={nationality} onChange={e => setNationality(e.target.value)}/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Passeport N° *</label>
                <input className="form-control" placeholder="Ex : 12AB34567"
                  value={passportNo} onChange={e => setPassportNo(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Adresse <span style={{color:'var(--muted,#9ca3af)', fontSize:11}}>(optionnel)</span></label>
                <input className="form-control" placeholder="Quartier, ville, pays..."
                  value={clientAddress} onChange={e => setClientAddress(e.target.value)}/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de délivrance *</label>
                <input type="date" className="form-control"
                  value={passportIssuedAt} onChange={e => setPassportIssuedAt(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Date d'expiration *</label>
                <input type="date" className="form-control"
                  value={passportExpiresAt} onChange={e => setPassportExpiresAt(e.target.value)}/>
              </div>
            </div>

            {/* ── Section : Voyage ───────────────────────────────────── */}
            <div style={{marginTop: 12, marginBottom: 6, fontWeight: 600, fontSize: 13, color: 'var(--primary,#2563eb)', borderBottom: '1px solid var(--border,#e2e8f0)', paddingBottom: 4}}>
              ✈️ Informations du voyage <span style={{fontWeight: 400, fontSize: 11, color: 'var(--muted,#9ca3af)'}}>(optionnel)</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Destination</label>
                <input className="form-control" placeholder="Ex : Paris, France"
                  value={destination} onChange={e => setDestination(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Nature du voyage</label>
                <input className="form-control" placeholder="Ex : Tourisme, Affaires, Études..."
                  value={travelNature} onChange={e => setTravelNature(e.target.value)}/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Titre de transport</label>
                <input className="form-control" placeholder="Ex : Billet d'avion, Train..."
                  value={transportTitle} onChange={e => setTransportTitle(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Numéro de billet</label>
                <input className="form-control" placeholder="Ex : AF1234567890"
                  value={ticketNo} onChange={e => setTicketNo(e.target.value)}/>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Date de départ</label>
                <input type="date" className="form-control"
                  value={departureDate} onChange={e => setDepartureDate(e.target.value)}/>
              </div>
              <div className="form-group">
                <label className="form-label">Date de retour <span style={{color:'var(--muted,#9ca3af)', fontSize:11}}>(facultatif)</span></label>
                <input type="date" className="form-control"
                  value={returnDate} onChange={e => setReturnDate(e.target.value)}/>
              </div>
            </div>

            {!canGenerate && (
              <div style={{fontSize: 12, color: 'var(--muted,#9ca3af)', marginBottom: 8}}>
                * Nom, Passeport N°, dates de validité et nationalité requis.
              </div>
            )}

            <div className="btn-group mt-16">
              <button className="btn btn-primary btn-lg" onClick={() => setStep('preview')} disabled={!canGenerate}>
                👁️ Aperçu
              </button>
              <button className="btn btn-success" onClick={handlePrint} disabled={!canGenerate || printing}>
                {printing ? '⏳ Génération…' : '🖨️ Imprimer directement'}
              </button>
              <button className="btn btn-outline" onClick={onClose}>Annuler</button>
            </div>
          </>
        )}

        {step === 'preview' && (
          <>
            <div style={{
              border: '1px solid var(--border,#e2e8f0)', borderRadius: 6,
              padding: '16px 20px', background: '#fafbfc',
              fontFamily: 'Georgia, serif', fontSize: 12, lineHeight: 1.6, marginBottom: 16,
            }}>
              <div style={{textAlign:'center', fontWeight:700, fontSize:14, color:'#1a3a6b', borderBottom:'2px solid #1a3a6b', paddingBottom:8, marginBottom:12}}>
                {bureau.logoBase64 && (
                  <img src={bureau.logoBase64} alt="Logo" style={{maxHeight:36, maxWidth:100, objectFit:'contain', marginRight:10, verticalAlign:'middle'}}/>
                )}
                {bureau.bureauName}
              </div>
              <div style={{textAlign:'center', fontSize:13, fontWeight:700, letterSpacing:1, marginBottom:12, textTransform:'uppercase'}}>
                Attestation de Change de Devises
              </div>

              <div style={{fontWeight:700, fontSize:11, color:'#1a3a6b', borderBottom:'1px solid #1a3a6b', marginBottom:6, paddingBottom:2}}>IDENTITÉ DU CLIENT</div>
              <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', marginBottom:10}}>
                <div><span style={{color:'#666'}}>N° attestation : </span><strong>{displayNo}</strong></div>
                <div><span style={{color:'#666'}}>N° reçu : </span><strong>{tx.receiptNo}</strong></div>
                <div><span style={{color:'#666'}}>Client : </span><strong>{clientName}</strong></div>
                <div><span style={{color:'#666'}}>Nationalité : </span><strong>{nationality}</strong></div>
                <div><span style={{color:'#666'}}>Passeport : </span><strong>{passportNo}</strong></div>
                <div><span style={{color:'#666'}}>Délivré le : </span>{formatDateInput(passportIssuedAt)}</div>
                <div><span style={{color:'#666'}}>Expire le : </span>{formatDateInput(passportExpiresAt)}</div>
                {clientAddress && <div><span style={{color:'#666'}}>Adresse : </span>{clientAddress}</div>}
              </div>

              {(destination || travelNature || transportTitle || ticketNo || departureDate || returnDate) && (
                <>
                  <div style={{fontWeight:700, fontSize:11, color:'#1a3a6b', borderBottom:'1px solid #1a3a6b', marginBottom:6, paddingBottom:2}}>INFORMATIONS DU VOYAGE</div>
                  <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 16px', marginBottom:10}}>
                    {destination    && <div><span style={{color:'#666'}}>Destination : </span><strong>{destination}</strong></div>}
                    {travelNature   && <div><span style={{color:'#666'}}>Nature : </span>{travelNature}</div>}
                    {transportTitle && <div><span style={{color:'#666'}}>Titre transport : </span>{transportTitle}</div>}
                    {ticketNo       && <div><span style={{color:'#666'}}>N° billet : </span>{ticketNo}</div>}
                    {departureDate  && <div><span style={{color:'#666'}}>Départ : </span>{formatDateInput(departureDate)}</div>}
                    {returnDate     && <div><span style={{color:'#666'}}>Retour : </span>{formatDateInput(returnDate)}</div>}
                  </div>
                </>
              )}

              <div style={{background:'#eef2fb', border:'1px solid #1a3a6b', borderRadius:4, padding:'10px 14px', marginBottom:10}}>
                <div style={{display:'flex', justifyContent:'space-between', fontWeight:700}}>
                  <span>{tx.currency.flag} {formatCurrency(tx.amount, tx.currency.code)} @ {formatNumber(tx.rate)} Ar/{tx.currency.code}</span>
                  <span style={{color:'#1a3a6b', fontSize:14}}>{formatMGA(total)}</span>
                </div>
                <div style={{fontSize:11, fontStyle:'italic', marginTop:6, color:'#444'}}>
                  Arrêté à : <strong style={{fontStyle:'normal'}}>{montantLettres}</strong>
                </div>
              </div>
              <div style={{fontSize:10, color:'#888', textAlign:'center'}}>
                Document valide uniquement avec cachet et signature du responsable
              </div>
            </div>

            <div className="btn-group">
              <button className="btn btn-primary btn-lg" onClick={handlePrint} disabled={printing}>
                {printing ? '⏳ Génération…' : '🖨️ Imprimer / Télécharger PDF'}
              </button>
              <button className="btn btn-outline" onClick={() => setStep('form')}>← Modifier les infos</button>
              <button className="btn btn-outline" onClick={onClose}>Fermer</button>
            </div>
            <div className="ticket-hint" style={{marginTop:8}}>
              Dans la fenêtre d'impression, choisissez <strong>« Enregistrer en PDF »</strong> pour télécharger.
            </div>
          </>
        )}
      </div>
    </div>
  )
}
