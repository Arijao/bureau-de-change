'use client'
import React from 'react'
import { formatMGA, formatDate } from '@/lib/utils'

interface JournalEntryLine {
  id: number
  accountId: number
  debit: number
  credit: number
  description: string | null
  account: {
    id: number
    code: string
    name: string
    type: string
  }
}

interface JournalEntry {
  id: number
  date: string
  description: string
  reference: string | null
  lines: JournalEntryLine[]
  transaction?: { receiptNo: string; type: string; amount: number } | null
  user?: { name: string } | null
}

interface Props {
  entries: JournalEntry[]
  total: number
}

export default function JournalTable({ entries, total }: Props) {
  if (entries.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <div className="empty-icon">📒</div>
          <h3>Aucune écriture comptable</h3>
          <p className="text-muted">
            Les écritures sont générées automatiquement lors des transactions
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="card">
      <div className="table-responsive">
        <table className="table table-striped">
          <thead>
            <tr>
              <th style={{ width: '120px' }}>Date</th>
              <th style={{ width: '120px' }}>Référence</th>
              <th>Description</th>
              <th>Compte</th>
              <th className="text-right" style={{ width: '150px' }}>Débit</th>
              <th className="text-right" style={{ width: '150px' }}>Crédit</th>
              <th style={{ width: '150px' }}>Utilisateur</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, entryIndex) => {
              const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0)
              const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0)
              const isFirstEntry = entryIndex === 0

              return (
                <React.Fragment key={entry.id}>
                  {/* Ligne principale de l'écriture */}
                  <tr style={{ backgroundColor: 'var(--bg2)', fontWeight: 500 }}>
                    <td rowSpan={entry.lines.length + 1}>
                      {formatDate(new Date(entry.date))}
                    </td>
                    <td rowSpan={entry.lines.length + 1}>
                      <span className="chip chip-blue">{entry.reference}</span>
                    </td>
                    <td rowSpan={entry.lines.length + 1} style={{ maxWidth: '300px' }}>
                      {entry.description}
                    </td>
                    <td colSpan={4} className="text-right text-muted" style={{ fontSize: '12px' }}>
                      Total écriture : Débit {formatMGA(totalDebit)} | Crédit {formatMGA(totalCredit)}
                    </td>
                  </tr>

                  {/* Lignes de détail */}
                  {entry.lines.map((line, lineIndex) => (
                    <tr key={line.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span className="chip chip-outline" style={{ fontSize: '11px' }}>
                            {line.account.code}
                          </span>
                          <span>{line.account.name}</span>
                        </div>
                      </td>
                      <td className="text-right">
                        {line.debit > 0 ? (
                          <span className="text-green" style={{ fontWeight: 600 }}>
                            {formatMGA(line.debit)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="text-right">
                        {line.credit > 0 ? (
                          <span className="text-red" style={{ fontWeight: 600 }}>
                            {formatMGA(line.credit)}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <small className="text-muted">
                          {line.description || (lineIndex === 0 && entry.user ? entry.user.name : '—')}
                        </small>
                      </td>
                    </tr>
                  ))}

                  {/* Séparateur entre écritures */}
                  {entryIndex < entries.length - 1 && (
                    <tr>
                      <td colSpan={7} style={{ height: '1px', backgroundColor: 'var(--border)', padding: 0 }} />
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
          <tfoot>
            <tr style={{ backgroundColor: 'var(--bg2)', fontWeight: 600 }}>
              <td colSpan={4} className="text-right">Total général ({total} écriture{total > 1 ? 's' : ''})</td>
              <td className="text-right text-green">
                {formatMGA(entries.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + l.debit, 0), 0))}
              </td>
              <td className="text-right text-red">
                {formatMGA(entries.reduce((sum, e) => sum + e.lines.reduce((s, l) => s + l.credit, 0), 0))}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}