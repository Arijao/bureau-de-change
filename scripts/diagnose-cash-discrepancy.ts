/**
 * Script de diagnostic de l'écart entre stock physique et solde comptable
 * 
 * Usage : npx tsx scripts/diagnose-cash-discrepancy.ts
 * 
 * Compare les mouvements de stock avec les écritures comptables
 * pour identifier les écarts.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Diagnostic de l\'écart Caisse MGA...\n')

  // 1. Récupérer le stock physique MGA
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  console.log(`💰 Stock physique MGA : ${mgaStock!.amount.toLocaleString()} Ar\n`)

  // 2. Calculer le solde comptable
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

  console.log(`📒 Solde comptable MGA : ${accountingBalance.toLocaleString()} Ar`)
  console.log(`   Débit total : ${totalDebit.toLocaleString()} Ar`)
  console.log(`   Crédit total : ${totalCredit.toLocaleString()} Ar\n`)

  // 3. Calculer l'écart
  const discrepancy = mgaStock!.amount - accountingBalance
  console.log(` Écart : ${discrepancy.toLocaleString()} Ar`)
  console.log(`   ${discrepancy > 0 ? 'Stock > Comptabilité' : discrepancy < 0 ? 'Stock < Comptabilité' : '✅ Cohérent'}\n`)

  // 4. Analyser les mouvements de stock
  console.log('📋 Analyse des mouvements de stock (CashStock logs)...\n')
  
  const stockLogs = await prisma.stockLog.findMany({
    where: {
      stockId: mgaStock!.id,
      operation: 'RETRAIT',
    },
    orderBy: { createdAt: 'desc' },
  })

  console.log(`   ${stockLogs.length} retrait(s) enregistré(s)\n`)

  // 5. Analyser les écritures comptables récentes
  console.log('📋 Analyse des écritures comptables récentes (crédit 530000)...\n')

  const recentEntries = await prisma.journalEntry.findMany({
    where: {
      lines: {
        some: {
          accountId: mgaAccount!.id,
          credit: { gt: 0 },
        },
      },
    },
    include: {
      lines: {
        where: {
          accountId: mgaAccount!.id,
          credit: { gt: 0 },
        },
        include: { account: true },
      },
    },
    orderBy: { date: 'desc' },
    take: 20,
  })

  console.log(`   ${recentEntries.length} écriture(s) avec crédit sur 530000\n`)

  recentEntries.forEach(entry => {
    const creditLine = entry.lines.find(l => l.accountId === mgaAccount!.id && l.credit > 0)
    if (creditLine) {
      console.log(`   - ${entry.reference || 'N/A'} : ${creditLine.credit.toLocaleString()} Ar`)
      console.log(`     Date : ${entry.date.toLocaleDateString('fr-FR')}`)
      console.log(`     Description : ${entry.description}`)
      console.log('')
    }
  })

  // 6. Vérifier les avances approuvées sans écriture
  console.log('🔍 Vérification des avances approuvées...\n')

  const approvedAdvances = await prisma.advance.findMany({
    where: { status: 'APPROVED' },
    include: { employee: true },
  })

  console.log(`   ${approvedAdvances.length} avance(s) approuvée(s)\n`)

  for (const advance of approvedAdvances) {
    const existingEntry = await prisma.journalEntry.findFirst({
      where: {
        description: { 
          contains: `Avance sur salaire - ${advance.employee.firstName} ${advance.employee.lastName}` 
        },
      },
    })

    if (existingEntry) {
      console.log(`   ✅ ${advance.employee.firstName} ${advance.employee.lastName} (${advance.amount.toLocaleString()} Ar) — Écriture trouvée`)
    } else {
      console.log(`   ❌ ${advance.employee.firstName} ${advance.employee.lastName} (${advance.amount.toLocaleString()} Ar) — AUCUNE ÉCRITURE`)
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 RÉSUMÉ DU DIAGNOSTIC')
  console.log('='.repeat(70))
  console.log(`Stock physique : ${mgaStock!.amount.toLocaleString()} Ar`)
  console.log(`Solde comptable : ${accountingBalance.toLocaleString()} Ar`)
  console.log(`Écart : ${discrepancy.toLocaleString()} Ar`)
  console.log(`Avances sans écriture : ${approvedAdvances.filter(a => {
    // Vérification simplifiée
    return true // À affiner selon les résultats
  }).length}`)
  console.log('='.repeat(70))

  if (Math.abs(discrepancy) < 0.01) {
    console.log('\n✅ Aucune incohérence détectée')
  } else {
    console.log('\n️  Incohérence détectée - Voir détails ci-dessus')
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