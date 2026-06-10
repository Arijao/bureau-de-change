/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import type {
  AccountType,
  LedgerAccount,
  JournalEntry,
  JournalEntryLine,
  JournalFilters,
  LedgerFilters,
  AccountBalance,
  TrialBalanceResult,
} from '@/lib/types'

// Helper pour caster le type 'string' de Prisma vers 'AccountType'
const mapAccount = (account: any): LedgerAccount => ({
  ...account,
  type: account.type as AccountType,
})

// ═══════════════════════════════════════════════════════════
// ── CONFIGURATION DU PLAN COMPTABLE ─────────────────────
// ═══════════════════════════════════════════════════════════

const BASE_ACCOUNTS: Array<{
  code: string
  name: string
  type: AccountType
  description: string
}> = [
  { code: '530000', name: 'Caisse MGA', type: 'ASSET', description: 'Liquidités en Ariary' },
  { code: '706000', name: 'Revenus attestations', type: 'REVENUE', description: 'Revenus de vente d\'attestations de change' },
  { code: '707000', name: 'Commissions perçues', type: 'REVENUE', description: 'Revenus de commissions sur opérations de change' },
]

// ═══════════════════════════════════════════════════════════
// ── INITIALISATION DU PLAN COMPTABLE ────────────────────
// ═══════════════════════════════════════════════════════════

export async function ensureChartOfAccounts(): Promise<void> {
  for (const account of BASE_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findUnique({ where: { code: account.code } })
    if (!exists) {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description,
          active: true,
        },
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════
// ── COMPTES RH ET CHARGES ─────────────────────────────
// ═══════════════════════════════════════════════════════════

const HR_ACCOUNTS: Array<{
  code: string
  name: string
  type: AccountType
  description: string
}> = [
  { code: '641000', name: 'Charges de personnel', type: 'EXPENSE', description: 'Salaires et rémunérations' },
  { code: '645100', name: 'Charges sociales patronales', type: 'EXPENSE', description: 'Cotisations sociales employeur (CNaPS)' },
  { code: '424100', name: 'CNaPS part salariale', type: 'LIABILITY', description: 'Dettes CNaPS - Part salariale à payer' },
  { code: '424200', name: 'CNaPS part patronale', type: 'LIABILITY', description: 'Dettes CNaPS - Part patronale à payer' },
  { code: '425000', name: 'Avances sur salaire', type: 'ASSET', description: 'Avances accordées aux employés (créance sur le personnel)' },
]

const CHARGES_ACCOUNTS: Array<{
  code: string
  name: string
  type: AccountType
  description: string
}> = [
  { code: '613000', name: 'Locations', type: 'EXPENSE', description: 'Loyers et charges locatives' },
  { code: '615000', name: 'Entretien et réparations', type: 'EXPENSE', description: 'Maintenance et réparations' },
  { code: '616000', name: 'Primes d\'assurance', type: 'EXPENSE', description: 'Assurances' },
  { code: '625000', name: 'Déplacements et missions', type: 'EXPENSE', description: 'Frais de déplacement' },
  { code: '626000', name: 'Frais postaux et télécommunications', type: 'EXPENSE', description: 'Téléphone, internet' },
  { code: '627000', name: 'Services bancaires', type: 'EXPENSE', description: 'Frais bancaires' },
  { code: '628000', name: 'Divers', type: 'EXPENSE', description: 'Autres services' },
  { code: '651000', name: 'Fournitures non stockables', type: 'EXPENSE', description: 'Fournitures de bureau' },
  { code: '652000', name: 'Carburant', type: 'EXPENSE', description: 'Essence, diesel' },
  { code: '653000', name: 'Électricité', type: 'EXPENSE', description: 'Factures électricité' },
  { code: '654000', name: 'Eau', type: 'EXPENSE', description: 'Factures d\'eau' },
]

export async function ensureHrAccounts(): Promise<void> {
  for (const account of HR_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findUnique({ where: { code: account.code } })
    if (!exists) {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description,
          active: true,
        },
      })
      console.log(`[ensureHrAccounts] ✅ Compte ${account.code} créé automatiquement`)
    }
  }
}

export async function ensureChargesAccounts(): Promise<void> {
  for (const account of CHARGES_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findUnique({ where: { code: account.code } })
    if (!exists) {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description,
          active: true,
        },
      })
      console.log(`[ensureChargesAccounts] ✅ Compte ${account.code} créé automatiquement`)
    }
  }
}

export async function getOrCreateCashAccount(currencyCode: string): Promise<LedgerAccount> {
  if (currencyCode === 'MGA') {
    const account = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
    if (!account) {
      await ensureChartOfAccounts()
      const newAccount = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
      return mapAccount(newAccount)
    }
    return mapAccount(account)
  }

  const currency = await prisma.currency.findUnique({ where: { code: currencyCode } })
  if (!currency) throw new Error(`Devise ${currencyCode} introuvable`)

  const accountCode = `531${String(currency.id).padStart(3, '0')}`
  let account = await prisma.ledgerAccount.findUnique({ where: { code: accountCode } })

  if (!account) {
    account = await prisma.ledgerAccount.create({
      data: {
        code: accountCode,
        name: `Caisse ${currencyCode}`,
        type: 'ASSET',
        description: `Liquidités en ${currencyCode}`,
        active: true,
      },
    })
  }

  return mapAccount(account)
}

export async function getCommissionRevenueAccount(): Promise<LedgerAccount> {
  const account = await prisma.ledgerAccount.findUnique({ where: { code: '707000' } })
  if (!account) {
    await ensureChartOfAccounts()
    const newAccount = await prisma.ledgerAccount.findUnique({ where: { code: '707000' } })
    return mapAccount(newAccount)
  }
  return mapAccount(account)
}

export async function getChartOfAccounts(): Promise<LedgerAccount[]> {
  const accounts = await prisma.ledgerAccount.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
  })
  return accounts.map(mapAccount)
}

// ═══════════════════════════════════════════════════════════
// ── GÉNÉRATION D'ÉCRITURES COMPTABLES ───────────────────
// ═══════════════════════════════════════════════════════════

export async function generateJournalEntryFromTransaction(transactionId: string): Promise<JournalEntry> {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { currency: true, user: true },
  })

  if (!tx) throw new Error(`Transaction ${transactionId} introuvable`)
  if (tx.deletedAt) throw new Error(`Transaction ${transactionId} supprimée — écriture non générée`)

  const existingEntry = await prisma.journalEntry.findUnique({ where: { transactionId: tx.id } })
  if (existingEntry) throw new Error(`Une écriture comptable existe déjà pour la transaction ${tx.receiptNo}`)

  const mgaCashAccount = await getOrCreateCashAccount('MGA')
  const foreignCashAccount = await getOrCreateCashAccount(tx.currency.code)
  const commissionAccount = await getCommissionRevenueAccount()

  const fxValue = tx.amount * tx.rate
  const lines: Array<{ accountId: number; debit: number; credit: number; description: string }> = []

  if (tx.type === 'ACHAT') {
    lines.push({ accountId: foreignCashAccount.id, debit: fxValue, credit: 0, description: `Achat ${tx.amount} ${tx.currency.code} @ ${tx.rate}` })
    lines.push({ accountId: mgaCashAccount.id, debit: 0, credit: tx.totalMGA, description: `Contrepartie MGA payée au client` })
  } else {
    lines.push({ accountId: mgaCashAccount.id, debit: tx.totalMGA, credit: 0, description: `Vente ${tx.amount} ${tx.currency.code} @ ${tx.rate}` })
    lines.push({ accountId: foreignCashAccount.id, debit: 0, credit: fxValue, description: `Sortie devise de caisse` })
  }

  if (tx.commission > 0) {
    lines.push({ accountId: commissionAccount.id, debit: 0, credit: tx.commission, description: `Commission ${tx.type.toLowerCase()}` })
  }

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(`Erreur comptable : Débit (${totalDebit}) ≠ Crédit (${totalCredit}) pour ${tx.receiptNo}`)
  }

  return prisma.$transaction(async (client) => {
    const entry = await client.journalEntry.create({
      data: {
        date: tx.createdAt,
        description: `${tx.type} ${tx.amount} ${tx.currency.code} — ${tx.receiptNo}`,
        reference: tx.receiptNo,
        transactionId: tx.id,
        userId: tx.userId,
      },
    })

    for (const line of lines) {
      await client.journalEntryLine.create({
        data: {
          journalEntryId: entry.id,
          accountId: line.accountId,
          debit: line.debit,
          credit: line.credit,
          description: line.description,
        },
      })
    }
    return entry
  })
}

export async function deleteJournalEntryForTransaction(transactionId: string): Promise<void> {
  const entry = await prisma.journalEntry.findUnique({ where: { transactionId } })
  if (!entry) return
  await prisma.journalEntry.delete({ where: { id: entry.id } })
}

// ═══════════════════════════════════════════════════════════
// ── LECTURE COMPTABLE ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

// Remplacez la fonction getJournal actuelle par celle-ci
export async function getJournal(filters: JournalFilters = {}): Promise<{ 
  entries: any[]; 
  total: number;
  totals: { debit: number; credit: number; isBalanced: boolean } 
}> {
  const where: Record<string, any> = {}

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {}
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const d = new Date(filters.dateTo)
      d.setHours(23, 59, 59, 999)
      range.lte = d
    }
    where.date = range
  }

  if (filters.reference) where.reference = { contains: filters.reference }
  if (filters.accountId) {
    where.lines = { some: { accountId: filters.accountId } }
  }

  // 1. Récupérer les entrées (pagination)
  const [entries, total] = await Promise.all([
    prisma.journalEntry.findMany({
      where,
      include: {
        lines: { include: { account: true }, orderBy: { id: 'asc' } },
        transaction: { select: { receiptNo: true, type: true, amount: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
      take: filters.limit ?? 100,
      skip: filters.offset ?? 0,
    }),
    prisma.journalEntry.count({ where }),
  ])

  // 2. Calculer les totaux globaux pour la période filtrée (pas juste la page)
  const aggregates = await prisma.journalEntryLine.aggregate({
    _sum: { debit: true, credit: true },
    where: {
      journalEntry: where // Applique les mêmes filtres (dates, etc.)
    }
  })

  const totalDebit = aggregates._sum.debit ?? 0
  const totalCredit = aggregates._sum.credit ?? 0

  return { 
    entries, 
    total,
    totals: {
      debit: totalDebit,
      credit: totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01
    }
  }
}

export async function getLedger(
  accountId: number,
  filters: LedgerFilters = {}
): Promise<{
  account: LedgerAccount
  lines: Array<JournalEntryLine & { journalEntry: any }>
  totals: { debit: number; credit: number; balance: number }
}> {
  const accountRaw = await prisma.ledgerAccount.findUnique({ where: { id: accountId } })
  if (!accountRaw) throw new Error(`Compte ${accountId} introuvable`)
  
  const account = mapAccount(accountRaw)
  const where: Record<string, any> = { accountId }

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {}
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom)
    if (filters.dateTo) {
      const d = new Date(filters.dateTo)
      d.setHours(23, 59, 59, 999)
      range.lte = d
    }
    where.journalEntry = { date: range }
  }

  const lines = await prisma.journalEntryLine.findMany({
    where,
    include: { journalEntry: { include: { user: { select: { name: true } } } } },
    orderBy: { journalEntry: { date: 'desc' } },
    take: filters.limit ?? 500,
    skip: filters.offset ?? 0,
  })

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)

  return {
    account,
    lines,
    totals: { debit: totalDebit, credit: totalCredit, balance: totalDebit - totalCredit },
  }
}

export async function getTrialBalance(dateFrom?: string, dateTo?: string): Promise<TrialBalanceResult> {
  const from = dateFrom ? new Date(dateFrom) : new Date('2000-01-01')
  const to = dateTo ? new Date(dateTo) : new Date()
  to.setHours(23, 59, 59, 999)

  const accounts = await prisma.ledgerAccount.findMany({ where: { active: true }, orderBy: { code: 'asc' } })
  const balances: AccountBalance[] = []
  let totalDebit = 0
  let totalCredit = 0

  for (const account of accounts) {
    const result = await prisma.journalEntryLine.aggregate({
      where: { accountId: account.id, journalEntry: { date: { gte: from, lte: to } } },
      _sum: { debit: true, credit: true },
    })

    const accountDebit = result._sum.debit ?? 0
    const accountCredit = result._sum.credit ?? 0

    balances.push({
      accountId: account.id,
      code: account.code,
      name: account.name,
      type: account.type as AccountType,
      totalDebit: accountDebit,
      totalCredit: accountCredit,
      balance: accountDebit - accountCredit,
    })

    totalDebit += accountDebit
    totalCredit += accountCredit
  }

  return {
    from,
    to,
    accounts: balances,
    totals: {
      totalDebit,
      totalCredit,
      isBalanced: Math.abs(totalDebit - totalCredit) < 0.01,
    },
  }
}

export async function getJournalEntryById(id: number) {
  return prisma.journalEntry.findUnique({
    where: { id },
    include: {
      lines: { include: { account: true }, orderBy: { id: 'asc' } },
      transaction: { include: { currency: true } },
      user: { select: { name: true } },
    },
  })
}

export async function getAccountingStats(from: Date, to: Date) {
  const [totalEntries, totalLines, trialBalance] = await Promise.all([
    prisma.journalEntry.count({ where: { date: { gte: from, lte: to } } }),
    prisma.journalEntryLine.count({ where: { journalEntry: { date: { gte: from, lte: to } } } }),
    getTrialBalance(from.toISOString(), to.toISOString()),
  ])

  return {
    totalEntries,
    totalLines,
    isBalanced: trialBalance.totals.isBalanced,
    totalDebit: trialBalance.totals.totalDebit,
    totalCredit: trialBalance.totals.totalCredit,
  }
}