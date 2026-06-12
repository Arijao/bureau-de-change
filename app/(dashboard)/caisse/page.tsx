// app/(dashboard)/caisse/page.tsx
// Server Component — charge les données puis délègue au Client Component

import { getSessionUser }                        from '@/lib/auth'
import { redirect }                              from 'next/navigation'
import { getOpenSession, getLastClosedSession }  from '@/services/cash-session.service'
import { prisma }                                from '@/lib/prisma'
import CashSessionPanel                          from '@/components/caisse/CashSessionPanel'

export const dynamic = 'force-dynamic'

export default async function CaissePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const [currentSession, lastClosed, currencies] = await Promise.all([
    getOpenSession(user.id),
    getLastClosedSession(),
    prisma.currency.findMany({
      where:   { isActive: true },
      include: { denominationCategories: { where: { active: true } } },
      orderBy: { code: 'asc' },
    }),
  ])

  // JSON.parse(JSON.stringify(...)) convertit les Dates en strings pour le Client Component
  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">⊙ Session de caisse</h1>
        <p className="page-subtitle">
          {currentSession
            ? `Session ${currentSession.sessionNo} en cours — gérez votre poste`
            : 'Aucune session ouverte — ouvrez votre poste pour commencer'}
        </p>
      </div>

      <CashSessionPanel
        user={{ id: user.id, name: user.name, role: user.role }}
        currentSession={currentSession ? JSON.parse(JSON.stringify(currentSession)) : null}
        lastClosed={lastClosed      ? JSON.parse(JSON.stringify(lastClosed))      : null}
        currencies={JSON.parse(JSON.stringify(currencies))}
      />
    </div>
  )
}
