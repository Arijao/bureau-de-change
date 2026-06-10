/**
 * Script de synchronisation du stock physique avec la balance comptable
 * 
 * Usage : npx tsx scripts/fix-stock-balance.ts
 * 
 * Met à jour CashStock.amount pour correspondre au solde du compte 530000.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Synchronisation Stock MGA vs Balance...\n')

  // 1. Calculer le solde comptable réel
  const mgaAccount = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
  
  const agg = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaAccount!.id },
    _sum: { debit: true, credit: true },
  })

  const accountingBalance = (agg._sum.debit ?? 0) - (agg._sum.credit ?? 0)
  console.log(`📒 Solde comptable (Balance) : ${accountingBalance.toLocaleString()} Ar`)

  // 2. Mettre à jour le stock physique
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  
  await prisma.cashStock.update({
    where: { currencyId: mgaCurrency!.id },
    data: { amount: accountingBalance },
  })

  console.log(`✅ Stock MGA mis à jour : ${accountingBalance.toLocaleString()} Ar`)
  console.log('\n🎉 Synchronisation terminée ! Rechargez le Dashboard.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })