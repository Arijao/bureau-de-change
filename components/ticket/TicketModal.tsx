'use client'
import { useState } from 'react'
import { formatMGA, formatCurrency, formatNumber, formatDate, formatTime } from '@/lib/utils'

interface TicketDetail {
  categoryName: string
  denomination: number
  quantity: number
  rateApplied: number
  subtotalAmount: number
  subtotalMGA: number
}

interface TicketCurrency { code: string; flag: string; name: string;[k: string]: unknown }
interface TicketUser { name: string;[k: string]: unknown }

interface TicketTx {
  receiptNo: string
  type: string
  createdAt: string | Date
  amount: number
  rate: number
  commission: number
  mgaAmount?: number
  totalMGA?: number
  note?: string | null
  currency: TicketCurrency
  user?: TicketUser | null
  details?: TicketDetail[] // ← Support du détail des coupures (uniquement ACHAT)
  [k: string]: unknown
}

interface Props {
  transaction: TicketTx
  bureauName: string
  bureauAddress: string
  bureauPhone: string
  bureauFooter: string
  logoBase64?: string | null
  onClose: () => void
}
export default function TicketModal({
  transaction: tx,
  bureauName,
  bureauAddress,
  bureauPhone,
  bureauFooter,
  logoBase64,
  onClose
}: Props) {

  const [size, setSize] = useState('80mm')
  const width = size === '58mm' ? 220 : 300
  const fs = size === '58mm' ? 10 : 12

  const cur = tx.currency
  const commission = Number(tx.commission || 0)
  const type = String(tx.type)
  const total = Number(tx.totalMGA ?? tx.mgaAmount ?? 0)
  const hasDetails = tx.details && tx.details.length > 0

  function printTicket() {
    const el = document.getElementById('ticket-content')
    if (!el) return
    const win = window.open('', '_blank', 'width=420,height=700')
    if (!win) return

    // Génération conditionnelle du bloc "Détail des coupures" pour l'impression
    const detailsHtml = hasDetails ? `
      <div style="margin: 8px 0; border-top: 1px dashed #000; border-bottom: 1px dashed #000; padding: 4px 0;">
        <div style="font-weight: bold; font-size: ${fs}px; margin-bottom: 4px;">DÉTAIL DES COUPURES</div>
        ${tx.details!.map(d => `
          <div style="display: flex; justify-content: space-between; font-size: ${fs - 1}px; margin-bottom: 2px;">
            <span>${d.categoryName} (${formatNumber(d.denomination)}) x${d.quantity}</span>
            <span>${formatNumber(d.subtotalAmount)} ${cur.code} @ ${formatNumber(d.rateApplied)} = ${formatNumber(d.subtotalMGA)} Ar</span>
          </div>
        `).join('')}
      </div>
    ` : ''

    win.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Ticket ${tx.receiptNo}</title>
        <style>
          body { font-family: 'Courier New', monospace; width: ${width}px; margin: 0 auto; padding: 10px; font-size: ${fs}px; }
          .center { text-align: center; }
          .bold { font-weight: bold; }
          .row { display: flex; justify-content: space-between; margin-bottom: 4px; }
          .divider { border-top: 1px dashed #000; margin: 8px 0; }
          .total { font-size: ${fs + 2}px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="center" style="display:flex;align-items:center;justify-content:center;gap:8px;margin-bottom:4px;">
          ${logoBase64 ? `<img src="${logoBase64}" style="height:36px;object-fit:contain;" />` : ''}
          <span class="bold" style="font-size: ${fs + 2}px;">${bureauName}</span>
        </div>
        <div class="center" style="font-size: ${fs - 1}px;">${bureauAddress}</div>
        <div class="center" style="font-size: ${fs - 1}px;">Tél: ${bureauPhone}</div>
        <div class="divider"></div>
        
        <div class="row">
          <span>Ticket N°:</span>
          <span class="bold">${tx.receiptNo}</span>
        </div>
        <div class="row">
          <span>Date:</span>
          <span>${formatDate(tx.createdAt)} ${formatTime(tx.createdAt)}</span>
        </div>
        <div class="row">
          <span>Caissier:</span>
          <span>${tx.user?.name || 'Inconnu'}</span>
        </div>
        <div class="divider"></div>

        <div class="center bold" style="font-size: ${fs + 1}px; margin-bottom: 6px;">
          ${type === 'ACHAT' ? 'ACHAT DEVISE' : 'VENTE DEVISE'}
        </div>

        ${detailsHtml}

        <div class="row">
          <span>Montant ${cur.code}:</span>
          <span class="bold">${formatCurrency(Number(tx.amount), cur.code)}</span>
        </div>
        
        ${!hasDetails ? `
        <div class="row">
          <span>Taux appliqué:</span>
          <span>${formatNumber(Number(tx.rate))} Ar/${cur.code}</span>
        </div>
        ` : `
        <div class="row">
          <span>Taux moyen pondéré:</span>
          <span>${formatNumber(Number(tx.rate))} Ar/${cur.code}</span>
        </div>
        `}

        ${commission > 0 ? `
        <div class="row">
          <span>Commission:</span>
          <span>${type === 'ACHAT' ? '-' : '+'} ${formatMGA(commission)}</span>
        </div>
        ` : ''}

        <div class="divider"></div>
        <div class="row total">
          <span>${type === 'ACHAT' ? 'CLIENT REÇOIT' : 'CLIENT PAIE'}:</span>
          <span>${formatMGA(total)}</span>
        </div>
        <div class="divider"></div>

        ${tx.note ? `<div style="font-size: ${fs - 1}px; font-style: italic; margin-bottom: 8px;">Note: ${tx.note}</div>` : ''}
        
        <div class="center" style="font-size: ${fs - 1}px; margin-top: 12px;">
          ${bureauFooter}
        </div>
        <div class="center" style="font-size: ${fs - 2}px; margin-top: 8px; color: #666;">
          Imprimé le ${new Date().toLocaleString('fr-FR')}
        </div>
      </body>
      </html>
    `)

    win.document.close()
    win.focus()
    setTimeout(() => {
      win.print()
      win.close()
    }, 250)
  }

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-header">
          <h3 className="modal-title">🧾 Aperçu du Ticket</h3>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Format d'impression</label>
          <div className="type-selector" style={{ marginBottom: 0 }}>
            <button
              className={`type-btn ${size === '58mm' ? 'type-btn-achat' : ''}`}
              onClick={() => setSize('58mm')}
            >
              🧾 58mm (Standard)
            </button>
            <button
              className={`type-btn ${size === '80mm' ? 'type-btn-vente' : ''}`}
              onClick={() => setSize('80mm')}
            >
              📄 80mm (Large)
            </button>
          </div>
        </div>

        {/* Aperçu visuel dans la modale */}
        <div
          id="ticket-content"
          style={{
            background: '#fff',
            color: '#000',
            padding: 16,
            fontFamily: 'Courier New, monospace',
            width: size === '58mm' ? 220 : 300,
            margin: '0 auto',
            fontSize: size === '58mm' ? 10 : 12,
            border: '1px solid #e2e8f0',
            borderRadius: 4
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
            {logoBase64 && (
              <img src={logoBase64} style={{ height: 32, objectFit: 'contain' }} alt="Logo" />
            )}
            <div style={{ fontWeight: 'bold', fontSize: size === '58mm' ? 12 : 14 }}>{bureauName}</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: size === '58mm' ? 9 : 10 }}>{bureauAddress}</div>
          <div style={{ textAlign: 'center', fontSize: size === '58mm' ? 9 : 10, marginBottom: 8 }}>Tél: {bureauPhone}</div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Ticket N°:</span>
            <span style={{ fontWeight: 'bold' }}>{tx.receiptNo}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Date:</span>
            <span>{formatDate(tx.createdAt)} {formatTime(tx.createdAt)}</span>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          <div style={{ textAlign: 'center', fontWeight: 'bold', margin: '8px 0' }}>
            {type === 'ACHAT' ? 'ACHAT DEVISE' : 'VENTE DEVISE'}
          </div>

          {/* Affichage conditionnel des détails (uniquement si présents, donc uniquement ACHAT) */}
          {hasDetails && (
            <div style={{ margin: '8px 0', borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0' }}>
              <div style={{ fontWeight: 'bold', marginBottom: 4 }}>DÉTAIL DES COUPURES</div>
              {tx.details!.map((d, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: size === '58mm' ? 9 : 10, marginBottom: 2 }}>
                  <span>{d.categoryName} ({formatNumber(d.denomination)}) x{d.quantity}</span>
                  <span>{formatNumber(d.subtotalAmount)} {cur.code} @ {formatNumber(d.rateApplied)} = {formatNumber(d.subtotalMGA)} Ar</span>
                </div>
              ))}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Montant {cur.code}:</span>
            <span style={{ fontWeight: 'bold' }}>{formatCurrency(Number(tx.amount), cur.code)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span>Taux {hasDetails ? '(moyen pondéré)' : 'appliqué'}:</span>
            <span>{formatNumber(Number(tx.rate))} Ar/{cur.code}</span>
          </div>
          {commission > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>Commission:</span>
              <span>{type === 'ACHAT' ? '-' : '+'} {formatMGA(commission)}</span>
            </div>
          )}

          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: size === '58mm' ? 12 : 14 }}>
            <span>{type === 'ACHAT' ? 'CLIENT REÇOIT' : 'CLIENT PAIE'}:</span>
            <span>{formatMGA(total)}</span>
          </div>
          <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }}></div>

          {tx.note && <div style={{ fontSize: size === '58mm' ? 9 : 10, fontStyle: 'italic', marginBottom: 8 }}>Note: {tx.note}</div>}

          <div style={{ textAlign: 'center', fontSize: size === '58mm' ? 9 : 10, marginTop: 12 }}>
            {bureauFooter}
          </div>
        </div>

        <div className="btn-group" style={{ marginTop: 20 }}>
          <button className="btn btn-primary" onClick={printTicket}>🖨️ Imprimer</button>
          <button className="btn btn-outline" onClick={onClose}>Fermer</button>
        </div>
      </div>
    </div>
  )
}