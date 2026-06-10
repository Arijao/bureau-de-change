import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getAllStocks } from '@/services/stock.service'
import { getStockLogs } from '@/services/stock.service'
import { formatNumber, formatMGA, formatDate, formatTime } from '@/lib/utils'
import StockClient from '@/components/stock/StockClient'

export const dynamic = 'force-dynamic'

export default async function StockPage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [stocks, logs] = await Promise.all([
    getAllStocks(),
    getStockLogs(undefined, 60),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div><h1 className="page-title">📦 Gestion des stocks</h1><p className="page-subtitle">Liquidité par devise · Mouvements de caisse</p></div>
      </div>
      <StockClient stocks={stocks as any} logs={logs as any} isAdmin={user.role === 'ADMIN'} />
    </div>
  )
}
