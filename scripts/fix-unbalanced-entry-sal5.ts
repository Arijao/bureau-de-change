/**
 * Script de correction de l'écriture SAL-5 déséquilibrée
 * 
 * Usage : npx tsx scripts/fix-unbalanced-entry-sal5.ts
 * 
 * Ajoute la ligne manquante (crédit 425000) à l'écriture ID 11.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Correction de l\'écriture SAL-5...\n')

  const entryId = 11
  const missingAmount = 210000

  // 1. Récupérer l'écriture existante
  const entry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  })

  if (!entry) {
    console.error('❌ Écriture introuvable')
    return
  }

  console.log(`📋 Écriture actuelle :`)
  console.log(`   ID : ${entry.id}`)
  console.log(`   Référence : ${entry.reference}`)
  console.log(`   Description : ${entry.description}`)
  console.log(`   Date : ${entry.date.toLocaleDateString('fr-FR')}`)
  console.log(`   Lignes : ${entry.lines.length}`)
  entry.lines.forEach(line => {
    const type = line.debit > 0 ? 'Débit' : 'Crédit'
    const amount = line.debit > 0 ? line.debit : line.credit
    console.log(`     - ${type} Compte ${line.accountId} : ${amount.toLocaleString()} Ar`)
  })
  console.log('')

  // 2. Récupérer le compte 425000 (Avances sur salaire)
  const advanceAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '425000' },
  })

  if (!advanceAccount) {
    console.error('❌ Compte 425000 introuvable')
    return
  }

  // 3. Ajouter la ligne manquante
  await prisma.journalEntryLine.create({
    data: {
      journalEntryId: entryId,
      accountId: advanceAccount.id,
      debit: 0,
      credit: missingAmount,
      description: 'Déduction avance sur salaire - Angela Bevomanga',
    },
  })

  console.log(`✅ Ligne ajoutée :`)
  console.log(`   Crédit 425000 (Avances sur salaire) : ${missingAmount.toLocaleString()} Ar`)
  console.log('')

  // 4. Vérifier l'équilibre
  const updatedEntry = await prisma.journalEntry.findUnique({
    where: { id: entryId },
    include: { lines: true },
  })

  const totalDebit = updatedEntry!.lines.reduce((sum, line) => sum + line.debit, 0)
  const totalCredit = updatedEntry!.lines.reduce((sum, line) => sum + line.credit, 0)

  console.log(`📊 Écriture corrigée :`)
  console.log(`   Total Débit : ${totalDebit.toLocaleString()} Ar`)
  console.log(`   Total Crédit : ${totalCredit.toLocaleString()} Ar`)
  console.log(`   Équilibre : ${Math.abs(totalDebit - totalCredit) < 0.01 ? '✅ ÉQUILIBRÉE' : ' DÉSÉQUILIBRÉE'}`)
  console.log('')

  // 5. Marquer l'avance comme DEDUCTED
  const salary = await prisma.salary.findFirst({
    where: {
      id: parseInt(entry.reference!.replace('SAL-', '')),
    },
    include: { employee: true },
  })

  if (salary) {
    const advances = await prisma.advance.findMany({
      where: {
        employeeId: salary.employeeId,
        status: 'APPROVED',
      },
    })

    if (advances.length > 0) {
      await prisma.advance.updateMany({
        where: { id: { in: advances.map(a => a.id) } },
        data: { status: 'DEDUCTED' },
      })

      console.log(`✅ Avance(s) marquée(s) comme DÉDUITE(S) :`)
      advances.forEach(a => {
        console.log(`   - ${a.amount.toLocaleString()} Ar`)
      })
    }
  }

  console.log('\n✅ Correction terminée !')
  console.log('   Rechargez la page Balance pour voir le résultat.')
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })