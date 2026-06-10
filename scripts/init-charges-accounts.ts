/**
 * Script d'initialisation des comptes de charges
 * 
 * Usage : npx tsx scripts/init-charges-accounts.ts
 * 
 * Crée tous les comptes de charges nécessaires :
 * - Comptes de dépenses (classe 6)
 * - Comptes CNaPS (classe 4 et 6)
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const accounts = [
  // Charges de personnel
  { code: '641000', name: 'Charges de personnel', type: 'EXPENSE', description: 'Salaires et rémunérations' },
  { code: '645100', name: 'Charges sociales patronales', type: 'EXPENSE', description: 'Cotisations sociales employeur (CNaPS)' },
  
  // Dettes CNaPS
  { code: '424100', name: 'CNaPS - Part salariale', type: 'LIABILITY', description: 'Retenues CNaPS sur salaires' },
  { code: '424200', name: 'CNaPS - Part patronale', type: 'LIABILITY', description: 'Cotisations CNaPS employeur' },
  
  // Charges d'exploitation
  { code: '613000', name: 'Locations', type: 'EXPENSE', description: 'Loyers et charges locatives' },
  { code: '615000', name: 'Entretien et réparations', type: 'EXPENSE', description: 'Maintenance et réparations' },
  { code: '616000', name: 'Primes d\'assurance', type: 'EXPENSE', description: 'Assurances' },
  
  // Services extérieurs
  { code: '625000', name: 'Déplacements et missions', type: 'EXPENSE', description: 'Frais de déplacement' },
  { code: '626000', name: 'Frais postaux et télécommunications', type: 'EXPENSE', description: 'Téléphone, internet' },
  { code: '627000', name: 'Services bancaires', type: 'EXPENSE', description: 'Frais bancaires' },
  { code: '628000', name: 'Divers', type: 'EXPENSE', description: 'Autres services' },
  
  // Fournitures et consommables
  { code: '651000', name: 'Fournitures non stockables', type: 'EXPENSE', description: 'Fournitures de bureau' },
  { code: '652000', name: 'Carburant', type: 'EXPENSE', description: 'Essence, diesel' },
  { code: '653000', name: 'Électricité', type: 'EXPENSE', description: 'Factures électricité' },
  { code: '654000', name: 'Eau', type: 'EXPENSE', description: 'Factures d\'eau' },
]

async function main() {
  console.log('🔧 Initialisation des comptes de charges...\n')

  let createdCount = 0
  let skippedCount = 0

  for (const account of accounts) {
    const exists = await prisma.ledgerAccount.findUnique({
      where: { code: account.code },
    })

    if (exists) {
      console.log(`⏭️  ${account.code} - ${account.name} (déjà existant)`)
      skippedCount++
    } else {
      await prisma.ledgerAccount.create({
        data: account,
      })
      console.log(`✅ ${account.code} - ${account.name} (créé)`)
      createdCount++
    }
  }

  console.log('\n' + '='.repeat(70))
  console.log('📊 Résumé :')
  console.log(`   ✅ Créés : ${createdCount}`)
  console.log(`   ⏭️  Déjà existants : ${skippedCount}`)
  console.log('='.repeat(70))
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