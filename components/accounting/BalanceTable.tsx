import { getTrialBalance } from '@/services/accounting.service'
import { formatMGA, formatDate } from '@/lib/utils'

interface Props {
  dateFrom?: string
  dateTo?: string
}

export default async function BalanceTable({ dateFrom, dateTo }: Props) {
  try {
    const result = await getTrialBalance(dateFrom, dateTo)

    if (result.accounts.length === 0) {
      return (
        <div className="card">
          <div className="empty-state">
            <div className="empty-icon">⚖️</div>
            <h3>Aucun compte</h3>
            <p className="text-muted">
              Aucun compte comptable n'a été initialisé
            </p>
          </div>
        </div>
      )
    }

    return (
      <div className="card">
        <div className="card-header">
          <div>
            <strong>Balance Générale</strong>
          </div>
          <div className="text-muted" style={{ fontSize: 12 }}>
            Période : {formatDate(result.from)} → {formatDate(result.to)}
          </div>
        </div>

        <div className="table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '100px' }}>Code</th>
                <th>Compte</th>
                <th style={{ width: '100px' }}>Type</th>
                <th className="text-right" style={{ width: '150px' }}>Débit</th>
                <th className="text-right" style={{ width: '150px' }}>Crédit</th>
                <th className="text-right" style={{ width: '150px' }}>Solde</th>
              </tr>
            </thead>
            <tbody>
              {result.accounts.map((account) => (
                <tr key={account.accountId}>
                  <td>
                    <span className="chip chip-blue" style={{ fontSize: 11 }}>
                      {account.code}
                    </span>
                  </td>
                  <td>{account.name}</td>
                  <td>
                    <span className={`chip ${
                      account.type === 'ASSET' ? 'chip-blue' :
                      account.type === 'LIABILITY' ? 'chip-red' :
                      account.type === 'EQUITY' ? 'chip-purple' :
                      account.type === 'REVENUE' ? 'chip-green' :
                      'chip-amber'
                    }`} style={{ fontSize: 10 }}>
                      {account.type}
                    </span>
                  </td>
                  <td className="text-right">
                    {account.totalDebit > 0 ? (
                      <span className="text-green">{formatMGA(account.totalDebit)}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    {account.totalCredit > 0 ? (
                      <span className="text-red">{formatMGA(account.totalCredit)}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="text-right">
                    <strong className={account.balance >= 0 ? 'text-green' : 'text-red'}>
                      {formatMGA(account.balance)}
                    </strong>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: 'var(--bg2)', fontWeight: 600 }}>
                <td colSpan={3} className="text-right">Total Général</td>
                <td className="text-right text-green">{formatMGA(result.totals.totalDebit)}</td>
                <td className="text-right text-red">{formatMGA(result.totals.totalCredit)}</td>
                <td className="text-right">
                  <strong className={result.totals.isBalanced ? 'text-green' : 'text-red'}>
                    {formatMGA(result.totals.totalDebit - result.totals.totalCredit)}
                  </strong>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card-footer">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="text-muted fs-12">
              {result.accounts.length} compte(s) actif(s)
            </div>
            <div>
              {result.totals.isBalanced ? (
                <span className="chip chip-green">✓ Équilibrée</span>
              ) : (
                <span className="chip chip-red">✗ Déséquilibrée</span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  } catch (error: any) {
    return (
      <div className="alert alert-error">
        Erreur lors du chargement de la balance : {error.message}
      </div>
    )
  }
}