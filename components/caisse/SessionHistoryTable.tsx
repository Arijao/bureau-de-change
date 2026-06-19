'use client'

/**
 * components/caisse/SessionHistoryTable.tsx
 *
 * Tableau de l'historique des sessions avec filtres (caissier, statut, dates)
 * et pagination côté client (refetch via server action).
 */

import { useState, useTransition } from 'react'
import Link                        from 'next/link'
import { getSessionHistoryAction } from '@/actions/cash-session.actions'

// ── Types ─────────────────────────────────────────────────────────────────────

interface SessionSummary {
  id:        string
  sessionNo: string
  status:    string
  openedAt:  Date
  closedAt:  Date | null
  user:      { name: string; role: string }
  balances:  Array<{
    balanceType: string
    amount:      number
    currency:    { code: string; flag: string }
  }>
  _count: { transactions: number; expenses: number }
}

interface Props {
  initialSessions: SessionSummary[]
  totalInitial:    number
  users:           Array<{ id: string; name: string; role: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(s: string | Date): string {
  return new Date(s).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtDuration(openedAt: string | Date, closedAt: string | Date | null): string {
  const end  = closedAt ? new Date(closedAt) : new Date()
  const diff = end.getTime() - new Date(openedAt).getTime()
  const m    = Math.floor(diff / 60_000)
  const h    = Math.floor(m / 60)
  const mins = m % 60
  if (h > 0) return `${h}h ${String(mins).padStart(2, '0')}min`
  return `${m}min`
}

const PAGE_SIZE = 20

// ── Composant ─────────────────────────────────────────────────────────────────

export default function SessionHistoryTable({ initialSessions, totalInitial, users }: Props) {
  const [isPending, startTransition] = useTransition()

  const [sessions, setSessions] = useState(initialSessions)
  const [total, setTotal]       = useState(totalInitial)
  const [page, setPage]         = useState(0)

  const [filterUser,   setFilterUser]   = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [filterFrom,   setFilterFrom]   = useState('')
  const [filterTo,     setFilterTo]     = useState('')

  // ── Fetch avec filtres ────────────────────────────────────────────────────

  function fetchPage(newPage: number, overrides?: Record<string, any>) {
    const filters = {
      userId:   filterUser   || undefined,
      status:   filterStatus || undefined,
      dateFrom: filterFrom   || undefined,
      dateTo:   filterTo     || undefined,
      limit:    PAGE_SIZE,
      offset:   newPage * PAGE_SIZE,
      ...overrides,
    }

    startTransition(async () => {
      const result = await getSessionHistoryAction(filters)
      if ('error' in result) return
      setSessions((result.sessions ?? []) as SessionSummary[])
      setTotal(result.total ?? 0)
      setPage(newPage)
    })
  }

  function handleFilter() { fetchPage(0) }

  function handleReset() {
    setFilterUser(''); setFilterStatus(''); setFilterFrom(''); setFilterTo('')
    fetchPage(0, { userId: undefined, status: undefined, dateFrom: undefined, dateTo: undefined })
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)

  // ── Rendu ─────────────────────────────────────────────────────────────────

  return (
    <div>

      {/* Filtres */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
        padding: 16, marginBottom: 20,
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr) auto auto', gap: 12, alignItems: 'flex-end' }}>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              CAISSIER
            </label>
            <select
              value={filterUser}
              onChange={e => setFilterUser(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid var(--border2)',
                  borderRadius: 6, fontSize: 13, background: 'var(--bg2)', color: 'var(--text)',
                }}
            >
              <option value="">Tous</option>
              {users.map(u => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              STATUT
            </label>
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid var(--border2)',
                  borderRadius: 6, fontSize: 13, background: 'var(--bg2)', color: 'var(--text)',
                }}
            >
              <option value="">Tous</option>
              <option value="OPEN">Ouverte</option>
              <option value="CLOSED">Clôturée</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              DU
            </label>
            <input
              type="date"
              value={filterFrom}
              onChange={e => setFilterFrom(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid var(--border2)',
                borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                background: 'var(--bg2)', color: 'var(--text)',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text2)', marginBottom: 4 }}>
              AU
            </label>
            <input
              type="date"
              value={filterTo}
              onChange={e => setFilterTo(e.target.value)}
              style={{
                width: '100%', padding: '7px 10px', border: '1px solid var(--border2)',
                borderRadius: 6, fontSize: 13, boxSizing: 'border-box',
                background: 'var(--bg2)', color: 'var(--text)',
              }}
            />
          </div>

          <button
            onClick={handleFilter}
            disabled={isPending}
            className="btn btn-primary"
            style={{ padding: '7px 18px', fontSize: 13, height: 35 }}
          >
            {isPending ? '…' : 'Filtrer'}
          </button>

          <button
            onClick={handleReset}
            disabled={isPending}
            className="btn btn-secondary"
            style={{ padding: '7px 18px', fontSize: 13, height: 35 }}
          >
            Reset
          </button>
        </div>
      </div>

      {/* Tableau */}
      <div style={{
        background: 'var(--bg2)', border: '1px solid var(--border)',
        borderRadius: 10, overflow: 'hidden',
      }}>
        <div style={{
          padding: '10px 16px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
            Sessions {total > 0 ? `(${total})` : ''}
          </span>
          {isPending && (
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>Chargement…</span>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                {['N° Session', 'Caissier', 'Ouverture', 'Clôture', 'Durée', 'Tx / Dép', 'Statut', 'Actions'].map((h, i) => (
                  <th key={i} style={{
                    padding: '8px 12px', textAlign: 'left',
                    fontSize: 11, fontWeight: 600, color: 'var(--text2)',
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                    borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap',
                  }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{
                    padding: '32px 16px', textAlign: 'center',
                    color: '#9ca3af', fontStyle: 'italic',
                  }}>
                    Aucune session trouvée
                  </td>
                </tr>
              ) : sessions.map(s => {
                const isClosed = s.status === 'CLOSED'
                return (
                  <tr key={s.id} style={{
                    borderBottom: '1px solid var(--border)',
                    opacity: isPending ? 0.6 : 1,
                    transition: 'opacity 0.15s',
                  }}>

                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 700, fontFamily: 'monospace', fontSize: 13 }}>
                        {s.sessionNo}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 500 }}>👤 {s.user.name}</span>
                      <span style={{
                        marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 3,
                        background: s.user.role === 'ADMIN' ? 'var(--amber-bg)' : 'var(--blue-bg)',
                        color:      s.user.role === 'ADMIN' ? 'var(--amber)'    : 'var(--blue)',
                      }}>
                        {s.user.role}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>
                      {fmtDate(s.openedAt)}
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text2)', fontSize: 12 }}>
                      {s.closedAt ? fmtDate(s.closedAt) : <span style={{ color: 'var(--green)' }}>En cours</span>}
                    </td>

                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text)' }}>
                      {fmtDuration(s.openedAt, s.closedAt)}
                    </td>

                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12 }}>
                        <strong>{s._count.transactions}</strong>
                        <span style={{ color: '#9ca3af', margin: '0 3px' }}>/</span>
                        <strong>{s._count.expenses}</strong>
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 999,
                        background: isClosed ? 'var(--bg3)'       : 'var(--green-bg)',
                        color:      isClosed ? 'var(--text2)'     : 'var(--green)',
                        border:     `1px solid ${isClosed ? 'var(--border2)' : 'var(--green-light)'}`,
                      }}>
                        {isClosed ? 'Clôturée' : '● Ouverte'}
                      </span>
                    </td>

                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Link
                          href={`/caisse/rapport/${s.id}`}
                          style={{
                            fontSize: 11, padding: '4px 10px', borderRadius: 5,
                            background: 'var(--blue-bg)', color: 'var(--accent)',
                            border: '1px solid var(--blue)', textDecoration: 'none', fontWeight: 500,
                          }}
                        >
                          Rapport
                        </Link>
                      </div>
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '12px 16px', borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text2)' }}>
              Page {page + 1} / {totalPages} · {total} sessions
            </span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button
                onClick={() => fetchPage(page - 1)}
                disabled={page === 0 || isPending}
                className="btn btn-secondary"
                style={{ padding: '5px 14px', fontSize: 12 }}
              >
                ← Préc.
              </button>
              <button
                onClick={() => fetchPage(page + 1)}
                disabled={page >= totalPages - 1 || isPending}
                className="btn btn-secondary"
                style={{ padding: '5px 14px', fontSize: 12 }}
              >
                Suiv. →
              </button>
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
