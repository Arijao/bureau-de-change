/**
 * Script d'initialisation des comptes comptables RH
 * Usage : npx tsx scripts/init-hr-accounting.ts
 * 
 * Crée tous les comptes nécessaires au module RH :
 * - 641000 : Charges de personnel (EXPENSE)
 * - 645100 : Charges sociales patronales (EXPENSE)
 * - 424100 : CNaPS part salariale (LIABILITY)
 * - 424200 : CNaPS part patronale (LIABILITY)
 * - 425000 : Avances sur salaire (ASSET)
 */
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()

const HR_ACCOUNTS = [
  {
    code: '641000',
    name: 'Charges de personnel',
    type: 'EXPENSE',
    description: 'Charges de personnel - Salaires et rémunérations',
  },
  {
    code: '645100',
    name: 'Charges sociales patronales',
    type: 'EXPENSE',
    description: 'Charges sociales patronales (CNaPS employeur)',
  },
  {
    code: '424100',
    name: 'CNaPS part salariale',
    type: 'LIABILITY',
    description: 'Dettes CNaPS - Part salariale à payer',
  },
  {
    code: '424200',
    name: 'CNaPS part patronale',
    type: 'LIABILITY',
    description: 'Dettes CNaPS - Part patronale à payer',
  },
  {
    code: '425000',
    name: 'Avances sur salaire',
    type: 'ASSET',
    description: 'Avances accordées aux employés (créance sur le personnel)',
  },
]

async function main() {
  console.log('🔧 Initialisation des comptes comptables RH...\n')
  
  let created = 0
  let existing = 0
  
  for (const account of HR_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findUnique({ where: { code: account.code } })
    
    if (exists) {
      console.log(`✓ Compte ${account.code} (${account.name}) existe déjà`)
      existing++
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
      console.log(`✓ Compte ${account.code} (${account.name}) créé avec succès`)
      created++
    }
  }
  
  console.log(`\n✅ Initialisation terminée !`)
  console.log(`   ${created} compte(s) créé(s), ${existing} compte(s) existant(s)`)
  
  // Vérification du compte Caisse MGA (530000)
  const mgaCash = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
  if (!mgaCash) {
    console.log(`\n⚠️  Attention : Le compte 530000 (Caisse MGA) n'existe pas encore.`)
    console.log(`   Il sera créé automatiquement lors de la première transaction.`)
  } else {
    console.log(`\n✓ Compte 530000 (Caisse MGA) présent`)
  }
}

main()
  .catch((e) => { console.error('❌ Erreur :', e); process.exit(1) })
  .finally(async () => { await prisma.$disconnect() })