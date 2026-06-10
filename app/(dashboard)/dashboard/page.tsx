import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getDashboardStats, getWeeklyActivity, getTransactions } from '@/services/transaction.service'
import { getCurrenciesWithDetails } from '@/services/currency.service'
import { getAllStocks } from '@/services/stock.service'
import { formatMGA, formatNumber } from '@/lib/utils'
import ActivityChart from '@/components/dashboard/ActivityChart'
import StatCard from '@/components/dashboard/StatCard'
import Link from 'next/link'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const today = new Date(); today.setHours(0,0,0,0)
  const todayEnd = new Date(); todayEnd.setHours(23,59,59,999)

  const [stats, weekly, currencies, recentResult, stocks] = await Promise.all([
    getDashboardStats(today, todayEnd),
    getWeeklyActivity(),
    getCurrenciesWithDetails(true),
    getTransactions({ limit: 8 }),
    getAllStocks(),
  ])

  const { transactions: recentTx } = recentResult
  const currencyStats = stats.byCurrency as any[]
  const lowStocks = stocks.filter((s: any) => s.isLow)

  // 🔑 Extraction du stock MGA pour affichage prioritaire
  const mgaStock = stocks.find((s: any) => s.currency.code === 'MGA')
  const mgaAmount = mgaStock?.amount ?? 0
  const mgaIsLow = mgaStock?.isLow ?? false

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">📊 Tableau de bord</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('fr-FR',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
        <Link href="/transactions/new" className="btn btn-primary btn-lg">+ Nouvelle transaction</Link>
      </div>

      {lowStocks.length > 0 && (
        <div className="alert-banner" style={{marginBottom:16}}>
          ⚠️ <strong>Stock faible :</strong>{' '}
          {lowStocks.map((s: any) => `${s.currency.flag} ${s.currency.code} (${formatNumber(s.amount,2)})`).join(' · ')}{' '}
          <Link href="/stock" style={{color:'inherit',fontWeight:700,marginLeft:8}}>→ Gérer</Link>
        </div>
      )}

      <div className="stats-grid">
        {/* 🔑 NOUVEAU : Carte prioritaire pour le stock de référence MGA */}
        <StatCard 
          label="💰 Caisse MGA (Référence)" 
          value={formatMGA(mgaAmount)} 
          sub={mgaIsLow ? "⚠️ Seuil bas" : "Fonds de caisse actuel"} 
          variant={mgaIsLow ? "red" : "blue"} 
          icon="🏦" 
        />
        
        <StatCard label="Achats (aujourd'hui)" value={formatMGA(stats.totalAchatMGA)} sub={`${stats.achatsCount} opération(s)`} variant="green" icon="📥"/>
        <StatCard label="Ventes (aujourd'hui)" value={formatMGA(stats.totalVenteMGA)} sub={`${stats.ventesCount} opération(s)`} variant="red" icon="📤"/>
        <StatCard label="Commissions" value={formatMGA(stats.totalCommissions)} sub="Total cumulé" variant="amber" icon="💰"/>
        <StatCard label="Bénéfice net" value={formatMGA(stats.beneficeEstime)} sub="Marge après charges" variant={stats.beneficeEstime >= 0 ? "blue" : "red"} icon="📈" />
      
        {/* Détail du calcul du bénéfice net */}
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-header">
            <span className="card-icon card-icon-blue">📊</span>
            <h2 className="card-title">Détail du bénéfice net</h2>
          </div>
          <div className="table-responsive">
            <table className="table">
              <tbody>
                <tr>
                  <td>Marge sur ventes de devises</td>
                  <td className="text-right fw-600 text-green">{formatMGA(stats.margeSurVentes || 0)}</td>
                </tr>
                <tr>
                  <td>Revenus attestations payantes</td>
                  <td className="text-right fw-600 text-green">{formatMGA(stats.attestationRevenues || 0)}</td>
                </tr>
                <tr>
                  <td>Commissions perçues</td>
                  <td className="text-right fw-600 text-green">{formatMGA(stats.totalCommissions)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid var(--border)' }}>
                  <td className="fw-600">Total produits</td>
                  <td className="text-right fw-600 text-green">
                    {formatMGA((stats.margeSurVentes || 0) + (stats.attestationRevenues || 0) + stats.totalCommissions)}
                  </td>
                </tr>
                <tr>
                  <td>Dépenses d'exploitation</td>
                  <td className="text-right fw-600 text-red">-{formatMGA(stats.totalDepenses || 0)}</td>
                </tr>
                <tr>
                  <td>Salaires bruts (charges de personnel)</td>
                  <td className="text-right fw-600 text-red">-{formatMGA(stats.totalSalaires || 0)}</td>
                </tr>

                <tr style={{ backgroundColor: 'rgba(251, 191, 36, 0.1)' }}>
                  <td>
                    <span className="text-muted fs-12">⚠️ </span>
                    Avances en cours (non régularisées)
                    <div className="text-muted fs-11">
                      {stats.avancesEnCoursCount} avance(s) en attente de paie
                    </div>
                  </td>
                  <td className="text-right fw-600 text-amber">
                    {formatMGA(stats.avancesEnCours || 0)}
                  </td>
                </tr>

                <tr>
                  <td>CNaPS patronal</td>
                  <td className="text-right fw-600 text-red">-{formatMGA(stats.totalCnapsEmployer || 0)}</td>
                </tr>
                <tr style={{ borderTop: '2px solid var(--border)', backgroundColor: 'var(--bg2)' }}>
                  <td className="fw-700">BÉNÉFICE NET</td>
                  <td className={`text-right fw-700 ${stats.beneficeEstime >= 0 ? 'text-green' : 'text-red'}`}>
                    {formatMGA(stats.beneficeEstime)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>

      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header"><span className="card-icon card-icon-blue">📊</span><h2 className="card-title">Activité — 7 derniers jours</h2></div>
          <ActivityChart data={weekly}/>
        </div>

        <div className="card">
          <div className="card-header"><span className="card-icon card-icon-green">💱</span><h2 className="card-title">Taux & Stock en cours</h2></div>
          <table className="data-table">
            <thead><tr><th>Devise</th><th>Achat</th><th>Vente</th><th>Stock</th></tr></thead>
            <tbody>
              {(currencies as any[]).map((c: any) => (
                <tr key={c.id}>
                  <td><strong>{c.flag} {c.code}</strong></td>
                  <td className="text-green fw-600">{c.currentRate?formatNumber(c.currentRate.buyRate):'—'}</td>
                  <td className="text-red fw-600">{c.currentRate?formatNumber(c.currentRate.sellRate):'—'}</td>
                  <td className={c.stock?.amount<=c.stock?.alertLevel?'text-red fw-600':'text-muted fs-12'}>
                    {c.stock?formatNumber(c.stock.amount,2)+' '+c.code:'—'}
                    {c.stock?.amount<=c.stock?.alertLevel&&' ⚠️'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="dashboard-grid" style={{marginTop:16}}>
        {currencyStats.length>0&&(
          <div className="card">
            <div className="card-header"><span className="card-icon card-icon-amber">🏆</span><h2 className="card-title">Top devises du jour</h2></div>
            {currencyStats.sort((a:any,b:any)=>b.totalMGA-a.totalMGA).map((item:any,i:number)=>{
              const max = Math.max(...currencyStats.map((x:any)=>x.totalMGA),1)
              return (
                <div key={i} className="chart-bar-item">
                  <span className="chart-label">{item.currency.flag}</span>
                  <div className="chart-track"><div className="chart-fill chart-fill-amber" style={{width:`${Math.max(4,(item.totalMGA/max)*100)}%`}}>{item.count} op.</div></div>
                  <span className="chart-value">{formatMGA(item.totalMGA)}</span>
                </div>
              )
            })}
          </div>
        )}
        <div className="card">
          <div className="card-header"><span className="card-icon card-icon-red">🕐</span><h2 className="card-title">Dernières transactions</h2></div>
          {recentTx.length===0?<div className="empty-state"><div className="empty-icon">📋</div><div>Aucune transaction</div></div>:(
            <>
              <div className="recent-tx-list">
                {(recentTx as any[]).map((tx:any)=>(
                  <div key={tx.id} className="recent-tx-row">
                    <div className="recent-tx-left">
                      <span className={`chip ${tx.type==='ACHAT'?'chip-green':'chip-red'}`}>{tx.type}</span>
                      <span className="recent-tx-cur">{tx.currency.flag} {formatNumber(tx.amount,2)} {tx.currency.code}</span>
                    </div>
                    <div className="recent-tx-right">
                      <div className="fw-600">{formatMGA(tx.totalMGA)}</div>
                      <div className="text-muted fs-12">{tx.createdAt.toLocaleTimeString('fr-FR',{hour:'2-digit',minute:'2-digit'})}</div>
                    </div>
                  </div>
                ))}
              </div>
              <Link href="/transactions" className="btn btn-outline btn-sm btn-block" style={{marginTop:12}}>Voir tout →</Link>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
