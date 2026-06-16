import { Suspense } from 'react'
import Link from 'next/link'          // ← AJOUT (manquait dans cette page)
import { getSessionUser } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { getExpenses } from '@/services/charges.service'
import { prisma } from '@/lib/prisma'
import ExpenseForm from '@/components/charges/ExpenseForm'
import ExpenseTable from '@/components/charges/ExpenseTable'

export const dynamic = 'force-dynamic'

export default async function ExpensesPage() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') redirect('/dashboard')

  const [expenses, accounts] = await Promise.all([
    getExpenses(),
    prisma.ledgerAccount.findMany({
      where: {
        type: 'EXPENSE',   // ← inchangé : correct, c'est le seed qui manque
        active: true,
      },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          {/* ← AJOUT bouton Retour */}
          <Link
            href="/charges"
            className="btn btn-outline btn-sm"
            style={{ marginBottom: '10px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            ← Retour Charges
          </Link>
          <h1 className="page-title">💸 Dépenses d'exploitation</h1>
          <p className="page-subtitle">Saisie et suivi des charges courantes</p>
        </div>
      </div>

      <ExpenseForm accounts={accounts} />

      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <ExpenseTable expenses={expenses} />
      </Suspense>
    </div>
  )
}