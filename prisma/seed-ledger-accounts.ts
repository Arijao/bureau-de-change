// prisma/seed-ledger-accounts.ts
// Usage : npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-ledger-accounts.ts

import * as dotenv from 'dotenv'
dotenv.config()   // ← charge .env AVANT que PrismaClient lise DATABASE_URL

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const EXPENSE_ACCOUNTS = [
  { code: '613000', name: 'Loyers et charges locatives' },
  { code: '615000', name: 'Entretien et réparations' },
  { code: '616000', name: "Primes d'assurances" },
  { code: '625000', name: 'Déplacements et transports' },
  { code: '626000', name: 'Frais postaux et télécommunications' },
  { code: '627000', name: 'Services bancaires et frais assimilés' },
  { code: '628000', name: 'Diverses charges externes' },
  { code: '651000', name: 'Fournitures de bureau' },
  { code: '652000', name: 'Carburants et lubrifiants' },
  { code: '653000', name: "Charges d'électricité" },
  { code: '654000', name: "Charges d'eau" },
]

async function main() {
  console.log('🌱 Seeding comptes comptables EXPENSE...')
  let created = 0
  let skipped = 0

  for (const account of EXPENSE_ACCOUNTS) {
    const existing = await prisma.ledgerAccount.findFirst({
      where: { code: account.code },
    })

    if (!existing) {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: 'EXPENSE',
          active: true,
        },
      })
      console.log(`  ✅ Créé : ${account.code} — ${account.name}`)
      created++
    } else {
      console.log(`  ⏭  Existe déjà : ${account.code}`)
      skipped++
    }
  }

  console.log(`\n✅ Terminé — ${created} créé(s), ${skipped} déjà existant(s)`)
}

main()
  .catch((e) => { console.error('❌ Erreur:', e); process.exit(1) })
  .finally(() => prisma.$disconnect())