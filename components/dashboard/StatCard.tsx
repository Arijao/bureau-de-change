interface StatCardProps {
  label: string; value: string; sub?: string
  variant?: 'default'|'green'|'red'|'amber'|'blue'
  icon?: string
}
export default function StatCard({ label, value, sub, variant='default', icon }: StatCardProps) {
  return (
    <div className={`stat-card stat-${variant}`}>
      {icon&&<div className="stat-icon">{icon}</div>}
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {sub&&<div className="stat-sub">{sub}</div>}
    </div>
  )
}
