'use client'
import { useState, useTransition } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

interface Currency { id: number; code: string; flag: string }
interface Props { currencies: Currency[] }

export default function TransactionFilters({ currencies }: Props) {
  const router = useRouter()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [dateFrom, setDateFrom] = useState(sp.get('dateFrom')||'')
  const [dateTo, setDateTo] = useState(sp.get('dateTo')||'')
  const [type, setType] = useState(sp.get('type')||'')
  const [currency, setCurrency] = useState(sp.get('currency')||'')

  function apply() {
    const p = new URLSearchParams()
    if (dateFrom) p.set('dateFrom', dateFrom); if (dateTo) p.set('dateTo', dateTo)
    if (type) p.set('type', type); if (currency) p.set('currency', currency)
    startTransition(()=>router.push('/transactions?'+p.toString()))
  }
  function reset() { setDateFrom(''); setDateTo(''); setType(''); setCurrency(''); startTransition(()=>router.push('/transactions')) }

  return (
    <div className="card filter-bar">
      <div className="filter-grid">
        <div className="form-group mb-0"><label className="form-label">Date début</label><input className="form-control" type="date" value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/></div>
        <div className="form-group mb-0"><label className="form-label">Date fin</label><input className="form-control" type="date" value={dateTo} onChange={e=>setDateTo(e.target.value)}/></div>
        <div className="form-group mb-0"><label className="form-label">Type</label>
          <select className="form-control" value={type} onChange={e=>setType(e.target.value)}>
            <option value="">Tous types</option><option value="ACHAT">Achat</option><option value="VENTE">Vente</option>
          </select>
        </div>
        <div className="form-group mb-0"><label className="form-label">Devise</label>
          <select className="form-control" value={currency} onChange={e=>setCurrency(e.target.value)}>
            <option value="">Toutes devises</option>
            {currencies.map(c=><option key={c.id} value={String(c.id)}>{c.code}</option>)}
          </select>
        </div>
        <div className="filter-actions"><button className="btn btn-primary" onClick={apply} disabled={isPending}>Filtrer</button><button className="btn btn-outline" onClick={reset}>Réinit.</button></div>
      </div>
    </div>
  )
}
