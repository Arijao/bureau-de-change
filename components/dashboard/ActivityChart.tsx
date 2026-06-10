'use client'
import { formatMGA } from '@/lib/utils'

interface DayData { label: string; count: number; totalMGA: number; achats: number; ventes: number }
export default function ActivityChart({ data }: { data: DayData[] }) {
  const max = Math.max(...data.map(d=>d.totalMGA), 1)
  return (
    <div className="chart-container">
      {data.map(day=>(
        <div key={day.label} className="chart-bar-item">
          <span className="chart-label">{day.label}</span>
          <div className="chart-track">
            <div className={`chart-fill ${day.label==='Auj.'?'chart-fill-today':'chart-fill-default'}`}
              style={{width:`${day.totalMGA?Math.max(4,(day.totalMGA/max)*100):0}%`}}>
              {day.count>0?`${day.count} op.`:''}
            </div>
          </div>
          <span className="chart-value">{day.totalMGA?formatMGA(day.totalMGA):'—'}</span>
        </div>
      ))}
    </div>
  )
}
