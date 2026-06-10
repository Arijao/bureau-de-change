/**
 * Script de vérification des écritures déséquilibrées
 * 
 * Usage : npx tsx scripts/check-unbalanced-entries.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Vérification des écritures comptables...\n')

  const entries = await prisma.journalEntry.findMany({
    include: {
      lines: {
        select: { debit: true, credit: true },
      },
    },
    orderBy: { date: 'desc' },
  })

  let unbalancedCount = 0
  let totalDifference = 0

  entries.forEach(entry => {
    const totalDebit = entry.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = entry.lines.reduce((sum, line) => sum + line.credit, 0)
    const difference = totalDebit - totalCredit

    if (Math.abs(difference) > 0.01) {
      unbalancedCount++
      totalDifference += difference

      console.log(`❌ Écriture déséquilibrée :`)
      console.log(`   ID : ${entry.id}`)
      console.log(`   Référence : ${entry.reference || 'N/A'}`)
      console.log(`   Description : ${entry.description}`)
      console.log(`   Date : ${entry.date.toLocaleDateString('fr-FR')}`)
      console.log(`   Débit : ${totalDebit.toLocaleString()} Ar`)
      console.log(`   Crédit : ${totalCredit.toLocaleString()} Ar`)
      console.log(`   Écart : ${difference.toLocaleString()} Ar\n`)
    }
  })

  console.log('='.repeat(70))
  console.log(`📊 Résumé :`)
  console.log(`   Total écritures : ${entries.length}`)
  console.log(`   Écritures équilibrées : ${entries.length - unbalancedCount}`)
  console.log(`   Écritures déséquilibrées : ${unbalancedCount}`)
  console.log(`   Écart total : ${totalDifference.toLocaleString()} Ar`)
  console.log('='.repeat(70))

  if (unbalancedCount === 0) {
    console.log('\n✅ Toutes les écritures sont équilibrées !')
  } else {
    console.log('\n⚠️  Des écritures déséquilibrées ont été détectées.')
    console.log('   Elles doivent être corrigées manuellement.')
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