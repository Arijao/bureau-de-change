'use client'

/**
 * components/caisse/CashSessionPanel.tsx
 *
 * Orchestrateur principal de la page /caisse.
 * Décide quel écran afficher selon l'état de session :
 *  - Pas de session → OpenSessionForm
 *  - Session OPEN + vue "status" → CurrentSessionView (avec onglets)
 *  - Session OPEN + vue "close" → PhysicalCountForm
 */

import { useState }      from 'react'
import { useRouter }     from 'next/navigation'
import OpenSessionForm   from './OpenSessionForm'
import PhysicalCountForm from './PhysicalCountForm'
import Link              from 'next/link'
import CurrencyFlag      from '@/components/ui/CurrencyFlag'
import ExpenseForm        from '@/components/charges/ExpenseForm'
import { ALL_EXPENSE_CATEGORIES } from '@/lib/expense-roles'

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
  // [MOD-5] _count retiré des badges — remplacé par transactionCount et sessionExpenses.length
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

interface Account {
  id:   number
  code: string
  name: string
}

interface SessionExpense {
  id:          number
  date:        string
  amount:      number
  category:    string
  description: string
  supplier:    string | null
  reference:   string | null
  note:        string | null
  account:     { code: string; name: string }
}

interface Props {
  user:             { id: string; name: string; role: string }
  currentSession:   CurrentSession | null
  lastClosed:       LastClosed | null
  currencies:       CurrencyData[]
  accounts:         Account[]
  sessionExpenses:  SessionExpense[]
  transactionCount: number   // [MOD-5] comptage direct Prisma, toujours à jour
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

function formatMGA(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount) + ' Ar'
}

function getCategoryLabel(value: string): string {
  return ALL_EXPENSE_CATEGORIES.find(c => c.value === value)?.label ?? value
}

// ── Sous-composant : liste des dépenses de la session ─────────────────────────

function SessionExpenseList({ expenses }: { expenses: SessionExpense[] }) {
  if (expenses.length === 0) {
    return (
      <div style={{
        textAlign: 'center', padding: '32px 0',
        color: 'var(--text2)', fontSize: 13,
      }}>
        <div style={{ fontSize: 28, marginBottom: 8 }}>💸</div>
        Aucune dépense enregistrée pour cette session
      </div>
    )
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0)

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)' }}>Catégorie</th>
              <th style={{ padding: '8px 14px', textAlign: 'left', fontWeight: 600, color: 'var(--text2)' }}>Description</th>
              <th style={{ padding: '8px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--text2)' }}>Montant</th>
            </tr>
          </thead>
          <tbody>
            {expenses.map(e => (
              <tr key={e.id} style={{ borderBottom: '1px solid var(--border)' }}>
                <td style={{ padding: '9px 14px' }}>
                  <span style={{
                    fontSize: 11, fontWeight: 600, background: 'var(--amber-bg)',
                    color: 'var(--amber)', padding: '2px 7px', borderRadius: 999,
                  }}>
                    {getCategoryLabel(e.category)}
                  </span>
                </td>
                <td style={{ padding: '9px 14px', color: 'var(--text)' }}>
                  {e.description}
                  {e.supplier && (
                    <span style={{ fontSize: 11, color: 'var(--text2)', marginLeft: 6 }}>
                      — {e.supplier}
                    </span>
                  )}
                </td>
                <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 600, color: 'var(--red)' }}>
                  − {formatMGA(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr style={{ background: 'var(--bg3)', borderTop: '2px solid var(--border)' }}>
              <td colSpan={2} style={{ padding: '9px 14px', fontWeight: 700, color: 'var(--text)' }}>
                Total dépenses de session
              </td>
              <td style={{ padding: '9px 14px', textAlign: 'right', fontWeight: 700, color: 'var(--red)' }}>
                − {formatMGA(total)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Sous-composant : vue session en cours ─────────────────────────────────────

function CurrentSessionView({
  session,
  onCloseClick,
  accounts,
  sessionExpenses,
  userRole,
  transactionCount,   // [MOD-5]
}: {
  session:          CurrentSession
  onCloseClick:     () => void
  accounts:         Account[]
  sessionExpenses:  SessionExpense[]
  userRole:         'ADMIN' | 'CAISSIER'
  transactionCount: number   // [MOD-5]
}) {
  const [activeTab, setActiveTab] = useState<'transactions' | 'expenses'>('transactions')

  const openingBalances = session.balances.filter(b => b.balanceType === 'OPENING')

  // [MOD-5] Source de vérité : comptage direct Prisma (transactionCount)
  //         et longueur du tableau sessionExpenses — ni l'un ni l'autre ne dépend de _count
  const txCount      = transactionCount        // [MOD-5] était : session._count?.transactions ?? 0
  const expenseCount = sessionExpenses.length  // [MOD-5] était : session._count?.expenses ?? 0

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 800 }}>

      {/* Carte statut session */}
      <div style={{
        background: 'var(--green-bg)',
        border: '1px solid var(--green-light)', borderRadius: 12, padding: 24,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              width: 12, height: 12, borderRadius: '50%',
              background: '#16a34a', display: 'inline-block',
              boxShadow: '0 0 0 3px rgba(22,163,74,0.25)',
              animation: 'pulse 2s infinite',
            }} />
            <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--green)' }}>
              Session {session.sessionNo}
            </span>
          </div>
          <span style={{
            background: 'var(--green)', color: 'var(--bg2)', fontSize: 12,
            fontWeight: 700, padding: '3px 10px', borderRadius: 999,
            border: '1px solid var(--green)',
          }}>
            OUVERTE
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 16 }}>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Caissier</p>
            <p style={{ fontWeight: 600, color: 'var(--text)' }}>👤 {session.user.name}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Ouverte à</p>
            <p style={{ fontWeight: 600, color: 'var(--text)' }}>{formatDateTime(session.openedAt)}</p>
          </div>
          <div>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 2 }}>Durée</p>
            <p style={{ fontWeight: 600, color: 'var(--green)' }}>{formatDuration(session.openedAt)}</p>
          </div>
        </div>

        {session.previousSession && (
          <p style={{ marginTop: 12, fontSize: 12, color: 'var(--text2)' }}>
            Passation depuis : <strong>{session.previousSession.sessionNo}</strong>
            {session.previousSession.closedAt && ` (clôturée le ${formatDateTime(session.previousSession.closedAt)})`}
          </p>
        )}

        {session.openingNote && (
          <p style={{ marginTop: 8, fontSize: 12, color: 'var(--text2)', fontStyle: 'italic' }}>
            Note d'ouverture : {session.openingNote}
          </p>
        )}
      </div>

      {/* Onglets : Transactions | Dépenses de caisse */}
      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>

        {/* Barre d'onglets */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border)',
          background: 'var(--bg3)',
        }}>
          <button
            onClick={() => setActiveTab('transactions')}
            style={{
              flex: 1, padding: '12px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === 'transactions' ? '2px solid var(--blue)' : '2px solid transparent',
              color: activeTab === 'transactions' ? 'var(--blue)' : 'var(--text2)',
              fontWeight: activeTab === 'transactions' ? 700 : 400,
              cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
            }}
          >
            💱 Transactions
            {/* [MOD-5] Badge : transactionCount (Prisma direct) au lieu de session._count */}
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 700,
              background: activeTab === 'transactions' ? 'var(--blue)' : 'var(--border2)',
              color: activeTab === 'transactions' ? '#fff' : 'var(--text2)',
              padding: '1px 7px', borderRadius: 999,
            }}>
              {txCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('expenses')}
            style={{
              flex: 1, padding: '12px 16px', background: 'none', border: 'none',
              borderBottom: activeTab === 'expenses' ? '2px solid var(--amber)' : '2px solid transparent',
              color: activeTab === 'expenses' ? 'var(--amber)' : 'var(--text2)',
              fontWeight: activeTab === 'expenses' ? 700 : 400,
              cursor: 'pointer', fontSize: 14, transition: 'all 0.15s',
            }}
          >
            💸 Dépenses de caisse
            {/* [MOD-5] Badge : sessionExpenses.length (tableau déjà chargé) au lieu de session._count */}
            <span style={{
              marginLeft: 8, fontSize: 12, fontWeight: 700,
              background: activeTab === 'expenses' ? 'var(--amber)' : 'var(--border2)',
              color: activeTab === 'expenses' ? '#fff' : 'var(--text2)',
              padding: '1px 7px', borderRadius: 999,
            }}>
              {expenseCount}
            </span>
          </button>
        </div>

        {/* Contenu de l'onglet Transactions */}
        {activeTab === 'transactions' && (
          <div style={{ padding: 20 }}>
            {txCount === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text2)', fontSize: 13 }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>💱</div>
                Aucune transaction pour cette session
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <p style={{ fontSize: 32, fontWeight: 700, color: 'var(--blue)', margin: 0 }}>
                  {txCount}
                </p>
                <p style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                  transaction{txCount > 1 ? 's' : ''} dans cette session
                </p>
                <Link
                  href="/transactions"
                  className="btn btn-outline btn-sm"
                  style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  📋 Voir toutes les transactions
                </Link>
              </div>
            )}
          </div>
        )}

        {/* Contenu de l'onglet Dépenses */}
        {activeTab === 'expenses' && (
          <div style={{ padding: 20 }}>
            <ExpenseForm
              accounts={accounts}
              userRole={userRole}
            />
            <SessionExpenseList expenses={sessionExpenses} />
          </div>
        )}
      </div>

      {/* Soldes d'ouverture */}
      {openingBalances.length > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
            <h3 style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Soldes d'ouverture
            </h3>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {openingBalances.map(b => (
                <tr key={b.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{ marginRight: 8 }}><CurrencyFlag code={b.currency.code} flag={b.currency.flag} size={18} /></span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{b.currency.code}</span>
                  </td>
                  <td style={{ padding: '10px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text)' }}>
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
          className="btn btn-outline"
          style={{
            padding: '12px 20px',
            border: '1px solid var(--border2)',
            color: 'var(--text)',
            background: 'var(--bg2)',
          }}
        >
          📋 Historique
        </Link>
      </div>

    </div>
  )
}

// ── Composant principal ────────────────────────────────────────────────────────

export default function CashSessionPanel({
  user, currentSession, lastClosed, currencies, accounts, sessionExpenses, transactionCount,
}: Props) {
  const [view, setView] = useState<'status' | 'close'>('status')

  if (!currentSession) {
    return (
      <OpenSessionForm
        user={user}
        lastClosed={lastClosed}
        currencies={currencies}
      />
    )
  }

  if (view === 'close') {
    return (
      <PhysicalCountForm
        session={currentSession}
        currencies={currencies}
        onCancel={() => setView('status')}
      />
    )
  }

  return (
    <CurrentSessionView
      session={currentSession}
      onCloseClick={() => setView('close')}
      accounts={accounts}
      sessionExpenses={sessionExpenses}
      userRole={user.role as 'ADMIN' | 'CAISSIER'}
      transactionCount={transactionCount}   // [MOD-5]
    />
  )
}