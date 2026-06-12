// app/(dashboard)/caisse/historique/page.tsx
// Server Component — charge la liste initiale des sessions

import { getSessionUser }    from '@/lib/auth'
import { redirect }          from 'next/navigation'
import { getSessionHistory } from '@/services/cash-session.service'
import { prisma }            from '@/lib/prisma'
import SessionHistoryTable   from '@/components/caisse/SessionHistoryTable'
import Link                  from 'next/link'

export const dynamic = 'force-dynamic'

export default async function HistoriquePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [{ sessions, total }, users] = await Promise.all([
    getSessionHistory({ limit: 50, offset: 0 }),
    prisma.user.findMany({
      select:  { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ])

  return (
    <div className="page-container">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h1 className="page-title">📋 Historique des sessions</h1>
          <p className="page-subtitle">
            {total} session{total !== 1 ? 's' : ''} enregistrée{total !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/caisse" className="btn btn-primary">
          ⊙ Ma session
        </Link>
      </div>

      <SessionHistoryTable
        initialSessions={JSON.parse(JSON.stringify(sessions))}
        totalInitial={total}
        users={users}
      />
    </div>
  )
}
