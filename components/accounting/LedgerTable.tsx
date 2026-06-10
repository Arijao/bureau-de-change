import { getLedger } from '@/services/accounting.service'
import { formatMGA, formatDate } from '@/lib/utils'

interface Props {
  accountId: number
  dateFrom?: string
  dateTo?: string
}

export default async function LedgerTable({ accountId, dateFrom, dateTo }: Props) {
  try {
    const result = await getLedger(accountId, { dateFrom, dateTo })

    if (result.lines.length === 0) {
      return (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">📖</div>
            <h3>Aucun mouvement</h3>
            <p className="text-muted">
              Ce compte n'a aucun mouvement sur la période sélectionnée
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="card">
        <div className="card-header">
          <div>
            <span className="chip chip-blue" style={{ marginRight: 8 }}>
              {result.account.code}
            </span>
            <strong>{result.account.name}</strong>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            {result.account.type}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '120px' }}>Date</th>
                <th>Référence</th>
                <th>Description</th>
                <th className="text-right" style={{ width: '150px' }}>Débit</th>
                <th className="text-right" style={{ width: '150px' }}>Crédit</th>
                <th className="text-right" style={{ width: '150px' }}>Solde</th>
              </tr>
            </thead>
            <tbody>
              {result.lines.map((line) => (
                <tr key={line.id}>
                  <td>{formatDate(new Date(line.journalEntry.date))}</td>
                  <td>
                    <span className="chip chip-outline" style={{ fontSize: 11 }}>
                      {line.journalEntry.reference || '—'}
                    </span>
                  </td>
                  <td>{line.description || line.journalEntry.description}</td>
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
                  <td className="text-right">
                    <strong>{formatMGA(line.debit - line.credit)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg2)', fontWeight: 600 }}>
                <td colSpan={3} className="text-right">Total</td>
                <td className="text-right text-green">{formatMGA(result.totals.debit)}</td>
                <td className="text-right text-red">{formatMGA(result.totals.credit)}</td>
                <td className="text-right">
                  <strong className={result.totals.balance >= 0 ? 'text-green' : 'text-red'}>
                    {formatMGA(result.totals.balance)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card-footer">
          <div className="text-muted fs-12">
            {result.lines.length} mouvement(s) sur la période
          </div>
        </div>
      </div>
    )
  } catch (error: any) {
    return (
      <div className="alert alert-error">
        Erreur lors du chargement du grand livre : {error.message}
      </div>
    )
  }
}