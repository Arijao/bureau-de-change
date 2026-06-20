// app/(dashboard)/caisse/page.tsx
// Server Component — charge les données puis délègue au Client Component

import { getSessionUser }                        from '@/lib/auth'
import { redirect }                              from 'next/navigation'
import { getOpenSession, getLastClosedSession }  from '@/services/cash-session.service'
import { prisma }                                from '@/lib/prisma'
import CashSessionPanel                          from '@/components/caisse/CashSessionPanel'
import { CAISSIER_ALLOWED_CATEGORY_VALUES, CATEGORY_ACCOUNT_MAP } from '@/lib/expense-roles'

export const dynamic = 'force-dynamic'

export default async function CaissePage() {
  const user = await getSessionUser()
  if (!user) redirect('/login')

  const caissierAccountCodes = CAISSIER_ALLOWED_CATEGORY_VALUES.map(
    cat => CATEGORY_ACCOUNT_MAP[cat]
  )

  // Chargement séquentiel : session d'abord (son id est nécessaire pour filtrer)
  const currentSession = await getOpenSession(user.id)

  // Chargement parallèle des données restantes
  const [lastClosed, currencies, accounts, sessionExpenses, transactionCount] = await Promise.all([
    getLastClosedSession(),

    prisma.currency.findMany({
      where:   { isActive: true },
      include: { denominationCategories: { where: { active: true } } },
      orderBy: { code: 'asc' },
    }),

    prisma.ledgerAccount.findMany({
      where:   { type: 'EXPENSE', active: true, code: { in: caissierAccountCodes } },
      orderBy: { code: 'asc' },
    }),

    // Dépenses de la session en cours uniquement
    currentSession
      ? prisma.expense.findMany({
          where:   { cashSessionId: currentSession.id },
          include: { account: true },
          orderBy: { date: 'desc' },
        })
      : Promise.resolve([]),

    // [MOD-5] Comptage des transactions de la session — source de vérité fiable
    // Distinct de session._count qui peut être périmé si la session n'est pas rechargée
    currentSession
      ? prisma.transaction.count({
          where: { cashSessionId: currentSession.id, deletedAt: null },
        })
      : Promise.resolve(0),
  ])

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
        accounts={JSON.parse(JSON.stringify(accounts))}
        sessionExpenses={JSON.parse(JSON.stringify(sessionExpenses))}
        transactionCount={transactionCount}   // [MOD-5] comptage direct Prisma
      />
    </div>
  )
}