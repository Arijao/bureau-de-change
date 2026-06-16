// lib/ensure-defaults.ts
import { prisma } from '@/lib/prisma'

const DEFAULT_EXPENSE_ACCOUNTS = [
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

/**
 * Crée les comptes comptables EXPENSE s'ils n'existent pas.
 * Idempotent — sans effet si déjà présents.
 * Fonctionne sur dev.db ET sur la base Electron en production.
 */
export async function ensureDefaultLedgerAccounts(): Promise<void> {
  const existingCount = await prisma.ledgerAccount.count({
    where: { type: 'EXPENSE' },
  })

  // Déjà initialisé — sortie immédiate, coût quasi nul
  if (existingCount >= DEFAULT_EXPENSE_ACCOUNTS.length) return

  console.log('[ensure-defaults] Initialisation des comptes comptables...')

  for (const account of DEFAULT_EXPENSE_ACCOUNTS) {
    const exists = await prisma.ledgerAccount.findFirst({
      where: { code: account.code },
    })
    if (!exists) {
      await prisma.ledgerAccount.create({
        data: {
          code: account.code,
          name: account.name,
          type: 'EXPENSE',
          active: true,
        },
      })
    }
  }

  console.log('[ensure-defaults] ✅ Comptes comptables EXPENSE prêts')
}