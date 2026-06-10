/**
 * Script d'initialisation du compte d'avances sur salaire
 * 
 * Usage : npx tsx scripts/init-advance-account.ts
 * 
 * Crée le compte 425000 "Avances sur salaire" (compte d'actif/créance).
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔧 Initialisation du compte d\'avances sur salaire...\n')

  const accountCode = '425000'
  const accountName = 'Avances sur salaire'

  const exists = await prisma.ledgerAccount.findUnique({
    where: { code: accountCode },
  })

  if (exists) {
    console.log(`✓ Compte ${accountCode} (${accountName}) existe déjà`)
  } else {
    await prisma.ledgerAccount.create({
      data: {
        code: accountCode,
        name: accountName,
        type: 'ASSET',
        description: 'Avances sur salaire accordées au personnel (compte de créance)',
        active: true,
      },
    })
    console.log(`✓ Compte ${accountCode} (${accountName}) créé avec succès`)
  }

  console.log('\n✅ Initialisation terminée !')
}

main()
  .catch((e) => {
    console.error('❌ Erreur :', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })