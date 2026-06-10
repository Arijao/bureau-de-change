/**
 * Script de diagnostic de l'écart entre stock physique et solde comptable
 * 
 * Usage : npx tsx scripts/diagnose-cash-vs-balance.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Diagnostic écart Dashboard vs Balance...\n')
  console.log('='.repeat(70))

  // ═══════════════════════════════════════════════════════════
  // 1. STOCK PHYSIQUE
  // ═══════════════════════════════════════════════════════════
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  console.log('\n💰 STOCK PHYSIQUE (Dashboard)')
  console.log(`   Montant : ${mgaStock!.amount.toLocaleString()} Ar`)

  // ═══════════════════════════════════════════════════════════
  // 2. SOLDE COMPTABLE
  // ═══════════════════════════════════════════════════════════
  const mgaAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '530000' },
  })

  const aggregates = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaAccount!.id },
    _sum: { debit: true, credit: true },
  })

  const totalDebit = aggregates._sum.debit ?? 0
  const totalCredit = aggregates._sum.credit ?? 0
  const accountingBalance = totalDebit - totalCredit

  console.log('\n📒 SOLDE COMPTABLE (Balance)')
  console.log(`   Débit total : ${totalDebit.toLocaleString()} Ar`)
  console.log(`   Crédit total : ${totalCredit.toLocaleString()} Ar`)
  console.log(`   Solde : ${accountingBalance.toLocaleString()} Ar`)

  // ═══════════════════════════════════════════════════════════
  // 3. ÉCART
  // ═══════════════════════════════════════════════════════════
  const discrepancy = mgaStock!.amount - accountingBalance
  console.log('\n⚖️  ÉCART')
  console.log(`   Dashboard - Balance = ${discrepancy.toLocaleString()} Ar`)
  console.log(`   ${discrepancy < 0 ? 'Stock < Comptabilité (sorties non comptabilisées)' : 'Stock > Comptabilité (écritures sans mouvement physique)'}`)

  // ═══════════════════════════════════════════════════════════
  // 4. MOUVEMENTS DE STOCK (CashStock logs)
  // ═══════════════════════════════════════════════════════════
  console.log('\n📋 MOUVEMENTS DE STOCK (CashStock logs)')
  
  const stockLogs = await prisma.stockLog.findMany({
    where: { stockId: mgaStock!.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  })

  let totalStockRetraits = 0
  let totalStockAjouts = 0
  
  stockLogs.forEach(log => {
    if (log.operation === 'RETRAIT') totalStockRetraits += Math.abs(log.delta)
    if (log.operation === 'AJOUT') totalStockAjouts += log.delta
  })

  console.log(`   Total retraits : ${totalStockRetraits.toLocaleString()} Ar`)
  console.log(`   Total ajouts : ${totalStockAjouts.toLocaleString()} Ar`)
  console.log(`   Nombre de mouvements : ${stockLogs.length}`)

  console.log('\n   Derniers mouvements :')
  stockLogs.slice(0, 15).forEach(log => {
    const date = new Date(log.createdAt).toLocaleString('fr-FR')
    const type = log.operation === 'RETRAIT' ? '🔴' : '🟢'
    console.log(`   ${type} ${date} | ${log.operation} | ${log.delta.toLocaleString()} Ar | ${log.note || '—'}`)
  })

  // ═══════════════════════════════════════════════════════════
  // 5. ÉCRITURES COMPTABLES SUR 530000
  // ═══════════════════════════════════════════════════════════
  console.log('\n📋 ÉCRITURES COMPTABLES (crédit 530000)')
  
  const entries = await prisma.journalEntry.findMany({
    where: {
      lines: {
        some: {
          accountId: mgaAccount!.id,
        },
      },
    },
    include: {
      lines: {
        where: { accountId: mgaAccount!.id },
        include: { account: true },
      },
    },
    orderBy: { date: 'desc' },
    take: 30,
  })

  console.log(`   Nombre d'écritures : ${entries.length}`)
  console.log('\n   Dernières écritures :')
  entries.slice(0, 15).forEach(entry => {
    const line = entry.lines.find(l => l.accountId === mgaAccount!.id)
    if (line) {
      const type = line.credit > 0 ? '🔴' : '🟢'
      const amount = line.credit > 0 ? -line.credit : line.debit
      const date = new Date(entry.date).toLocaleString('fr-FR')
      console.log(`   ${type} ${date} | ${entry.reference || '—'} | ${amount.toLocaleString()} Ar | ${entry.description}`)
    }
  })

  // ═══════════════════════════════════════════════════════════
  // 6. ANALYSE PAR TYPE D'OPÉRATION
  // ═══════════════════════════════════════════════════════════
  console.log('\n📊 ANALYSE PAR TYPE D\'OPÉRATION')
  
  // Avances approuvées
  const approvedAdvances = await prisma.advance.findMany({
    where: { status: 'APPROVED' },
    include: { employee: true },
  })
  const totalAdvances = approvedAdvances.reduce((sum, a) => sum + a.amount, 0)
  console.log(`\n   💰 Avances approuvées : ${approvedAdvances.length} (${totalAdvances.toLocaleString()} Ar)`)
  
  for (const adv of approvedAdvances) {
    const entry = await prisma.journalEntry.findFirst({
      where: { reference: `ADV-${adv.id}` },
    })
    const status = entry ? '✅' : '❌'
    console.log(`      ${status} ADV-${adv.id} - ${adv.employee.firstName} ${adv.employee.lastName} - ${adv.amount.toLocaleString()} Ar`)
  }

  // Salaires payés
  const paidSalaries = await prisma.salary.findMany({
    where: { paidAt: { not: null } },
    include: { employee: true },
    orderBy: { paidAt: 'desc' },
  })
  const totalSalaries = paidSalaries.reduce((sum, s) => sum + s.netSalary, 0)
  console.log(`\n   💼 Salaires payés : ${paidSalaries.length} (${totalSalaries.toLocaleString()} Ar net)`)
  
  for (const sal of paidSalaries) {
    const entry = await prisma.journalEntry.findFirst({
      where: { reference: `SAL-${sal.id}` },
    })
    const status = entry ? '✅' : '❌'
    console.log(`      ${status} SAL-${sal.id} - ${sal.employee.firstName} ${sal.employee.lastName} - Net: ${sal.netSalary.toLocaleString()} Ar`)
  }

  // Dépenses
  const expenses = await prisma.expense.findMany({
    orderBy: { date: 'desc' },
    include: { account: true },
  })
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0)
  console.log(`\n   💸 Dépenses : ${expenses.length} (${totalExpenses.toLocaleString()} Ar)`)
  
  for (const exp of expenses) {
    const entry = await prisma.journalEntry.findFirst({
      where: { reference: `DEP-${exp.id}` },
    })
    const status = entry ? '✅' : '❌'
    console.log(`      ${status} DEP-${exp.id} - ${exp.category} - ${exp.amount.toLocaleString()} Ar - ${exp.description}`)
  }

  // Versements CNaPS
  const cnapsEntries = await prisma.journalEntry.findMany({
    where: { reference: { startsWith: 'CNAPS-' } },
  })
  console.log(`\n   🏛️ Versements CNaPS : ${cnapsEntries.length}`)
  for (const entry of cnapsEntries) {
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: entry.id },
    })
    const creditLine = lines.find(l => l.accountId === mgaAccount!.id && l.credit > 0)
    console.log(`      ✅ ${entry.reference} - ${entry.description} - ${creditLine?.credit.toLocaleString() || '?'} Ar`)
  }

  // ═══════════════════════════════════════════════════════════
  // 7. VÉRIFICATION DES ÉCRITURES DÉSEQUILIBRÉES
  // ═══════════════════════════════════════════════════════════
  console.log('\n⚠️  VÉRIFICATION DES ÉCRITURES DÉSEQUILIBRÉES')
  
  const allEntries = await prisma.journalEntry.findMany({
    include: { lines: true },
  })
  
  let unbalancedCount = 0
  allEntries.forEach(entry => {
    const totalDebit = entry.lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = entry.lines.reduce((sum, l) => sum + l.credit, 0)
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      unbalancedCount++
      console.log(`   ❌ ${entry.reference || 'N/A'} - Débit: ${totalDebit}, Crédit: ${totalCredit}, Écart: ${totalDebit - totalCredit}`)
    }
  })
  
  if (unbalancedCount === 0) {
    console.log('   ✅ Toutes les écritures sont équilibrées')
  } else {
    console.log(`   ❌ ${unbalancedCount} écriture(s) déséquilibrée(s)`)
  }

  // ═══════════════════════════════════════════════════════════
  // 8. RÉSUMÉ
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(70))
  console.log('📊 RÉSUMÉ FINAL')
  console.log('='.repeat(70))
  console.log(`Stock physique : ${mgaStock!.amount.toLocaleString()} Ar`)
  console.log(`Solde comptable : ${accountingBalance.toLocaleString()} Ar`)
  console.log(`Écart : ${discrepancy.toLocaleString()} Ar`)
  console.log('='.repeat(70))

  if (Math.abs(discrepancy) < 0.01) {
    console.log('\n✅ Aucune incohérence détectée')
  } else {
    console.log(`\n⚠️  Incohérence de ${Math.abs(discrepancy).toLocaleString()} Ar détectée`)
    console.log('   Voir les détails ci-dessus pour identifier la cause.')
  }
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })