/**
 * Script de correction pour les salaires déjà payés
 * 
 * Usage : npx tsx scripts/fix-paid-salaries-stock.ts
 * 
 * Ce script :
 * 1. Identifie les salaires marqués comme payés
 * 2. Vérifie si le stock MGA a été décrémenté
 * 3. Si non, applique la correction
 */

import { PrismaClient } from '@prisma/client'
import { updateCashStockForSalary } from '@/services/hr.service'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Correction des salaires déjà payés...\n')

  // Récupérer tous les salaires payés
  const paidSalaries = await prisma.salary.findMany({
    where: { paidAt: { not: null } },
    include: { employee: true },
    orderBy: { paidAt: 'asc' },
  })

  console.log(`📊 ${paidSalaries.length} salaire(s) payé(s) trouvé(s)\n`)

  let correctedCount = 0
  let skippedCount = 0
  let errorCount = 0

  for (const salary of paidSalaries) {
    try {
      // Vérifier si le stock a déjà été décrémenté
      const mgaCurrency = await prisma.currency.findUnique({
        where: { code: 'MGA' },
      })

      if (!mgaCurrency) throw new Error('Devise MGA introuvable')

      const mgaStock = await prisma.cashStock.findUnique({
        where: { currencyId: mgaCurrency.id },
      })

      if (!mgaStock) throw new Error('Stock MGA introuvable')

      // Vérifier si un stockLog existe pour ce salaire
      const existingLog = await prisma.stockLog.findFirst({
        where: {
          note: { contains: `Paiement salaire ${salary.employee.firstName} ${salary.employee.lastName}` },
          operation: 'RETRAIT',
        },
      })

      if (existingLog) {
        console.log(`️  ${salary.employee.firstName} ${salary.employee.lastName} - Déjà corrigé`)
        skippedCount++
        continue
      }

      // Appliquer la correction
      await updateCashStockForSalary(salary.id, prisma)
      console.log(`✅ ${salary.employee.firstName} ${salary.employee.lastName} - ${salary.netSalary.toFixed(2)} Ar déduit`)
      correctedCount++
    } catch (error: any) {
      console.error(`❌ ${salary.employee.firstName} ${salary.employee.lastName} - Erreur : ${error.message}`)
      errorCount++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📈 Résumé :')
  console.log(`   ✅ Corrigés : ${correctedCount}`)
  console.log(`   ⏭️  Déjà corrigés : ${skippedCount}`)
  console.log(`   ❌ Erreurs : ${errorCount}`)
  console.log('='.repeat(70))

  // Afficher le nouveau stock MGA
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  console.log(`\n💰 Nouveau stock MGA : ${mgaStock!.amount.toFixed(2)} Ar`)
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