/**
 * Service de gestion des charges
 * 
 * Gère les dépenses d'exploitation et les cotisations sociales (CNaPS)
 */

import { prisma } from '@/lib/prisma'
import { Expense as PrismaExpense, LedgerAccount } from '@prisma/client'

// Type étendu avec la relation account
export type Expense = PrismaExpense & {
  account: LedgerAccount
}

// ═══════════════════════════════════════════════════════════
// ── DÉPENSES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function createExpense(data: {
  date: Date
  amount: number
  accountId: number
  category: string
  supplier?: string
  description: string
  reference?: string
  period?: string
  note?: string
  cashSessionId?: string   // ← AJOUT (nullable — pas de garde bloquante sur Expense)
}): Promise<Expense> {
  return prisma.expense.create({
    data: {
       ...data,
       cashSessionId: data.cashSessionId ?? null,   // ← AJOUT
     },
    include: { account: true },
  })
}

export async function getExpenses(filters?: {
  category?: string
  dateFrom?: Date
  dateTo?: Date
}): Promise<Expense[]> {
  const where: any = {}

  if (filters?.category) {
    where.category = filters.category
  }

  if (filters?.dateFrom || filters?.dateTo) {
    where.date = {}
    if (filters.dateFrom) where.date.gte = filters.dateFrom
    if (filters.dateTo) where.date.lte = filters.dateTo
  }

  return prisma.expense.findMany({
    where,
    include: { account: true },
    orderBy: { date: 'desc' },
  })
}

export async function getExpenseById(id: number): Promise<Expense | null> {
  return prisma.expense.findUnique({
    where: { id },
    include: { account: true },
  })
}

export async function updateExpense(
  id: number,
  data: Partial<{
    date: Date
    amount: number
    accountId: number
    category: string
    supplier: string
    description: string
    reference: string
    period: string
    note: string
  }>
): Promise<Expense> {
  return prisma.expense.update({
    where: { id },
    data,
    include: { account: true },
  })
}

export async function deleteExpense(id: number): Promise<void> {
  await prisma.expense.delete({ where: { id } })
}

export async function getExpensesByCategory(
  year: number,
  month?: number
): Promise<Record<string, number>> {
  const where: any = {
    date: {
      gte: new Date(year, (month ?? 1) - 1, 1),
      lt: new Date(year, month ?? 12, 0, 23, 59, 59),
    },
  }

  const expenses = await prisma.expense.findMany({
    where,
    select: {
      category: true,
      amount: true,
    },
  })

  return expenses.reduce((acc: Record<string, number>, expense) => {
    acc[expense.category] = (acc[expense.category] || 0) + expense.amount
    return acc
  }, {} as Record<string, number>)
}

// ═══════════════════════════════════════════════════════════
// ── CNAPS - Configuration et calcul ──────────────────────
// ═══════════════════════════════════════════════════════════

export async function getCnapsSettings() {
  let settings = await prisma.hrSettings.findFirst()

  if (!settings) {
    settings = await prisma.hrSettings.create({
      data: {
        cnapsEnabled: true,
        cnapsEmployeeRate: 0.01,
        cnapsEmployerRate: 0.13,
        cnapsCeiling: 6000000,
        ostieEnabled: false,
        ostieRate: 0.01,
      },
    })
  }

  return settings
}

export async function updateCnapsSettings(data: {
  cnapsEnabled: boolean
  cnapsEmployeeRate: number
  cnapsEmployerRate: number
  cnapsCeiling: number
  ostieEnabled: boolean
  ostieRate: number
}) {
  const settings = await getCnapsSettings()
  return prisma.hrSettings.update({
    where: { id: settings.id },
    data,
  })
}

/**
 * Calcule les cotisations CNaPS pour un salaire brut donné
 * 
 * Retourne { base: 0, employee: 0, employer: 0 } si CNaPS est désactivée
 */
export async function calculateCnaps(grossSalary: number): Promise<{
  base: number
  employee: number
  employer: number
}> {
  const settings = await getCnapsSettings()

  // VÉRIFICATION : Si CNaPS désactivée, retourner 0
  if (!settings.cnapsEnabled) {
    return { base: 0, employee: 0, employer: 0 }
  }

  // Appliquer le plafond
  const base = Math.min(grossSalary, settings.cnapsCeiling)

  // Calculer les cotisations
  const employee = base * settings.cnapsEmployeeRate
  const employer = base * settings.cnapsEmployerRate

  return { base, employee, employer }
}

/**
 * Génère les écritures comptables pour le paiement d'une dépense
 * 
 * Écriture :
 * - Débit : Compte de charge (6xxxxx)
 * - Crédit : 530000 (Caisse MGA)
 */
export async function createExpenseAccountingEntry(
  expenseId: number,
  prismaClient: typeof prisma
): Promise<void> {
  const expense = await prismaClient.expense.findUnique({
    where: { id: expenseId },
    include: { account: true },
  })

  if (!expense) {
    throw new Error('Dépense introuvable')
  }

  // Vérifier si une écriture existe déjà
  const existingEntry = await prismaClient.journalEntry.findFirst({
    where: {
      description: { contains: `Dépense - ${expense.description}` },
      reference: expense.reference || undefined,
    },
  })

  if (existingEntry) {
    throw new Error('Une écriture comptable existe déjà pour cette dépense')
  }

  // Auto-création du compte Caisse MGA si manquant
  const { ensureChartOfAccounts } = await import('@/services/accounting.service')
  await ensureChartOfAccounts()

  const mgaCashAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '530000' },
  })
  if (!mgaCashAccount) {
    throw new Error('Compte 530000 (Caisse MGA) introuvable après auto-création')
  }

  // Créer l'écriture comptable
  await prismaClient.journalEntry.create({
    data: {
      date: expense.date,
      description: `Dépense - ${expense.description}`,
      reference: expense.reference || `DEP-${expense.id}`,
      lines: {
        create: [
          {
            accountId: expense.accountId,
            debit: expense.amount,
            credit: 0,
            description: expense.description,
          },
          {
            accountId: mgaCashAccount.id,
            debit: 0,
            credit: expense.amount,
            description: `Paiement dépense: ${expense.description}`,
          },
        ],
      },
    },
  })

  // Récupérer la devise MGA
  const mgaCurrency = await prismaClient.currency.findUnique({
    where: { code: 'MGA' },
  })

  if (!mgaCurrency) {
    throw new Error('Devise MGA introuvable')
  }

  // Mettre à jour le stock de caisse
  const mgaStock = await prismaClient.cashStock.findUnique({
    where: { currencyId: mgaCurrency.id },
  })

  if (!mgaStock) {
    throw new Error('Stock MGA introuvable')
  }

  if (mgaStock.amount < expense.amount) {
    throw new Error(
      `Stock MGA insuffisant. Disponible: ${mgaStock.amount} Ar, Requis: ${expense.amount} Ar`
    )
  }

  await prismaClient.cashStock.update({
    where: { id: mgaStock.id },
    data: { amount: mgaStock.amount - expense.amount },
  })

  // Créer un log
  await prismaClient.stockLog.create({
    data: {
      stockId: mgaStock.id,
      operation: 'RETRAIT',
      delta: -expense.amount,
      balanceBefore: mgaStock.amount,
      balanceAfter: mgaStock.amount - expense.amount,
      note: `Dépense: ${expense.description} (${expense.category})`,
      transactionId: null,
    },
  })
}

/**
 * Génère les écritures comptables pour le versement CNaPS
 * 
 * Écriture :
 * - Débit : 424100 (CNaPS part salariale)
 * - Débit : 424200 (CNaPS part patronale)
 * - Crédit : 530000 (Caisse MGA)
 */
export async function createCnapsPaymentAccountingEntry(
  data: {
    amount: number
    employeePart: number
    employerPart: number
    period: string
  },
  prismaClient: typeof prisma
): Promise<void> {
  const { amount, employeePart, employerPart, period } = data

  // Auto-création des comptes RH et Caisse MGA si manquants
  const { ensureHrAccounts, ensureChartOfAccounts } = await import('@/services/accounting.service')
  await ensureChartOfAccounts()
  await ensureHrAccounts()

  const cnapsEmployeeAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '424100' },
  })
  const cnapsEmployerAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '424200' },
  })
  const mgaCashAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '530000' },
  })
  if (!cnapsEmployeeAccount || !cnapsEmployerAccount || !mgaCashAccount) {
    throw new Error('Comptes comptables CNaPS introuvables après auto-création')
  }

  await prismaClient.journalEntry.create({
    data: {
      date: new Date(),
      description: `Versement CNaPS - ${period}`,
      reference: `CNAPS-${period.replace(/\s/g, '-')}`,
      lines: {
        create: [
          {
            accountId: cnapsEmployeeAccount.id,
            debit: employeePart,
            credit: 0,
            description: 'CNaPS part salariale',
          },
          {
            accountId: cnapsEmployerAccount.id,
            debit: employerPart,
            credit: 0,
            description: 'CNaPS part patronale',
          },
          {
            accountId: mgaCashAccount.id,
            debit: 0,
            credit: amount,
            description: `Versement CNaPS ${period}`,
          },
        ],
      },
    },
  })

  // Récupérer la devise MGA
  const mgaCurrency = await prismaClient.currency.findUnique({
    where: { code: 'MGA' },
  })

  if (!mgaCurrency) {
    throw new Error('Devise MGA introuvable')
  }

  // Mettre à jour le stock de caisse
  const mgaStock = await prismaClient.cashStock.findUnique({
    where: { currencyId: mgaCurrency.id },
  })

  if (!mgaStock) {
    throw new Error('Stock MGA introuvable')
  }

  if (mgaStock.amount < amount) {
    throw new Error(
      `Stock MGA insuffisant. Disponible: ${mgaStock.amount} Ar, Requis: ${amount} Ar`
    )
  }

  await prismaClient.cashStock.update({
    where: { id: mgaStock.id },
    data: { amount: mgaStock.amount - amount },
  })
}

// ═══════════════════════════════════════════════════════════
// ── STATISTIQUES ET RAPPORTS ─────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getChargesDashboardStats(year: number, month: number) {
  const expensesByCategory = await getExpensesByCategory(year, month)

  const totalExpenses = Object.values(expensesByCategory).reduce(
    (sum, amount) => sum + amount,
    0
  )

  // Récupérer les dettes CNaPS
  const cnapsEmployeeAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '424100' },
    include: {
      journalLines: {
        select: { debit: true, credit: true },
      },
    },
  })

  const cnapsEmployerAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '424200' },
    include: {
      journalLines: {
        select: { debit: true, credit: true },
    },
    },
  })

  const cnapsEmployeeDebt = cnapsEmployeeAccount
    ? cnapsEmployeeAccount.journalLines.reduce(
        (sum: number, line: { debit: number; credit: number }) => sum + line.credit - line.debit,
        0
      )
    : 0

  const cnapsEmployerDebt = cnapsEmployerAccount
    ? cnapsEmployerAccount.journalLines.reduce(
        (sum: number, line: { debit: number; credit: number }) => sum + line.credit - line.debit,
        0
      )
    : 0

  return {
    totalExpenses,
    expensesByCategory,
    cnapsDebt: cnapsEmployeeDebt + cnapsEmployerDebt,
    cnapsEmployeeDebt,
    cnapsEmployerDebt,
  }
}