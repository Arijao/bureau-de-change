'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useRef, useEffect } from 'react'
import type { CashSessionBanner } from '@/lib/types'  // ← AJOUT (côté serveur → prop)

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavItem {
  href: string
  label: string
  icon: string
  adminOnly?: boolean
}

interface NavGroup {
  label: string
  icon: string
  items: NavItem[]
}

// ─── Structure de navigation ──────────────────────────────────────────────────

const COMMON_GROUPS: NavGroup[] = [
  {
    label: 'Opérations',
    icon: '💱',
    items: [
      { href: '/transactions/new', label: 'Nouvelle transaction', icon: '💱' },
      { href: '/transactions',     label: 'Historique',           icon: '📋' },
      { href: '/attestations',     label: 'Attestations',         icon: '📄' },
    ],
  },
  {
    label: 'Stock & Devises',
    icon: '📦',
    items: [
      { href: '/currencies', label: 'Devises & Taux', icon: '💹' },
      { href: '/stock',      label: 'Stocks',         icon: '📦' },
    ],
  },
]

const ADMIN_GROUPS: [NavGroup, NavGroup] = [
  {
    label: 'Comptabilité',
    icon: '📒',
    items: [
      { href: '/accounting/journal', label: 'Journal',     icon: '📒' },
      { href: '/accounting/ledger',  label: 'Grand Livre', icon: '📖' },
      { href: '/accounting/balance', label: 'Balance',     icon: '⚖️' },
      { href: '/charges',            label: 'Charges',     icon: '💸' },
    ],
  },
  {
    label: 'Administration',
    icon: '⚙️',
    items: [
      { href: '/settings',     label: 'Paramètres', icon: '⚙️' },
      { href: '/admin/backup', label: 'Backups',    icon: '💾' },
    ],
  },
]

function formatSessionDuration(openedAt: Date): string {
  const diffMs  = Date.now() - new Date(openedAt).getTime()
  const minutes = Math.floor(diffMs / 60_000)
  const hours   = Math.floor(minutes / 60)
  const mins    = minutes % 60
  if (hours > 0) return `${hours}h${String(mins).padStart(2, '0')}`
  return `${mins}min`
}


// ─── Composant dropdown ───────────────────────────────────────────────────────

interface DropdownProps {
  group: NavGroup
  isAdmin: boolean
  pathname: string
  openKey: string | null
  setOpenKey: (key: string | null) => void
}

function isActive(pathname: string, href: string) {
  if (pathname === href) return true

  // Historique ne doit pas être actif sur /transactions/new
  if (href === '/transactions') {
    return pathname === '/transactions'
  }

  return pathname.startsWith(href)
}

function NavDropdown({ group, isAdmin, pathname, openKey, setOpenKey }: DropdownProps) {
  const ref = useRef<HTMLDivElement>(null)
  const isOpen = openKey === group.label

  const visibleItems = group.items.filter(item => !item.adminOnly || isAdmin)

  const isGroupActive = visibleItems.some(
    item => isActive(pathname, item.href)
  )

  // Fermeture au clic extérieur
  useEffect(() => {
    if (!isOpen) return
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpenKey(null)
      }
    }
    document.addEventListener('mousedown', onOutside)
    return () => document.removeEventListener('mousedown', onOutside)
  }, [isOpen, setOpenKey])

  // Fermeture à la touche Échap
  useEffect(() => {
    if (!isOpen) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpenKey(null)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, setOpenKey])

  if (visibleItems.length === 0) return null

  return (
    <div
      ref={ref}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        height: '100%',
      }}
    >

      {/* Déclencheur */}
      <button
        className={`navbar-link ${isGroupActive || isOpen ? 'active' : ''}`}
        onClick={() => setOpenKey(isOpen ? null : group.label)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
          padding: 0,
          font: 'inherit',
        }}
      >
        {group.icon} {group.label}
        <span style={{
          fontSize: 20,
          marginLeft: 2,
          display: 'inline-block',
          transition: 'transform 0.18s ease',
          transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          ▾
        </span>
      </button>

      {/* Panneau déroulant */}
      {isOpen && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          minWidth: 210,
          background: 'var(--bg, #ffffff)',
          border: '1px solid var(--border, #e5e7eb)',
          borderRadius: 8,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.12)',
          zIndex: 99999,
          padding: '4px 0',
        }}>
          {visibleItems.map(item => {
            const active = isActive(pathname, item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpenKey(null)}
                className={`navbar-link ${active ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '9px 18px',
                  borderRadius: 0,
                  whiteSpace: 'nowrap',
                }}
              >
                {item.icon} {item.label}
              </Link>
            )
          })}
        </div>
      )}

    </div>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────────

interface NavbarProps {
  user: { name: string; role: string }
  bureauName: string
  sessionBanner?: CashSessionBanner | null
}

export default function Navbar({ user, bureauName, sessionBanner  }: NavbarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const isAdmin = user.role === 'ADMIN'

  // Un seul dropdown ouvert à la fois
  const [openKey, setOpenKey] = useState<string | null>(null)

  // Fermeture automatique lors d'un changement de route
  useEffect(() => { setOpenKey(null) }, [pathname])

  async function handleLogout() {
    await fetch('/api/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  return (
    <nav className="navbar">

      {/* ── Marque ──────────────────────────────────────────────── */}
      <div className="navbar-brand">
        <div className="navbar-logo">₵</div>
        <span className="navbar-title">{bureauName}</span>
      </div>

      
        {/* ── Bandeau session ──────────────────────────────────── */}
        {sessionBanner ? (
          <div
            className="session-banner session-banner--open"
            title={`Session ${sessionBanner.sessionNo} ouverte par ${sessionBanner.userName}`}
          >
            <span className="session-banner__dot" />
            <span className="session-banner__label">
              {sessionBanner.sessionNo}
            </span>
            <span className="session-banner__duration">
              {formatSessionDuration(sessionBanner.openedAt)}
            </span>
            <a href="/caisse" className="session-banner__link">
              Gérer →
            </a>
          </div>
        ) : (
          <div className="session-banner session-banner--closed">
            <span className="session-banner__dot session-banner__dot--off" />
            <a href="/caisse" className="session-banner__link session-banner__link--alert">
              ⚠ Ouvrir une session
            </a>
          </div>
        )}
      

      {/* ── Liens ───────────────────────────────────────────────── */}
      <div className="navbar-links">

        {/* Tableau de bord — lien direct (tous les rôles) */}
       <Link
         href="/dashboard"
         className={`navbar-link ${pathname === '/dashboard' ? 'active' : ''}`}
       >
         📊 Tableau de bord
       </Link>
    
       {/* Session de caisse — visible par tous les rôles (Q4) */}
       <Link
         href="/caisse"
         className={`navbar-link ${pathname.startsWith('/caisse') ? 'active' : ''}`}
       >
         ⊙ Caisse
       </Link>

        {/* Opérations · Stock & Devises — communs à tous les rôles */}
        {COMMON_GROUPS.map(group => (
          <NavDropdown
            key={group.label}
            group={group}
            isAdmin={isAdmin}
            pathname={pathname}
            openKey={openKey}
            setOpenKey={setOpenKey}
          />
        ))}

        {/* Comptabilité · RH · Administration — admin uniquement */}
        {isAdmin && (
          <>
            <NavDropdown
              group={ADMIN_GROUPS[0]}
              isAdmin={isAdmin}
              pathname={pathname}
              openKey={openKey}
              setOpenKey={setOpenKey}
            />

            {/* RH — lien direct (un seul lien dans le navbar) */}
            <Link
              href="/hr"
              className={`navbar-link ${pathname.startsWith('/hr') ? 'active' : ''}`}
            >
              👥 RH
            </Link>

            <NavDropdown
              group={ADMIN_GROUPS[1]}
              isAdmin={isAdmin}
              pathname={pathname}
              openKey={openKey}
              setOpenKey={setOpenKey}
            />
          </>
        )}

      </div>

      {/* ── Utilisateur ─────────────────────────────────────────── */}
      <div className="navbar-user">
        <span className="user-name">👤 {user.name}</span>
        <span className={`role-badge ${user.role === 'ADMIN' ? 'role-admin' : 'role-caissier'}`}>
          {user.role}
        </span>
        <button className="btn-logout" onClick={handleLogout}>Déconnexion</button>
      </div>

    </nav>
  )
}
