/**
 * Script d'initialisation du plan comptable.
 * 
 * Usage : npx tsx scripts/init-accounting.ts
 * 
 * Ce script crée les comptes de base s'ils n'existent pas encore :
 * - 530000 : Caisse MGA
 * - 707000 : Commissions perçues
 * 
 * Les comptes de caisse devise (EUR, USD, etc.) sont créés
 * automatiquement lors de la première génération d'écriture.
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Initialisation du plan comptable...\n')

  // Comptes de base
  const baseAccounts = [
    { code: '530000', name: 'Caisse MGA', type: 'ASSET', description: 'Liquidités en Ariary' },
    { code: '707000', name: 'Commissions perçues', type: 'REVENUE', description: 'Revenus de commissions sur opérations de change' },
  ]

  for (const account of baseAccounts) {
    const exists = await prisma.ledgerAccount.findUnique({
      where: { code: account.code },
    })

    if (exists) {
      console.log(`✓ Compte ${account.code} (${account.name}) existe déjà`)
    } else {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: account.type,
          description: account.description,
          active: true,
        },
      })
      console.log(`✓ Compte ${account.code} (${account.name}) créé`)
    }
  }

  console.log('\n✅ Plan comptable initialisé avec succès !')
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })