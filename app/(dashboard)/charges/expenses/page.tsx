import { Suspense } from 'react'
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
        type: 'EXPENSE',
        active: true,
      },
      orderBy: { code: 'asc' },
    }),
  ])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">💸 Dépenses d'exploitation</h1>
          <p className="page-subtitle">
            Saisie et suivi des charges courantes
          </p>
        </div>
      </div>

      {/* Formulaire de saisie */}
      <ExpenseForm accounts={accounts} />

      {/* Tableau des dépenses */}
      <Suspense fallback={<div className="loading">Chargement...</div>}>
        <ExpenseTable expenses={expenses} />
      </Suspense>
    </div>
  )
}