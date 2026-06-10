/**
 * Script de diagnostic comptable
 * 
 * Usage : npx tsx scripts/diagnostic-accounting.ts
 * 
 * Ce script vérifie la cohérence entre :
 * - CashStock (stock réel en caisse)
 * - Transactions (historique des opérations)
 * - JournalEntry (écritures comptables)
 * - StockLog (mouvements de stock)
 * 
 * Il identifie les écarts et propose des corrections.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

interface DiagnosticResult {
  cashStock: {
    currency: string
    amount: number
  }[]
  accountingBalance: {
    accountCode: string
    accountName: string
    debit: number
    credit: number
    balance: number
  }[]
  discrepancies: {
    type: string
    currency: string
    cashStock: number
    accountingBalance: number
    difference: number
  }[]
  orphanedTransactions: {
    receiptNo: string
    type: string
    amount: number
    createdAt: Date  // ✅ CORRIGÉ : createdAt au lieu de date
  }[]
  orphanedEntries: {
    reference: string | null  // ✅ CORRIGÉ : accepter null
    date: Date
    description: string
  }[]
  stockLogIssues: {
    transactionId: string
    receiptNo: string
    issue: string
  }[]
}

async function runDiagnostic(): Promise<DiagnosticResult> {
  console.log('🔍 Démarrage du diagnostic comptable...\n')

  const result: DiagnosticResult = {
    cashStock: [],
    accountingBalance: [],
    discrepancies: [],
    orphanedTransactions: [],
    orphanedEntries: [],
    stockLogIssues: [],
  }

  // ══════════════════════════════════════════════════════════
  // 1. RÉCUPÉRER TOUS LES STOCKS ACTUELS
  // ═══════════════════════════════════════════════════════════
  console.log('📦 Analyse des stocks en caisse...')
  const cashStocks = await prisma.cashStock.findMany({
    include: { currency: true },
  })

  result.cashStock = cashStocks.map(cs => ({
    currency: cs.currency.code,
    amount: cs.amount,
  }))

  console.log(`   ✓ ${cashStocks.length} devise(s) en caisse\n`)

  // ═══════════════════════════════════════════════════════════
  // 2. CALCULER LES SOLDES COMPTABLES
  // ═══════════════════════════════════════════════════════════
  console.log('📒 Analyse des soldes comptables...')
  const accounts = await prisma.ledgerAccount.findMany({
    where: { active: true },
    orderBy: { code: 'asc' },
  })

  for (const account of accounts) {
    const aggregates = await prisma.journalEntryLine.aggregate({
      where: { accountId: account.id },
      _sum: { debit: true, credit: true },
    })

    const debit = aggregates._sum.debit ?? 0
    const credit = aggregates._sum.credit ?? 0

    result.accountingBalance.push({
      accountCode: account.code,
      accountName: account.name,
      debit,
      credit,
      balance: debit - credit,
    })
  }

  console.log(`   ✓ ${accounts.length} compte(s) analysé(s)\n`)

  // ═══════════════════════════════════════════════════════════
  // 3. COMPARER STOCKS vs SOLDES COMPTABLES (pour les comptes de caisse)
  // ═══════════════════════════════════════════════════════════
  console.log('⚖️  Comparaison Stock vs Comptabilité...')
  const cashAccounts = result.accountingBalance.filter(a => 
    a.accountCode.startsWith('53') // Comptes de caisse
  )

  for (const cashAccount of cashAccounts) {
    // Trouver le stock correspondant
    const stock = result.cashStock.find(cs => {
      // Mapping: 530000 = MGA, 531xxx = devises étrangères
      if (cashAccount.accountCode === '530000') {
        return cs.currency === 'MGA'
      }
      // Pour les comptes 531xxx, extraire l'ID de la devise
      const currencyId = parseInt(cashAccount.accountCode.substring(3))
      const currency = cashStocks.find(cs => cs.currency.id === currencyId)
      return currency && cs.currency === currency.currency.code
    })

    if (stock) {
      const difference = stock.amount - cashAccount.balance
      if (Math.abs(difference) > 0.01) {
        result.discrepancies.push({
          type: 'CASH_STOCK_MISMATCH',
          currency: stock.currency,
          cashStock: stock.amount,
          accountingBalance: cashAccount.balance,
          difference,
        })
        console.log(`   ️  ${stock.currency} : Stock=${stock.amount.toFixed(2)} | Compta=${cashAccount.balance.toFixed(2)} | Écart=${difference.toFixed(2)}`)
      } else {
        console.log(`   ✓ ${stock.currency} : Cohérent (${stock.amount.toFixed(2)} Ar)`)
      }
    }
  }

  if (result.discrepancies.length === 0) {
    console.log('   ✓ Aucune divergence détectée')
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════
  // 4. VÉRIFIER LES TRANSACTIONS ORPHELINES (sans écriture comptable)
  // ═══════════════════════════════════════════════════════════
  console.log('🔗 Vérification des transactions sans écriture comptable...')
  const transactionsWithoutEntry = await prisma.transaction.findMany({
    where: {
      deletedAt: null,
      journalEntry: null,
    },
    select: {
      receiptNo: true,
      type: true,
      amount: true,
      createdAt: true,  // ✅ CORRIGÉ : createdAt au lieu de date
    },
    orderBy: { createdAt: 'asc' },
  })

  result.orphanedTransactions = transactionsWithoutEntry
  if (transactionsWithoutEntry.length > 0) {
    console.log(`   ⚠️  ${transactionsWithoutEntry.length} transaction(s) sans écriture comptable :`)
    transactionsWithoutEntry.forEach(tx => {
      console.log(`      - ${tx.receiptNo} (${tx.type} ${tx.amount})`)
    })
  } else {
    console.log('   ✓ Toutes les transactions ont une écriture comptable')
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════
  // 5. VÉRIFIER LES ÉCRITURES ORPHELINES (sans transaction)
  // ═══════════════════════════════════════════════════════════
  console.log('🔗 Vérification des écritures sans transaction...')
  const entriesWithoutTransaction = await prisma.journalEntry.findMany({
    where: {
      transactionId: null,
    },
    select: {
      reference: true,
      date: true,
      description: true,
    },
    orderBy: { date: 'asc' },
  })

  result.orphanedEntries = entriesWithoutTransaction
  if (entriesWithoutTransaction.length > 0) {
    console.log(`   ℹ️  ${entriesWithoutTransaction.length} écriture(s) sans transaction liée (écritures d'ouverture ou manuelles) :`)
    entriesWithoutTransaction.forEach(entry => {
      console.log(`      - ${entry.reference || 'N/A'} : ${entry.description}`)
    })
  } else {
    console.log('   ✓ Toutes les écritures sont liées à une transaction')
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════
  // 6. VÉRIFIER LES STOCKLOGS ORPHELINS
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Vérification des StockLogs...')
  const stockLogs = await prisma.stockLog.findMany({
    where: {
      transactionId: { not: null },
    },
    include: {
      transaction: true,
    },
  })

  const orphanedLogs = stockLogs.filter(log => !log.transaction)
  if (orphanedLogs.length > 0) {
    console.log(`   ⚠️  ${orphanedLogs.length} StockLog(s) avec transactionId invalide`)
    orphanedLogs.forEach(log => {
      result.stockLogIssues.push({
        transactionId: log.transactionId!,
        receiptNo: 'N/A',
        issue: `StockLog ID ${log.id} référence une transaction inexistante`,
      })
    })
  } else {
    console.log('   ✓ Tous les StockLogs sont valides')
  }
  console.log('')

  // ═══════════════════════════════════════════════════════════
  // 7. VÉRIFIER L'ÉQUILIBRE COMPTABLE GLOBAL
  // ══════════════════════════════════════════════════════════
  console.log('️  Vérification de l\'équilibre comptable global...')
  const globalAggregates = await prisma.journalEntryLine.aggregate({
    _sum: { debit: true, credit: true },
  })

  const totalDebit = globalAggregates._sum.debit ?? 0
  const totalCredit = globalAggregates._sum.credit ?? 0
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  console.log(`   Total Débit : ${totalDebit.toFixed(2)} Ar`)
  console.log(`   Total Crédit : ${totalCredit.toFixed(2)} Ar`)
  console.log(`   Écart : ${(totalDebit - totalCredit).toFixed(2)} Ar`)
  console.log(`   Statut : ${isBalanced ? '✓ ÉQUILIBRÉ' : ' DÉSÉQUILIBRÉ'}\n`)

  // ═══════════════════════════════════════════════════════════
  // 8. RÉSUMÉ ET RECOMMANDATIONS
  // ═══════════════════════════════════════════════════════════
  console.log('═'.repeat(70))
  console.log(' RÉSUMÉ DU DIAGNOSTIC')
  console.log('═'.repeat(70))
  console.log(`Stocks en caisse : ${result.cashStock.length} devise(s)`)
  console.log(`Comptes comptables : ${result.accountingBalance.length} compte(s)`)
  console.log(`Divergences Stock/Compta : ${result.discrepancies.length}`)
  console.log(`Transactions sans écriture : ${result.orphanedTransactions.length}`)
  console.log(`Écritures sans transaction : ${result.orphanedEntries.length}`)
  console.log(`StockLogs invalides : ${result.stockLogIssues.length}`)
  console.log(`Équilibre comptable : ${isBalanced ? '✓ OK' : '✗ PROBLÈME'}`)
  console.log('═'.repeat(70))
  console.log('')

  // Recommandations
  if (result.discrepancies.length > 0 || result.orphanedTransactions.length > 0) {
    console.log('🔧 RECOMMANDATIONS :')
    console.log('')
    
    if (result.discrepancies.length > 0) {
      console.log('1. CRÉER UNE ÉCRITURE D\'OUVERTURE')
      console.log('   Pour corriger les écarts entre stock réel et solde comptable.')
      console.log('   Écarts détectés :')
      result.discrepancies.forEach(d => {
        console.log(`   - ${d.currency} : ${d.difference.toFixed(2)} Ar`)
      })
      console.log('')
    }

    if (result.orphanedTransactions.length > 0) {
      console.log('2. GÉNÉRER LES ÉCRITURES MANQUANTES')
      console.log(`   ${result.orphanedTransactions.length} transaction(s) nécessitent une écriture comptable.`)
      console.log('   Exécutez : npx tsx scripts/generate-accounting-entries.ts')
      console.log('')
    }
  } else {
    console.log('✅ AUCUNE ACTION CORRECTIVE NÉCESSAIRE')
    console.log('   La base de données est cohérente.')
  }

  return result
}

// Exécution
runDiagnostic()
  .catch((e) => {
    console.error('❌ Erreur lors du diagnostic :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })