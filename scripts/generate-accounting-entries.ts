/**
 * Script pour générer les écritures comptables pour toutes les transactions existantes.
 * 
 * Usage : npx tsx scripts/generate-accounting-entries.ts
 */

import { PrismaClient } from '@prisma/client'
import { generateJournalEntryFromTransaction } from '@/services/accounting.service'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Génération des écritures comptables pour les transactions existantes...\n')

  const transactions = await prisma.transaction.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'asc' },
  })

  console.log(`📊 ${transactions.length} transaction(s) trouvée(s)\n`)

  let successCount = 0
  let skipCount = 0
  let errorCount = 0

  for (const tx of transactions) {
    try {
      const existingEntry = await prisma.journalEntry.findUnique({
        where: { transactionId: tx.id },
      })

      if (existingEntry) {
        console.log(`⏭️  ${tx.receiptNo} — Écriture déjà existante`)
        skipCount++
        continue
      }

      await generateJournalEntryFromTransaction(tx.id)
      console.log(`✅ ${tx.receiptNo} — Écriture générée`)
      successCount++
    } catch (error: any) {
      console.error(`❌ ${tx.receiptNo} — Erreur : ${error.message}`)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('📈 Résumé :')
  console.log(`   ✅ Succès : ${successCount}`)
  console.log(`   ⏭️  Ignorées : ${skipCount}`)
  console.log(`    Erreurs : ${errorCount}`)
  console.log('='.repeat(60))
}

main()
  .catch((e) => {
    console.error('❌ Erreur fatale :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })