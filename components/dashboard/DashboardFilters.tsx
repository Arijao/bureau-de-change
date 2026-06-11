'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function getTodayStr(): string {
  return formatDate(new Date())
}

function getYesterdayStr(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return formatDate(d)
}

function getDaysAgoStr(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return formatDate(d)
}

function getFirstOfMonthStr(): string {
  const d = new Date()
  d.setDate(1)
  return formatDate(d)
}

interface DashboardFiltersProps {
  currentFrom: string
  currentTo: string
}

const inputStyle: React.CSSProperties = {
  padding: '5px 10px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: 13,
  background: 'var(--bg)',
  color: 'var(--text)',
  outline: 'none',
}

export default function DashboardFilters({ currentFrom, currentTo }: DashboardFiltersProps) {
  const router = useRouter()
  const todayStr = getTodayStr()

  const [dateFrom, setDateFrom] = useState(currentFrom)
  const [dateTo, setDateTo] = useState(currentTo)

  const apply = (from: string, to: string) => {
    setDateFrom(from)
    setDateTo(to)
    router.push(`/dashboard?dateFrom=${from}&dateTo=${to}`)
  }

  const shortcuts = [
    { label: "Aujourd'hui", from: todayStr,        to: todayStr        },
    { label: 'Hier',         from: getYesterdayStr(), to: getYesterdayStr() },
    { label: '7 jours',      from: getDaysAgoStr(6), to: todayStr       },
    { label: 'Ce mois',      from: getFirstOfMonthStr(), to: todayStr   },
  ]

  const isActive = (from: string, to: string) => dateFrom === from && dateTo === to

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-header">
        <span className="card-icon card-icon-blue">📅</span>
        <h2 className="card-title">Période d&apos;analyse</h2>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>

        {/* Raccourcis */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {shortcuts.map(s => (
            <button
              key={s.label}
              onClick={() => apply(s.from, s.to)}
              className={`btn btn-sm ${isActive(s.from, s.to) ? 'btn-primary' : 'btn-outline'}`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Saisie libre */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
          <input
            type="date"
            value={dateFrom}
            max={dateTo}
            onChange={e => setDateFrom(e.target.value)}
            style={inputStyle}
          />
          <span style={{ color: 'var(--text-muted, #888)', fontSize: 13 }}>→</span>
          <input
            type="date"
            value={dateTo}
            min={dateFrom}
            max={todayStr}
            onChange={e => setDateTo(e.target.value)}
            style={inputStyle}
          />
          <button
            onClick={() => apply(dateFrom, dateTo)}
            className="btn btn-primary btn-sm"
          >
            Appliquer
          </button>
        </div>

      </div>
    </div>
  )
}
