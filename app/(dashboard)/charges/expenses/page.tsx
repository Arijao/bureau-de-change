import { Suspense } from 'react'
import Link from 'next/link'          // ← AJOUT (manquait dans cette page)
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getExpenses } from '@/services/charges.service'
import { prisma } from '@/lib/prisma'
import ExpenseForm from '@/components/charges/ExpenseForm'
import ExpenseTable from '@/components/charges/ExpenseTable'
import { ensureDefaultLedgerAccounts } from '@/lib/ensure-defaults'
import { CAISSIER_ALLOWED_CATEGORY_VALUES, CATEGORY_ACCOUNT_MAP } from '@/lib/expense-roles'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const user = await getSessionUser()
  // CAISSIER autorisé, les autres rôles éventuels sont bloqués
  if (!user || (user.role !== 'ADMIN' && user.role !== 'CAISSIER')) {
    redirect('/dashboard')
  }

  await ensureDefaultLedgerAccounts()

  // Codes comptables accessibles au caissier
  const caissierAccountCodes = CAISSIER_ALLOWED_CATEGORY_VALUES.map(
    cat => CATEGORY_ACCOUNT_MAP[cat]
  )

  // Pour le caissier : récupérer sa session ouverte pour filtrer les dépenses
  let caissierSessionId: string | null = null
  if (user.role === 'CAISSIER') {
    try {
      const { assertOpenSession } = await import('@/services/cash-session.service')
      caissierSessionId = await assertOpenSession(user.id)
    } catch {
      // Pas de session ouverte — le caissier voit la page mais ne peut pas créer
    }
  }

  const [expenses, accounts] = await Promise.all([
    // CAISSIER : dépenses de sa session uniquement | ADMIN : toutes les dépenses
    user.role === 'CAISSIER'
      ? getExpenses(caissierSessionId ? { cashSessionId: caissierSessionId } : undefined)
      : getExpenses(),

    // CAISSIER : comptes restreints | ADMIN : tous les comptes de charges
    prisma.ledgerAccount.findMany({
      where: {
        type: 'EXPENSE',
        active: true,
        ...(user.role === 'CAISSIER' && { code: { in: caissierAccountCodes } }),
      },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <Link href={user.role === 'ADMIN' ? '/charges' : '/caisse'}
            className="btn btn-outline btn-sm"
            style={{ marginBottom: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            ← Retour {user.role === 'ADMIN' ? 'Charges' : 'Caisse'}
          </Link>
          <h1 className="page-title">💸 Dépenses d'exploitation</h1>
          <p className="page-subtitle">
            {user.role === 'CAISSIER'
              ? 'Dépenses opérationnelles de votre session'
              : 'Saisie et suivi des charges courantes'}
          </p>
        </div>
      </div>

      {user.role === 'CAISSIER' && !caissierSessionId && (
        <div className="alert alert-error">
          ⛔ Aucune session de caisse ouverte. Ouvrez une session pour enregistrer des dépenses.
        </div>
      )}

      <ExpenseForm
        accounts={accounts}
        userRole={user.role as 'ADMIN' | 'CAISSIER'}  // ← AJOUT
      />

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <ExpenseTable expenses={expenses} />
      </Suspense>
    </div>
  )
}