'use client'

/**
 * components/caisse/CashSessionPanel.tsx
 *
 * Orchestrateur principal de la page /caisse.
 * Décide quel écran afficher selon l'état de session :
 *  - Pas de session → OpenSessionForm
 *  - Session OPEN + vue "status" → CurrentSessionView
 *  - Session OPEN + vue "close" → PhysicalCountForm
 */

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import OpenSessionForm   from './OpenSessionForm'
import PhysicalCountForm from './PhysicalCountForm'
import Link              from 'next/link'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionBalance {
  id:          number
  balanceType: string
  amount:      number
  currency:    { id: number; code: string; flag: string; symbol: string | null }
  countDetails: Array<{ denomination: number; quantity: number }>
}

interface CurrentSession {
  id:          string
  sessionNo:   string
  status:      string
  openedAt:    string
  openingNote: string | null
  userId:      string
  previousSessionId: string | null
  user:        { name: string; role: string }
  balances:    SessionBalance[]
  previousSession?: { sessionNo: string; closedAt: string | null } | null
  _count?:     { transactions: number; expenses: number }
}

interface LastClosed {
  id:        string
  sessionNo: string
  closedAt:  string | null
  user:      { name: string; role: string }
  balances:  SessionBalance[]
}

interface CurrencyData {
  id:    number
  code:  string
  name:  string
  flag:  string
  symbol: string | null
  denominationCategories: Array<{ id: number; name: string; denominations: string; active: boolean }>
}

interface Props {
  user:           { id: string; name: string; role: string }
  currentSession: CurrentSession | null
  lastClosed:     LastClosed | null
  currencies:     CurrencyData[]
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDuration(openedAt: string): string {
  const diff    = Date.now() - new Date(openedAt).getTime()
  const minutes = Math.floor(diff / 60_000)
  const hours   = Math.floor(minutes / 60)
  const mins    = minutes % 60
  if (hours > 0) return `${hours}h ${String(mins).padStart(2, '0')}min`
  return `${minutes}min`
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function formatAmount(amount: number, code: string): string {
  const n = new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount)
  return `${n} ${code}`
}

// ── Sous-composant : vue session en cours ─────────────────────────────────────

function CurrentSessionView({
  session,
  onCloseClick,
}: {
  session:      CurrentSession
  onCloseClick: () => void
}) {
  const openingBalances = session.balances.filter(b => b.balanceType === 'OPENING')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>

      {/* Carte statut session */}
      <div style={{
        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
        border: '1px solid #86efac', borderRadius: 12, padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: '#16a34a', display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(22,163,74,0.25)',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: '#15803d' }}>
              Session {session.sessionNo}
            </span>
          </div>
          <span style={{
            background: '#dcfce7', color: '#15803d', fontSize: 12,
            fontWeight: 600, padding: '3px 10px', borderRadius: 999,
            border: '1px solid #86efac',
          }}>
            OUVERTE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Caissier</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>👤 {session.user.name}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Ouverte à</p>
            <p style={{ fontWeight: 600, color: '#111827' }}>{formatDateTime(session.openedAt)}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 2 }}>Durée</p>
            <p style={{ fontWeight: 600, color: '#15803d' }}>{formatDuration(session.openedAt)}</p>
          </div>
        </div>

        {session.previousSession && (
          <p style={{ marginTop: 12, fontSize: 12, color: '#6b7280' }}>
            Passation depuis : <strong>{session.previousSession.sessionNo}</strong>
            {session.previousSession.closedAt && ` (clôturée le ${formatDateTime(session.previousSession.closedAt)})`}
          </p>
        )}

        {session.openingNote && (
          <p style={{ marginTop: 8, fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>
            Note d'ouverture : {session.openingNote}
          </p>
        )}
      </div>

      {/* Activité session */}
      {session._count && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div style={{
            background: '#eff6ff', border: '1px solid #bfdbfe',
            borderRadius: 10, padding: '14px 18px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#1d4ed8', margin: 0 }}>
              {session._count.transactions}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Transaction{session._count.transactions !== 1 ? 's' : ''}</p>
          </div>
          <div style={{
            background: '#fff7ed', border: '1px solid #fed7aa',
            borderRadius: 10, padding: '14px 18px', textAlign: 'center',
          }}>
            <p style={{ fontSize: 28, fontWeight: 700, color: '#c2410c', margin: 0 }}>
              {session._count.expenses}
            </p>
            <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>Dépense{session._count.expenses !== 1 ? 's' : ''}</p>
          </div>
        </div>
      )}

      {/* Soldes d'ouverture */}
      {openingBalances.length > 0 && (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#374151' }}>
              Soldes d'ouverture
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {openingBalances.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ fontSize: 18, marginRight: 8 }}>{b.currency.flag}</span>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{b.currency.code}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: '#111827' }}>
                    {formatAmount(b.amount, b.currency.code)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: 12 }}>
        <button
          className="btn btn-danger"
          onClick={onCloseClick}
          style={{ flex: 1, padding: '12px 24px', fontSize: 15, fontWeight: 600 }}
        >
          🔒 Clôturer ma session
        </button>
        <Link
          href="/caisse/historique"
          className="btn btn-secondary"
          style={{ padding: '12px 20px' }}
        >
          📋 Historique
        </Link>
      </div>

    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function CashSessionPanel({
  user, currentSession, lastClosed, currencies,
}: Props) {
  const [view, setView] = useState<'status' | 'close'>('status')

  // ── Pas de session → formulaire d'ouverture ───────────────────────────────
  if (!currentSession) {
    return (
      <OpenSessionForm
        user={user}
        lastClosed={lastClosed}
        currencies={currencies}
      />
    )
  }

  // ── Session ouverte → formulaire de clôture ───────────────────────────────
  if (view === 'close') {
    return (
      <PhysicalCountForm
        session={currentSession}
        currencies={currencies}
        onCancel={() => setView('status')}
      />
    )
  }

  // ── Session ouverte → vue status ──────────────────────────────────────────
  return (
    <CurrentSessionView
      session={currentSession}
      onCloseClick={() => setView('close')}
    />
  )
}
