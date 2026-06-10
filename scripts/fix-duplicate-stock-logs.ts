/**
 * Script de suppression des logs de stock en double
 * 
 * Usage : npx tsx scripts/fix-duplicate-stock-logs.ts
 * 
 * Supprime les entrées dupliquées dans CashStockLog
 * pour les salaires de Narindra BEMOLOTRA et JeanBA RABE.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Correction des logs de stock en double...\n')

  // Récupérer tous les logs de retrait pour les salaires
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  // Trouver les logs en double pour Narindra BEMOLOTRA (742 500 Ar)
  const bemolotraLogs = await prisma.stockLog.findMany({
    where: {
      stockId: mgaStock!.id,
      operation: 'RETRAIT',
      delta: -742500,
      note: { contains: 'Narindra BEMOLOTRA' },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(` Logs Narindra BEMOLOTRA : ${bemolotraLogs.length}`)
  
  if (bemolotraLogs.length > 1) {
    // Supprimer tous sauf le premier
    const toDelete = bemolotraLogs.slice(1)
    for (const log of toDelete) {
      await prisma.stockLog.delete({ where: { id: log.id } })
      console.log(`   ❌ Supprimé log ID ${log.id} (${new Date(log.createdAt).toLocaleString('fr-FR')})`)
    }
    console.log(`   ✅ ${toDelete.length} log(s) en double supprimé(s)\n`)
  } else {
    console.log('   ✅ Aucun doublon détecté\n')
  }

  // Trouver les logs en double pour JeanBA RABE (475 200 Ar)
  const rabeLogs = await prisma.stockLog.findMany({
    where: {
      stockId: mgaStock!.id,
      operation: 'RETRAIT',
      delta: -475200,
      note: { contains: 'JeanBA RABE' },
    },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📋 Logs JeanBA RABE : ${rabeLogs.length}`)
  
  if (rabeLogs.length > 1) {
    const toDelete = rabeLogs.slice(1)
    for (const log of toDelete) {
      await prisma.stockLog.delete({ where: { id: log.id } })
      console.log(`    Supprimé log ID ${log.id} (${new Date(log.createdAt).toLocaleString('fr-FR')})`)
    }
    console.log(`   ✅ ${toDelete.length} log(s) en double supprimé(s)\n`)
  } else {
    console.log('   ✅ Aucun doublon détecté\n')
  }

  // Vérifier le nouveau stock
  const updatedStock = await prisma.cashStock.findUnique({
    where: { id: mgaStock!.id },
  })

  // Calculer le solde comptable
  const mgaAccount = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
  const aggregates = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaAccount!.id },
    _sum: { debit: true, credit: true },
  })
  const accountingBalance = (aggregates._sum.debit ?? 0) - (aggregates._sum.credit ?? 0)

  console.log(' État après correction :')
  console.log(`   Stock physique : ${updatedStock!.amount.toLocaleString()} Ar`)
  console.log(`   Solde comptable : ${accountingBalance.toLocaleString()} Ar`)
  console.log(`   Écart : ${(updatedStock!.amount - accountingBalance).toLocaleString()} Ar`)
  console.log(`   Statut : ${Math.abs(updatedStock!.amount - accountingBalance) < 0.01 ? '✅ COHÉRENT' : '⚠️  Écart persistant'}`)

  console.log('\n✅ Correction terminée !')
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })