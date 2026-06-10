'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useEffect } from 'react'

export default function BalanceFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [dateFrom, setDateFrom] = useState(searchParams.get('dateFrom') || '')
  const [dateTo, setDateTo] = useState(searchParams.get('dateTo') || '')

  useEffect(() => {
    const params = new URLSearchParams()
    if (dateFrom) params.set('dateFrom', dateFrom)
    if (dateTo) params.set('dateTo', dateTo)

    const query = params.toString()
    router.push(`/accounting/balance${query ? `?${query}` : ''}`)
  }, [dateFrom, dateTo, router])

  const handleReset = () => {
    setDateFrom('')
    setDateTo('')
  }

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-icon card-icon-blue"></span>
        <h2 className="card-title">Période</h2>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Du</label>
          <input
            type="date"
            className="form-control"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="form-label">Au</label>
          <input
            type="date"
            className="form-control"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button className="btn btn-outline btn-sm" onClick={handleReset}>
           Réinitialiser
        </button>
      </div>
    </div>
  )
}