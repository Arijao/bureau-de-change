/**
 * Script de correction pour le salaire de Mari Bema
 * 
 * Usage: npx tsx scripts/fix-salary-mari-bema.ts
 * 
 * Génère l'écriture comptable manquante pour SAL-6.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Correction du salaire de Mari Bema...\n')

  // 1. Récupérer le salaire de Mari Bema
  const salary = await prisma.salary.findFirst({
    where: {
      employee: {
        firstName: 'Bema',
        lastName: 'Mari',
      },
      paidAt: { not: null },
    },
    include: { employee: true },
  })

  if (!salary) {
    console.error('❌ Salaire de Mari Bema introuvable')
    return
  }

  console.log(`📋 Bulletin trouvé:`)
  console.log(`   ID: ${salary.id}`)
  console.log(`   Employé: ${salary.employee.firstName} ${salary.employee.lastName}`)
  console.log(`   Brut: ${(salary.baseSalary + salary.bonuses).toLocaleString()} Ar`)
  console.log(`   Déductions: ${salary.deductions.toLocaleString()} Ar`)
  console.log(`   Net: ${salary.netSalary.toLocaleString()} Ar`)
  console.log(`   Payé le: ${salary.paidAt?.toLocaleDateString('fr-FR')}\n`)

  // 2. Vérifier si une écriture existe déjà
  const existingEntry = await prisma.journalEntry.findFirst({
    where: {
      description: { contains: `Salaire ${salary.employee.firstName} ${salary.employee.lastName}` },
    },
  })

  if (existingEntry) {
    console.log('⚠️  Une écriture existe déjà pour ce bulletin')
    console.log(`   ID: ${existingEntry.id}`)
    console.log(`   Référence: ${existingEntry.reference}`)
    
    // Vérifier si elle est équilibrée
    const lines = await prisma.journalEntryLine.findMany({
      where: { journalEntryId: existingEntry.id },
    })
    
    const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0)
    const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0)
    
    console.log(`   Débit: ${totalDebit.toLocaleString()} Ar`)
    console.log(`   Crédit: ${totalCredit.toLocaleString()} Ar`)
    console.log(`   Équilibre: ${Math.abs(totalDebit - totalCredit) < 0.01 ? '✅' : '❌'}\n`)
    
    if (Math.abs(totalDebit - totalCredit) < 0.01) {
      console.log('✅ L\'écriture est équilibrée, aucune correction nécessaire')
      return
    }
    
    console.log('❌ L\'écriture est déséquilibrée, suppression et recréation...\n')
    
    // Supprimer les lignes et l'écriture
    await prisma.journalEntryLine.deleteMany({
      where: { journalEntryId: existingEntry.id },
    })
    await prisma.journalEntry.delete({
      where: { id: existingEntry.id },
    })
    console.log('✅ Ancienne écriture supprimée\n')
  }

  // 3. Récupérer les comptes
  const expenseAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '641000' },
  })
  const mgaCashAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '530000' },
  })
  const advanceAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '425000' },
  })

  if (!expenseAccount || !mgaCashAccount || !advanceAccount) {
    console.error('❌ Comptes comptables introuvables')
    return
  }

  // 4. Récupérer les avances APPROVED
  const advances = await prisma.advance.findMany({
    where: {
      employeeId: salary.employeeId,
      status: 'APPROVED',
      date: { lte: new Date(salary.year, salary.month, 0, 23, 59, 59) },
    },
  })

  const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0)
  const grossSalary = salary.baseSalary + salary.bonuses
  const netSalary = salary.netSalary
  const otherDeductions = salary.deductions - totalAdvances

  console.log(`📊 Calculs:`)
  console.log(`   Brut: ${grossSalary.toLocaleString()} Ar`)
  console.log(`   Avances: ${totalAdvances.toLocaleString()} Ar (${advances.length} avance${advances.length > 1 ? 's' : ''})`)
  console.log(`   Autres déductions: ${otherDeductions.toLocaleString()} Ar`)
  console.log(`   Net: ${netSalary.toLocaleString()} Ar\n`)

  // 5. Créer l'écriture comptable
  const journalEntry = await prisma.journalEntry.create({
    data: {
      date: salary.paidAt!,
      description: `Salaire ${salary.employee.firstName} ${salary.employee.lastName} - ${new Date(salary.year, salary.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      reference: `SAL-${salary.id}`,
      lines: {
        create: [
          {
            accountId: expenseAccount.id,
            debit: grossSalary,
            credit: 0,
            description: `Salaire brut ${salary.employee.firstName} ${salary.employee.lastName}`,
          },
          ...(totalAdvances > 0 ? [{
            accountId: advanceAccount.id,
            debit: 0,
            credit: totalAdvances,
            description: `Déduction avance sur salaire`,
          }] : []),
          {
            accountId: mgaCashAccount.id,
            debit: 0,
            credit: netSalary,
            description: `Paiement salaire ${salary.employee.firstName} ${salary.employee.lastName}`,
          },
          ...(otherDeductions > 0 ? [{
            accountId: expenseAccount.id, // Utiliser le même compte de charge
            debit: 0,
            credit: otherDeductions,
            description: `Autres déductions (sanctions, retenues)`,
          }] : []),
        ],
      },
    },
    include: {
      lines: { include: { account: true } },
    },
  })

  console.log(`✅ Écriture créée ID: ${journalEntry.id}`)
  console.log(`   Référence: ${journalEntry.reference}`)
  console.log(`   Lignes:`)
  
  let totalDebit = 0
  let totalCredit = 0
  journalEntry.lines.forEach(line => {
    const type = line.debit > 0 ? 'Débit' : 'Crédit'
    const amount = line.debit > 0 ? line.debit : line.credit
    if (line.debit > 0) totalDebit += line.debit
    if (line.credit > 0) totalCredit += line.credit
    console.log(`     ${type} ${line.account.code} (${line.account.name}): ${amount.toLocaleString()} Ar`)
  })
  
  console.log(`\n   Total Débit: ${totalDebit.toLocaleString()} Ar`)
  console.log(`   Total Crédit: ${totalCredit.toLocaleString()} Ar`)
  console.log(`   Équilibre: ${Math.abs(totalDebit - totalCredit) < 0.01 ? '✅ ÉQUILIBRÉE' : '❌ DÉSÉQUILIBRÉE'}\n`)

  // 6. Marquer les avances comme DEDUCTED
  if (advances.length > 0) {
    await prisma.advance.updateMany({
      where: { id: { in: advances.map(a => a.id) } },
      data: { status: 'DEDUCTED' },
    })
    console.log(`✅ ${advances.length} avance(s) marquée(s) comme DEDUCTED\n`)
  }

  // 7. Vérifier le nouveau solde
  const aggregates = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaCashAccount.id },
    _sum: { debit: true, credit: true },
  })

  const accountingBalance = (aggregates._sum.debit ?? 0) - (aggregates._sum.credit ?? 0)
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  const mgaStock = await prisma.cashStock.findUnique({
    where: { currencyId: mgaCurrency!.id },
  })

  console.log('📊 État final:')
  console.log(`   Stock physique MGA: ${mgaStock!.amount.toLocaleString()} Ar`)
  console.log(`   Solde comptable MGA: ${accountingBalance.toLocaleString()} Ar`)
  console.log(`   Écart: ${(mgaStock!.amount - accountingBalance).toLocaleString()} Ar`)
  console.log(`   Statut: ${Math.abs(mgaStock!.amount - accountingBalance) < 0.01 ? '✅ COHÉRENT' : '⚠️  Écart persistant'}\n`)

  console.log('✅ Correction terminée!')
}

main()
  .catch((e) => {
    console.error('❌ Erreur:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })