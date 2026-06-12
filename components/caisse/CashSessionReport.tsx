'use client'

/**
 * components/caisse/CashSessionReport.tsx
 *
 * Rapport de clôture complet et imprimable.
 *
 * Sections :
 *  1. En-tête (bureau, session, caissier, dates, durée)
 *  2. Mouvements par devise (achats / ventes)
 *  3. Dépenses de la session
 *  4. Mouvements RH par plage horaire (Q5)
 *  5. Soldes théoriques vs physiques + écarts
 *  6. Détail du comptage physique par coupure (Q3)
 *  7. Zone de signatures
 *
 * Le bouton Imprimer déclenche window.print().
 * Les styles @media print sont injectés dynamiquement.
 */

import { useEffect } from 'react'
import Link          from 'next/link'

// ── Types (miroirs des types du service) ──────────────────────────────────────

interface Currency {
  id:   number
  code: string
  flag: string
  name: string
}

interface SessionBalance {
  id:          number
  balanceType: string
  amount:      number
  currency:    Currency
  countDetails: Array<{ denomination: number; quantity: number }>
}

interface Transaction {
  id:        string
  receiptNo: string
  type:      string
  amount:    number
  rate:      number
  totalMGA:  number
  createdAt: string
  currency:  Currency
  user:      { name: string } | null
}

interface Expense {
  id:          number
  date:        string
  amount:      number
  category:    string
  description: string
  supplier:    string | null
  account:     { code: string; name: string }
}

interface HrMovement {
  id:            number
  operation:     string
  delta:         number
  balanceBefore: number
  balanceAfter:  number
  note:          string | null
  createdAt:     string
  user:          { name: string } | null
}

interface MovementByCurrency {
  currencyId:  number
  currencyCode: string
  currencyFlag: string
  achatCount:  number
  achatAmount: number
  achatMGA:    number
  venteCount:  number
  venteAmount: number
  venteMGA:    number
}

interface Discrepancy {
  currency:    Currency
  theoretical: number
  physical:    number
  diff:        number
}

interface Report {
  session: {
    id:          string
    sessionNo:   string
    status:      string
    openedAt:    string
    closedAt:    string | null
    openingNote: string | null
    closingNote: string | null
    previousSessionId: string | null
    user:        { name: string; role: string }
    previousSession?: { sessionNo: string } | null
    nextSession?:     { sessionNo: string } | null
    _count?:     { transactions: number; expenses: number }
  }
  movementsByCurrency: MovementByCurrency[]
  achats:              Transaction[]
  ventes:              Transaction[]
  expenses:            Expense[]
  hrMovements:         HrMovement[]
  openingBalances:     SessionBalance[]
  theoreticalBalances: SessionBalance[]
  physicalBalances:    SessionBalance[]
  discrepancies:       Discrepancy[]
  totalTransactions:   number
  totalExpensesMGA:    number
  totalHrDelta:        number
  sessionDuration:     number
}

interface Props {
  report:     Report
  bureauName: string
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number, decimals = 2) =>
  new Intl.NumberFormat('fr-FR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(n)

const fmtDate = (s: string) =>
  new Date(s).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

const fmtDay = (s: string) =>
  new Date(s).toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}min`
  return `${minutes}min`
}

// ── Styles d'impression injectés dynamiquement ────────────────────────────────

const PRINT_STYLES = `
@media print {
  .no-print { display: none !important; }
  .page-container { padding: 0 !important; max-width: 100% !important; }
  body { font-size: 11pt !important; }
  .report-section { break-inside: avoid; }
  .report-header { border: 2px solid #000 !important; }
  table { width: 100% !important; }
  th, td { padding: 4pt 6pt !important; font-size: 9pt !important; }
  .signature-grid { margin-top: 40pt !important; }
}
`

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CashSessionReport({ report, bureauName }: Props) {
  const { session, discrepancies } = report
  const isClosed = session.status === 'CLOSED'
  const hasDiscrepancy = discrepancies.some(d => d.diff !== 0)

  // Injection des styles d'impression
  useEffect(() => {
    const el = document.createElement('style')
    el.textContent = PRINT_STYLES
    document.head.appendChild(el)
    return () => { document.head.removeChild(el) }
  }, [])

  // ── Section helper ────────────────────────────────────────────────────────

  function Section({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
    return (
      <div className="report-section" style={{
        background: 'white', border: '1px solid #e5e7eb',
        borderRadius: 10, overflow: 'hidden', marginBottom: 16,
      }}>
        <div style={{
          padding: '10px 16px', background: '#f9fafb',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <span style={{ fontSize: 16 }}>{icon}</span>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#374151' }}>{title}</h3>
        </div>
        <div style={{ padding: 16 }}>{children}</div>
      </div>
    )
  }

  // ── Table helper ──────────────────────────────────────────────────────────

  function Table({ headers, rows, emptyMsg }: {
    headers:  string[]
    rows:     React.ReactNode[][]
    emptyMsg?: string
  }) {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: '#f9fafb' }}>
              {headers.map((h, i) => (
                <th key={i} style={{
                  padding: '8px 12px', textAlign: 'left',
                  fontSize: 11, fontWeight: 600, color: '#6b7280',
                  textTransform: 'uppercase', letterSpacing: '0.04em',
                  borderBottom: '1px solid #e5e7eb',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} style={{
                  padding: '16px 12px', textAlign: 'center',
                  color: '#9ca3af', fontStyle: 'italic', fontSize: 12,
                }}>
                  {emptyMsg ?? 'Aucun élément'}
                </td>
              </tr>
            ) : rows.map((cells, ri) => (
              <tr key={ri} style={{ borderBottom: '1px solid #f3f4f6' }}>
                {cells.map((cell, ci) => (
                  <td key={ci} style={{ padding: '9px 12px', color: '#374151' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // ── RENDU PRINCIPAL ───────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 860 }}>

      {/* Barre d'actions — masquée à l'impression */}
      <div className="no-print" style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 20,
      }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <Link href="/caisse" className="btn btn-secondary" style={{ fontSize: 13 }}>
            ← Ma session
          </Link>
          <Link href="/caisse/historique" className="btn btn-secondary" style={{ fontSize: 13 }}>
            📋 Historique
          </Link>
        </div>
        <button
          onClick={() => window.print()}
          className="btn btn-primary"
          style={{ fontSize: 13 }}
        >
          🖨 Imprimer / PDF
        </button>
      </div>

      {/* ── 1. EN-TÊTE ─────────────────────────────────────────────────────── */}
      <div className="report-section report-header" style={{
        background: '#1e3a5f', borderRadius: 12, padding: 24,
        color: 'white', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <p style={{ margin: '0 0 4px', fontSize: 11, opacity: 0.7, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              {bureauName}
            </p>
            <h1 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800 }}>
              Rapport de clôture
            </h1>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 600, opacity: 0.9 }}>
              Session {session.sessionNo}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              display: 'inline-block', padding: '4px 12px', borderRadius: 999,
              fontSize: 12, fontWeight: 700,
              background: isClosed ? 'rgba(134,239,172,0.25)' : 'rgba(253,224,71,0.25)',
              color: isClosed ? '#86efac' : '#fde047',
              border: `1px solid ${isClosed ? '#86efac' : '#fde047'}`,
            }}>
              {isClosed ? 'CLÔTURÉE' : 'EN COURS'}
            </span>
          </div>
        </div>

        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16, marginTop: 20,
          paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.15)',
        }}>
          {[
            { label: 'Caissier',   value: session.user.name },
            { label: 'Ouverture',  value: fmtDate(session.openedAt) },
            { label: 'Clôture',    value: session.closedAt ? fmtDate(session.closedAt) : '—' },
            { label: 'Durée',      value: fmtDuration(report.sessionDuration) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p style={{ margin: '0 0 2px', fontSize: 10, opacity: 0.6, textTransform: 'uppercase' }}>{label}</p>
              <p style={{ margin: 0, fontSize: 13, fontWeight: 600 }}>{value}</p>
            </div>
          ))}
        </div>

        {(session.openingNote || session.closingNote || session.previousSession) && (
          <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: 12, opacity: 0.8 }}>
            {session.previousSession && (
              <span style={{ marginRight: 16 }}>Passation depuis : <strong>{session.previousSession.sessionNo}</strong></span>
            )}
            {session.openingNote && <span style={{ marginRight: 16 }}>Note ouverture : {session.openingNote}</span>}
            {session.closingNote && <span>Note clôture : {session.closingNote}</span>}
          </div>
        )}
      </div>

      {/* ── 2. RÉCAPITULATIF RAPIDE ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Transactions',    value: report.totalTransactions, color: '#2563eb', bg: '#eff6ff', border: '#bfdbfe' },
          { label: 'Achats',          value: report.achats.length,     color: '#16a34a', bg: '#f0fdf4', border: '#86efac' },
          { label: 'Ventes',          value: report.ventes.length,     color: '#9333ea', bg: '#faf5ff', border: '#d8b4fe' },
          { label: 'Dépenses (MGA)',  value: `${fmt(report.totalExpensesMGA)} Ar`, color: '#c2410c', bg: '#fff7ed', border: '#fed7aa', isText: true },
        ].map(({ label, value, color, bg, border, isText }) => (
          <div key={label} style={{
            background: bg, border: `1px solid ${border}`,
            borderRadius: 10, padding: '12px 16px', textAlign: 'center',
          }}>
            <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280' }}>{label}</p>
            <p style={{ margin: 0, fontSize: isText ? 15 : 22, fontWeight: 700, color }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── 3. SOLDES D'OUVERTURE ───────────────────────────────────────────── */}
      <Section title="Soldes d'ouverture" icon="🔓">
        <Table
          headers={['Devise', 'Solde d\'ouverture', 'Source']}
          rows={report.openingBalances.map(b => [
            <span key="c"><span style={{ fontSize: 16, marginRight: 6 }}>{b.currency.flag}</span><strong>{b.currency.code}</strong></span>,
            <span key="a" style={{ fontWeight: 600 }}>{fmt(b.amount)} {b.currency.code}</span>,
            <span key="s" style={{ fontSize: 11, color: '#6b7280' }}>
              {session.previousSessionId ? 'Passation' : 'Saisie manuelle'}
            </span>,
          ])}
          emptyMsg="Aucun solde d'ouverture enregistré"
        />
      </Section>

      {/* ── 4. MOUVEMENTS PAR DEVISE ────────────────────────────────────────── */}
      <Section title="Mouvements par devise" icon="💱">
        <Table
          headers={['Devise', 'Achats (nbre)', 'Montant acheté', 'Contrepartie MGA', 'Ventes (nbre)', 'Montant vendu', 'Contrepartie MGA', 'Position nette']}
          rows={report.movementsByCurrency.map(m => {
            const net = m.achatMGA - m.venteMGA
            return [
              <span key="c"><span style={{ fontSize: 16, marginRight: 6 }}>{m.currencyFlag}</span><strong>{m.currencyCode}</strong></span>,
              <span key="ac" style={{ color: '#16a34a', fontWeight: 600 }}>{m.achatCount}</span>,
              <span key="aa">{fmt(m.achatAmount)} {m.currencyCode}</span>,
              <span key="am">{fmt(m.achatMGA)} Ar</span>,
              <span key="vc" style={{ color: '#9333ea', fontWeight: 600 }}>{m.venteCount}</span>,
              <span key="va">{fmt(m.venteAmount)} {m.currencyCode}</span>,
              <span key="vm">{fmt(m.venteMGA)} Ar</span>,
              <span key="net" style={{ fontWeight: 700, color: net >= 0 ? '#16a34a' : '#dc2626' }}>
                {net >= 0 ? '+' : ''}{fmt(net)} Ar
              </span>,
            ]
          })}
          emptyMsg="Aucune transaction durant cette session"
        />
      </Section>

      {/* ── 5. DÉPENSES ─────────────────────────────────────────────────────── */}
      <Section title={`Dépenses de la session — ${fmt(report.totalExpensesMGA)} Ar`} icon="💸">
        <Table
          headers={['Date', 'Catégorie', 'Description', 'Fournisseur', 'Compte', 'Montant']}
          rows={report.expenses.map(e => [
            fmtDay(e.date),
            <span key="cat" style={{ fontSize: 11, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{e.category}</span>,
            e.description,
            e.supplier ?? '—',
            <span key="acc" style={{ fontSize: 11, color: '#6b7280' }}>{e.account.code}</span>,
            <span key="amt" style={{ fontWeight: 600, color: '#c2410c' }}>{fmt(e.amount)} Ar</span>,
          ])}
          emptyMsg="Aucune dépense durant cette session"
        />
      </Section>

      {/* ── 6. MOUVEMENTS RH ────────────────────────────────────────────────── */}
      {(report.hrMovements.length > 0 || report.totalHrDelta !== 0) && (
        <Section title={`Mouvements RH — ${fmt(Math.abs(report.totalHrDelta))} Ar`} icon="👥">
          <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>
            Mouvements hors transaction (salaires, avances) détectés sur la plage horaire de cette session.
          </p>
          <Table
            headers={['Heure', 'Opération', 'Note', 'Collaborateur', 'Delta MGA', 'Solde après']}
            rows={report.hrMovements.map(m => [
              new Date(m.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              <span key="op" style={{
                fontSize: 11, padding: '2px 6px', borderRadius: 4,
                background: m.operation === 'RETRAIT' ? '#fee2e2' : '#dcfce7',
                color: m.operation === 'RETRAIT' ? '#dc2626' : '#16a34a',
                fontWeight: 600,
              }}>
                {m.operation}
              </span>,
              m.note ?? '—',
              m.user?.name ?? '—',
              <span key="d" style={{ fontWeight: 600, color: m.delta < 0 ? '#dc2626' : '#16a34a' }}>
                {m.delta >= 0 ? '+' : ''}{fmt(m.delta)} Ar
              </span>,
              `${fmt(m.balanceAfter)} Ar`,
            ])}
            emptyMsg="Aucun mouvement RH détecté sur cette période"
          />
        </Section>
      )}

      {/* ── 7. SOLDES THÉORIQUES vs PHYSIQUES + ÉCARTS ──────────────────────── */}
      {isClosed && (
        <Section
          title={`Récapitulatif des soldes${hasDiscrepancy ? ' — ⚠ Écarts détectés' : ' — ✓ Conforme'}`}
          icon="⚖️"
        >
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f9fafb' }}>
                  {['Devise', 'Solde ouverture', 'Solde théorique', 'Solde physique', 'Écart', 'Statut'].map((h, i) => (
                    <th key={i} style={{
                      padding: '8px 12px', textAlign: 'left',
                      fontSize: 11, fontWeight: 600, color: '#6b7280',
                      textTransform: 'uppercase', letterSpacing: '0.04em',
                      borderBottom: '1px solid #e5e7eb',
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.discrepancies.map((d, i) => {
                  const opening = report.openingBalances.find(b => b.currency.id === d.currency.id)
                  const isOk    = Math.abs(d.diff) < 0.001
                  return (
                    <tr key={i} style={{
                      borderBottom: '1px solid #f3f4f6',
                      background: isOk ? 'transparent' : '#fff9f9',
                    }}>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontSize: 16, marginRight: 6 }}>{d.currency.flag}</span>
                        <strong>{d.currency.code}</strong>
                      </td>
                      <td style={{ padding: '10px 12px' }}>{fmt(opening?.amount ?? 0)} {d.currency.code}</td>
                      <td style={{ padding: '10px 12px', color: '#2563eb', fontWeight: 600 }}>
                        {fmt(d.theoretical)} {d.currency.code}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#16a34a', fontWeight: 600 }}>
                        {fmt(d.physical)} {d.currency.code}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 700, color: isOk ? '#16a34a' : '#dc2626' }}>
                        {d.diff >= 0 ? '+' : ''}{fmt(d.diff)} {d.currency.code}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          fontSize: 11, padding: '3px 8px', borderRadius: 999,
                          fontWeight: 600,
                          background: isOk ? '#dcfce7' : '#fee2e2',
                          color:      isOk ? '#15803d' : '#dc2626',
                        }}>
                          {isOk ? '✓ Conforme' : '⚠ Écart'}
                        </span>
                      </td>
                    </tr>
                  )
                })}

                {report.discrepancies.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ padding: '16px 12px', textAlign: 'center', color: '#9ca3af', fontStyle: 'italic' }}>
                      Comptage physique non encore saisi
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Section>
      )}

      {/* ── 8. DÉTAIL DU COMPTAGE PAR COUPURE ───────────────────────────────── */}
      {isClosed && report.physicalBalances.length > 0 && (
        <Section title="Détail du comptage physique" icon="🏦">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
            {report.physicalBalances.map(pb => (
              <div key={pb.id} style={{
                border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden',
              }}>
                <div style={{
                  padding: '8px 12px', background: '#f9fafb',
                  borderBottom: '1px solid #e5e7eb',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <span style={{ fontSize: 18 }}>{pb.currency.flag}</span>
                  <strong style={{ fontSize: 13 }}>{pb.currency.code}</strong>
                </div>

                {pb.countDetails.length > 0 ? (
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <tbody>
                      {[...pb.countDetails]
                        .sort((a, b) => b.denomination - a.denomination)
                        .map((d, i) => (
                        <tr key={i} style={{ borderBottom: '1px solid #f9fafb' }}>
                          <td style={{ padding: '5px 10px', color: '#6b7280', textAlign: 'right', width: 70 }}>
                            {fmt(d.denomination, 0)}
                          </td>
                          <td style={{ padding: '5px 4px', color: '#9ca3af', width: 16, textAlign: 'center' }}>×</td>
                          <td style={{ padding: '5px 10px', fontWeight: 600, width: 40, textAlign: 'center' }}>
                            {d.quantity}
                          </td>
                          <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>
                            = {fmt(d.denomination * d.quantity, 0)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: '#f9fafb', fontWeight: 700 }}>
                        <td colSpan={3} style={{ padding: '7px 10px', fontSize: 11, color: '#6b7280' }}>Total</td>
                        <td style={{ padding: '7px 10px', textAlign: 'right', color: '#111827', fontSize: 13 }}>
                          {fmt(pb.amount)} {pb.currency.code}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                ) : (
                  <p style={{ padding: '10px 12px', fontSize: 12, color: '#6b7280', margin: 0 }}>
                    Total : <strong>{fmt(pb.amount)} {pb.currency.code}</strong>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Section>
      )}

      {/* ── 9. SIGNATURES ───────────────────────────────────────────────────── */}
      <div className="signature-grid report-section" style={{
        background: 'white', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: 24, marginBottom: 32,
      }}>
        <h3 style={{ margin: '0 0 20px', fontSize: 13, fontWeight: 700, color: '#374151' }}>
          ✍ Signatures
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 32 }}>
          {[
            { title: 'Caissier sortant', name: session.user.name },
            { title: 'Caissier entrant',  name: session.nextSession ? '—' : 'À compléter' },
            { title: 'Responsable',       name: 'À compléter', optional: true },
          ].map(({ title, name, optional }) => (
            <div key={title} style={{ textAlign: 'center' }}>
              <p style={{ margin: '0 0 4px', fontSize: 11, color: '#6b7280', fontWeight: 600 }}>
                {title}{optional && ' (optionnel)'}
              </p>
              <p style={{ margin: '0 0 40px', fontSize: 12, color: '#374151' }}>{name}</p>
              <div style={{ borderBottom: '1.5px solid #374151', marginBottom: 4 }} />
              <p style={{ margin: 0, fontSize: 10, color: '#9ca3af' }}>Signature & date</p>
            </div>
          ))}
        </div>

        {/* Pied du rapport */}
        <div style={{
          marginTop: 20, paddingTop: 12, borderTop: '1px solid #f3f4f6',
          display: 'flex', justifyContent: 'space-between',
          fontSize: 10, color: '#9ca3af',
        }}>
          <span>Rapport généré le {new Date().toLocaleString('fr-FR')}</span>
          <span>Session {session.sessionNo} · {bureauName}</span>
        </div>
      </div>

    </div>
  )
}
