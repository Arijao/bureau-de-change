/**
 * Script de création d'écriture d'ouverture
 * 
 * Usage : npx tsx scripts/create-opening-entry.ts
 * 
 * Ce script crée une écriture d'ouverture pour corriger l'écart
 * entre le stock réel MGA et le solde comptable.
 * 
 * Diagnostic :
 * - Stock réel MGA : 23 891 100 Ar
 * - Solde comptable : 13 891 100 Ar
 * - Écart à corriger : 10 000 000 Ar
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createOpeningEntry() {
  console.log('🔧 Création de l\'écriture d\'ouverture...\n')

  // ═══════════════════════════════════════════════════════════
  // 1. RÉCUPÉRER LES COMPTES NÉCESSAIRES
  // ═══════════════════════════════════════════════════════════
  console.log('📋 Récupération des comptes comptables...')
  
  const mgaAccount = await prisma.ledgerAccount.findUnique({
    where: { code: '530000' },
  })
  if (!mgaAccount) {
    console.error('❌ Compte 530000 (Caisse MGA) introuvable')
    return
  }
  console.log(`   ✓ Compte Caisse MGA : ${mgaAccount.code}`)

  // Créer ou récupérer le compte Capital
  let equityAccount = await prisma.ledgerAccount.findFirst({
    where: { type: 'EQUITY' },
  })

  if (!equityAccount) {
    console.log('📝 Création du compte Capital social...')
    equityAccount = await prisma.ledgerAccount.create({
      data: {
        code: '101000',
        name: 'Capital social',
        type: 'EQUITY',
        description: 'Capital initial du bureau de change',
        active: true,
      },
    })
    console.log(`   ✓ Compte Capital créé : ${equityAccount.code}`)
  } else {
    console.log(`   ✓ Compte Capital : ${equityAccount.code}`)
  }

  // ═══════════════════════════════════════════════════════════
  // 2. VÉRIFIER LE SOLDE ACTUEL AVANT ÉCRITURE
  // ═══════════════════════════════════════════════════════════
  console.log('\n📊 Solde comptable actuel (avant écriture)...')
  const beforeAggregates = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaAccount.id },
    _sum: { debit: true, credit: true },
  })

  const beforeDebit = beforeAggregates._sum.debit ?? 0
  const beforeCredit = beforeAggregates._sum.credit ?? 0
  const beforeBalance = beforeDebit - beforeCredit

  console.log(`   Débit : ${beforeDebit.toFixed(2)} Ar`)
  console.log(`   Crédit : ${beforeCredit.toFixed(2)} Ar`)
  console.log(`   Solde : ${beforeBalance.toFixed(2)} Ar`)

  // Récupérer le stock réel
  const mgaStock = await prisma.cashStock.findFirst({
    where: { currencyId: mgaAccount.id === mgaAccount.id ? (await prisma.currency.findUnique({ where: { code: 'MGA' } }))?.id : 0 },
  })

  if (mgaStock) {
    console.log(`\n💰 Stock réel en caisse : ${mgaStock.amount.toFixed(2)} Ar`)
    console.log(`📉 Écart à corriger : ${(mgaStock.amount - beforeBalance).toFixed(2)} Ar`)
  }

  // ═══════════════════════════════════════════════════════════
  // 3. CRÉER L'ÉCRITURE D'OUVERTURE
  // ═══════════════════════════════════════════════════════════
  const openingAmount = mgaStock ? mgaStock.amount - beforeBalance : 10000000

  console.log('\n💰 Création de l\'écriture d\'ouverture...')
  console.log(`   Montant : ${openingAmount.toFixed(2)} Ar`)
  console.log(`   Date : 2026-01-01`)
  console.log('')

  const openingEntry = await prisma.journalEntry.create({
    data: {
      date: new Date('2026-01-01'),
      description: 'Écriture d\'ouverture - Stock initial en caisse',
      reference: 'OUV-001',
      lines: {
        create: [
          {
            accountId: mgaAccount.id,
            debit: openingAmount,
            credit: 0,
            description: 'Stock initial MGA en caisse',
          },
          {
            accountId: equityAccount.id,
            debit: 0,
            credit: openingAmount,
            description: 'Capital initial',
          },
        ],
      },
    },
    include: {
      lines: { include: { account: true } },
    },
  })

  console.log('✅ Écriture d\'ouverture créée avec succès !')
  console.log(`   Référence : ${openingEntry.reference}`)
  console.log(`   ID : ${openingEntry.id}`)
  console.log(`   Lignes :`)
  openingEntry.lines.forEach(line => {
    const type = line.debit > 0 ? 'Débit' : 'Crédit'
    const amount = line.debit > 0 ? line.debit : line.credit
    console.log(`     - ${line.account.code} ${line.account.name} : ${type} ${amount.toFixed(2)} Ar`)
  })

  // ═══════════════════════════════════════════════════════════
  // 4. VÉRIFIER LE RÉSULTAT APRÈS ÉCRITURE
  // ═══════════════════════════════════════════════════════════
  console.log('\n🔍 Vérification du solde MGA après écriture...')
  const afterAggregates = await prisma.journalEntryLine.aggregate({
    where: { accountId: mgaAccount.id },
    _sum: { debit: true, credit: true },
  })

  const afterDebit = afterAggregates._sum.debit ?? 0
  const afterCredit = afterAggregates._sum.credit ?? 0
  const afterBalance = afterDebit - afterCredit

  console.log(`   Total Débit : ${afterDebit.toFixed(2)} Ar`)
  console.log(`   Total Crédit : ${afterCredit.toFixed(2)} Ar`)
  console.log(`   Nouveau solde comptable : ${afterBalance.toFixed(2)} Ar`)

  if (mgaStock) {
    console.log(`   Stock réel en caisse : ${mgaStock.amount.toFixed(2)} Ar`)
    
    if (Math.abs(afterBalance - mgaStock.amount) < 0.01) {
      console.log('\n✅ SOLDE COMPTABLE COHÉRENT AVEC LE STOCK RÉEL')
      console.log('   Écart : 0.00 Ar')
    } else {
      const remainingDiff = mgaStock.amount - afterBalance
      console.log(`\n⚠️  Écart restant : ${remainingDiff.toFixed(2)} Ar`)
    }
  }

  // ═══════════════════════════════════════════════════════════
  // 5. VÉRIFIER L'ÉQUILIBRE GLOBAL
  // ═══════════════════════════════════════════════════════════
  console.log('\n⚖️  Vérification de l\'équilibre comptable global...')
  const globalAggregates = await prisma.journalEntryLine.aggregate({
    _sum: { debit: true, credit: true },
  })

  const totalDebit = globalAggregates._sum.debit ?? 0
  const totalCredit = globalAggregates._sum.credit ?? 0
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01

  console.log(`   Total Débit global : ${totalDebit.toFixed(2)} Ar`)
  console.log(`   Total Crédit global : ${totalCredit.toFixed(2)} Ar`)
  console.log(`   Statut : ${isBalanced ? '✓ ÉQUILIBRÉ' : '✗ DÉSÉQUILIBRÉ'}`)

  // ═══════════════════════════════════════════════════════════
  // 6. RÉSUMÉ FINAL
  // ═══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(70))
  console.log(' RÉSUMÉ DE L\'OPÉRATION')
  console.log('='.repeat(70))
  console.log(`Écriture créée : ${openingEntry.reference}`)
  console.log(`Montant : ${openingAmount.toFixed(2)} Ar`)
  console.log(`Solde avant : ${beforeBalance.toFixed(2)} Ar`)
  console.log(`Solde après : ${afterBalance.toFixed(2)} Ar`)
  console.log(`Équilibre : ${isBalanced ? '✓ OK' : '✗ PROBLÈME'}`)
  console.log('='.repeat(70))

  if (isBalanced) {
    console.log('\n✅ Script terminé avec succès !')
    console.log('   La comptabilité est maintenant équilibrée.')
    console.log('   Vous pouvez consulter la Balance Générale pour vérifier.')
  } else {
    console.log('\n⚠️  Attention : La comptabilité n\'est pas équilibrée.')
    console.log('   Veuillez vérifier les écritures existantes.')
  }
}

createOpeningEntry()
  .catch((e) => {
    console.error('❌ Erreur lors de la création de l\'écriture d\'ouverture :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })