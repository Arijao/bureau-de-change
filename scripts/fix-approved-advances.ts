/**
 * Script de correction pour les avances déjà approuvées
 * 
 * Usage : npx tsx scripts/fix-approved-advances.ts
 * 
 * Ce script :
 * 1. Identifie les avances approuvées sans écriture comptable
 * 2. Génère les écritures comptables manquantes
 * 3. Met à jour le stock de caisse MGA
 */

import { PrismaClient } from '@prisma/client'
import { createAdvanceAccountingEntry } from '@/services/hr.service'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Correction des avances approuvées...\n')

  // Récupérer toutes les avances approuvées
  const approvedAdvances = await prisma.advance.findMany({
    where: { status: 'APPROVED' },
    include: { employee: true },
    orderBy: { date: 'asc' },
  })

  console.log(`📊 ${approvedAdvances.length} avance(s) approuvée(s) trouvée(s)\n`)

  let correctedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const advance of approvedAdvances) {
    try {
      // Vérifier si une écriture comptable existe déjà
      const existingEntry = await prisma.journalEntry.findFirst({
        where: {
          description: { 
            contains: `Avance sur salaire - ${advance.employee.firstName} ${advance.employee.lastName}` 
          },
        },
      })

      if (existingEntry) {
        console.log(`⏭️  ${advance.employee.firstName} ${advance.employee.lastName} (${advance.amount.toLocaleString()} Ar) — Déjà comptabilisée`)
        skippedCount++
        continue
      }

      // Générer l'écriture comptable et mettre à jour la caisse
      await createAdvanceAccountingEntry(advance.id, prisma)
      
      console.log(`✅ ${advance.employee.firstName} ${advance.employee.lastName} (${advance.amount.toLocaleString()} Ar) — Écriture générée`)
      correctedCount++
    } catch (error: any) {
      console.error(`❌ ${advance.employee.firstName} ${advance.employee.lastName} (${advance.amount.toLocaleString()} Ar) — Erreur : ${error.message}`)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📈 Résumé :')
  console.log(`   ✅ Corrigées : ${correctedCount}`)
  console.log(`   ⏭️  Déjà traitées : ${skippedCount}`)
  console.log(`   ❌ Erreurs : ${errorCount}`)
  console.log('='.repeat(70))

  // Afficher le solde du compte 425000
  const advanceAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '425000' },
    include: {
      journalLines: {
        select: { debit: true, credit: true },
      },
    },
  })

  if (advanceAccount) {
    const totalDebit = advanceAccount.journalLines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = advanceAccount.journalLines.reduce((sum, line) => sum + line.credit, 0)
    const balance = totalDebit - totalCredit

    console.log(`\n💰 Compte 425000 (Avances sur salaire) :`)
    console.log(`   Débit total : ${totalDebit.toLocaleString()} Ar`)
    console.log(`   Crédit total : ${totalCredit.toLocaleString()} Ar`)
    console.log(`   Solde : ${balance.toLocaleString()} Ar`)
  }

  // Afficher le nouveau stock MGA
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  console.log(`\n💵 Stock MGA actuel : ${mgaStock!.amount.toLocaleString()} Ar`)
  console.log('\n✅ Correction terminée !')
}

main()
  .catch((e) => {
    console.error('❌ Erreur fatale :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })