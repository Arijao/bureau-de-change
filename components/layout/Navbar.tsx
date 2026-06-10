'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

interface NavbarProps { user: { name: string; role: string }; bureauName: string }

const navItems = [
  { href: '/dashboard', label: 'Tableau de bord', icon: '📊' },
  { href: '/transactions/new', label: 'Nouvelle transaction', icon: '💱' },
  { href: '/transactions', label: 'Historique', icon: '📋' },
  { href: '/currencies', label: 'Devises & Taux', icon: '💹' },
  { href: '/stock', label: 'Stocks', icon: '📦' },
]

export default function Navbar({ user, bureauName }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login'); router.refresh()
  }

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <div className="navbar-logo">₵</div>
        <span className="navbar-title">{bureauName}</span>
      </div>
      <div className="navbar-links">
        {navItems.map(item => (
          <Link key={item.href} href={item.href}
            className={`navbar-link ${pathname===item.href||(item.href!=='/dashboard'&&pathname.startsWith(item.href))?'active':''}`}>
            {item.icon} {item.label}
          </Link>
        ))}
        {user.role==='ADMIN' && (
          <>
            <Link href="/hr" className={`navbar-link ${pathname.startsWith('/hr')?'active':''}`}>👥 RH</Link>
            <Link href="/attestations" className={`navbar-link ${pathname.startsWith('/attestations')?'active':''}`}>📄 Attestations</Link>
            <Link href="/charges" className={`navbar-link ${pathname.startsWith('/charges')?'active':''}`}>💸 Charges</Link>
            <Link href="/accounting/journal" className={`navbar-link ${pathname.startsWith('/accounting/journal')?'active':''}`}>📒 Journal</Link>
            <Link href="/accounting/ledger" className={`navbar-link ${pathname.startsWith('/accounting/ledger')?'active':''}`}>📖 Grand Livre</Link>
            <Link href="/accounting/balance" className={`navbar-link ${pathname.startsWith('/accounting/balance')?'active':''}`}>⚖️ Balance</Link>
            <Link href="/settings" className={`navbar-link ${pathname==='/settings'?'active':''}`}>⚙️ Paramètres</Link>
            <Link href="/admin/backup" className={`navbar-link ${pathname==='/admin/backup'||pathname.startsWith('/admin/backup')?'active':''}`}>💾 Backups</Link>
          </>
        )}
      </div>
      <div className="navbar-user">
        <span className="user-name">👤 {user.name}</span>
        <span className={`role-badge ${user.role==='ADMIN'?'role-admin':'role-caissier'}`}>{user.role}</span>
        <button className="btn-logout" onClick={handleLogout}>Déconnexion</button>
      </div>
    </nav>
  )
}