/**
 * SEED DE PRODUCTION — Bureau de Change FX Mada
 * ================================================
 * Usage : npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.prod.ts
 *
 * ⚠️  Ce seed est IDEMPOTENT : il peut être relancé sans écraser les données existantes.
 *     Il ne crée que ce qui n'existe pas encore (upsert / findFirst guard).
 *
 * 📝  AVANT DE LANCER :
 *     1. Modifier ADMIN_PASSWORD et CAISSIER_PASSWORD ci-dessous
 *     2. Adapter les TAUX à la réalité du jour
 *     3. Adapter les STOCKS initiaux à votre caisse réelle
 *     4. Adapter BUREAU_INFO à vos vraies coordonnées
 */

import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()

// ── À PERSONNALISER AVANT LE PREMIER LANCEMENT ──────────────
const BUREAU_INFO = {
  bureauName: 'Bureau de Change XChange',    // ← votre nom
  address:    'Antananarivo, Madagascar',      // ← votre adresse
  phone:      '+261 20 22 XXX XX',             // ← votre téléphone
  footer:     'Merci pour votre confiance',
}

// Mots de passe : À CHANGER immédiatement après le premier login
const ADMIN_PASSWORD    = 'Admin123'    // ← changez ceci
const CAISSIER_PASSWORD = 'Caissier123'     // ← changez ceci
const CAISSIER_NOM      = 'JeanBa Rakoto'        // ← prénom + nom du caissier

// Taux en Ariary — À AJUSTER au marché du jour (source : BFM ou taux pratiqués)
// Format : { buy: taux_achat, sell: taux_vente, stock: quantite_initiale_en_caisse, alert: seuil_alerte }
const CURRENCIES = [
  { code:'EUR', name:'Euro',              symbol:'€',   flag:'🇪🇺', buy:4850,  sell:4930,  stock:3000,   alert:500  },
  { code:'USD', name:'Dollar américain',  symbol:'$',   flag:'🇺🇸', buy:4420,  sell:4500,  stock:5000,   alert:800  },
  { code:'GBP', name:'Livre Sterling',    symbol:'£',   flag:'🇬🇧', buy:5580,  sell:5680,  stock:1000,   alert:200  },
  { code:'CHF', name:'Franc Suisse',      symbol:'₣',   flag:'🇨🇭', buy:4950,  sell:5030,  stock:1000,   alert:200  },
  { code:'CAD', name:'Dollar Canadien',   symbol:'C$',  flag:'🇨🇦', buy:3180,  sell:3260,  stock:1000,   alert:200  },
  { code:'MUR', name:'Roupie Mauricienne',symbol:'₨',   flag:'🇲🇺', buy:96,    sell:102,   stock:20000,  alert:3000 },
  { code:'AED', name:'Dirham Emirates',   symbol:'د.إ', flag:'🇦🇪', buy:1200,  sell:1240,  stock:5000,   alert:800  },
  { code:'CNY', name:'Yuan Chinois',      symbol:'¥',   flag:'🇨🇳', buy:610,   sell:640,   stock:5000,   alert:800  },
]
// ────────────────────────────────────────────────────────────

const hash = (p: string) => createHash('sha256').update(p + 'bdc_salt').digest('hex')

async function main() {
  console.log('\n🚀  Initialisation base de production...\n')

  // 1. Paramètres du bureau
  await prisma.settings.upsert({
    where: { id: 'singleton' },
    update: {},  // ne pas écraser si déjà configuré
    create: { id: 'singleton', ...BUREAU_INFO },
  })
  console.log('✅  Paramètres bureau OK')

  // 2. Compte admin
  const admin = await prisma.user.upsert({
    where:  { username: 'admin' },
    update: {},  // ne pas réinitialiser le mot de passe si déjà modifié
    create: {
      username:     'admin',
      passwordHash: hash(ADMIN_PASSWORD),
      name:         'Administrateur',
      role:         'ADMIN',
    },
  })
  console.log('✅  Admin OK')

  // 3. Compte caissier
  await prisma.user.upsert({
    where:  { username: 'caissier' },
    update: {},
    create: {
      username:     'caissier',
      passwordHash: hash(CAISSIER_PASSWORD),
      name:         CAISSIER_NOM,
      role:         'CAISSIER',
    },
  })
  console.log('✅  Caissier OK')

  // ── MGA : Devise de référence (toujours présente, non supprimable) ──
  const mga = await prisma.currency.upsert({
    where:  { code: 'MGA' },
    update: {},
    create: { code: 'MGA', name: 'Ariary', symbol: 'Ar', flag: '🇲🇬', isBase: true },
  })

  // ❌ Pas de taux pour le MGA (1 MGA = 1 MGA, constant)

  const mgaStockExists = await prisma.cashStock.findUnique({
    where: { currencyId: mga.id },
  })
  if (!mgaStockExists) {
    const stock = await prisma.cashStock.create({
      data: { currencyId: mga.id, amount: 50_000_000, alertLevel: 5_000_000 },
    })
    await prisma.stockLog.create({
      data: {
        stockId:       stock.id,
        operation:     'INITIAL',
        delta:         50_000_000,
        balanceBefore: 0,
        balanceAfter:  50_000_000,
        note:          'Fonds de caisse initial MGA',
        userId:        admin.id,
        transactionId: null,
      },
    })
    console.log('   📦  Stock MGA : 50 000 000 Ar — alerte à 5 000 000 Ar')
  } else {
    console.log('   ↩️   Stock MGA : déjà enregistré — non modifié')
  }
  // ── Fin MGA ──

  // 4. Devises, taux initiaux et stocks
  for (const c of CURRENCIES) {
    const currency = await prisma.currency.upsert({
      where:  { code: c.code },
      update: {},
      create: { code: c.code, name: c.name, symbol: c.symbol, flag: c.flag },
    })

    // Taux initial uniquement si aucun taux n'existe
    const rateExists = await prisma.exchangeRate.findFirst({
      where: { currencyId: currency.id },
    })
    if (!rateExists) {
      await prisma.exchangeRate.create({
        data: {
          currencyId: currency.id,
          buyRate:    c.buy,
          sellRate:   c.sell,
          note:       'Taux d\'ouverture',
          createdBy:  admin.id,
        },
      })
      console.log(`   📈  Taux ${c.code} : ${c.buy} / ${c.sell} Ar`)
    } else {
      console.log(`   ↩️   Taux ${c.code} : déjà défini — non modifié`)
    }

    // Stock initial uniquement si aucun stock n'existe
    const stockExists = await prisma.cashStock.findUnique({
      where: { currencyId: currency.id },
    })
    if (!stockExists) {
      const stock = await prisma.cashStock.create({
        data: { currencyId: currency.id, amount: c.stock, alertLevel: c.alert },
      })
      await prisma.stockLog.create({
        data: {
          stockId:       stock.id,
          operation:     'INITIAL',
          delta:         c.stock,
          balanceBefore: 0,
          balanceAfter:  c.stock,
          note:          'Inventaire d\'ouverture',
          userId:        admin.id,
          transactionId: null,
        },
      })
      console.log(`   📦  Stock ${c.code} : ${c.stock.toLocaleString('fr-FR')} — alerte à ${c.alert.toLocaleString('fr-FR')}`)
    } else {
      console.log(`   ↩️   Stock ${c.code} : déjà enregistré — non modifié`)
    }
  }

  console.log('\n✅  Seed de production terminé !\n')
  console.log('┌─────────────────────────────────────────┐')
  console.log('│  COMPTES CRÉÉS                          │')
  console.log(`│  Admin    : admin / ${ADMIN_PASSWORD.padEnd(20)}│`)
  console.log(`│  Caissier : caissier / ${CAISSIER_PASSWORD.padEnd(17)}│`)
  console.log('├─────────────────────────────────────────┤')
  console.log('│  ⚠️  CHANGEZ LES MOTS DE PASSE         │')
  console.log('│     dès le premier login (Paramètres)   │')
  console.log('└─────────────────────────────────────────┘\n')
}

main()
  .catch(e => { console.error('❌ Erreur :', e.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
