import { PrismaClient } from '@prisma/client'
import { createHash } from 'crypto'

const prisma = new PrismaClient()
const hash = (p: string) => createHash('sha256').update(p+'bdc_salt').digest('hex')

async function main() {
  console.log('🌱 Seeding...')

  await prisma.settings.upsert({ where:{id:'singleton'}, update:{},
    create:{id:'singleton',bureauName:'Bureau de Change FX Mada',address:'Antananarivo, Madagascar',phone:'+261 20 22 XXX XX',footer:'Merci pour votre confiance'} })

  const admin = await prisma.user.upsert({ where:{username:'admin'}, update:{},
    create:{username:'admin',passwordHash:hash('admin123'),name:'Administrateur',role:'ADMIN'} })
  await prisma.user.upsert({ where:{username:'caissier'}, update:{},
    create:{username:'caissier',passwordHash:hash('caissier123'),name:'Jean Rakoto',role:'CAISSIER'} })
  
  // ── MGA : Devise de référence (toujours présente, non supprimable) ──
  const mga = await prisma.currency.upsert({
    where: { code: 'MGA' },
    update: {},
    create: { code: 'MGA', name: 'Ariary', symbol: 'Ar', flag: '🇲🇬', isBase: true }
  })

  // ❌ Pas de taux pour le MGA (1 MGA = 1 MGA, constant)

  const mgaStockExists = await prisma.cashStock.findUnique({ where: { currencyId: mga.id } })
  if (!mgaStockExists) {
    const stock = await prisma.cashStock.create({
      data: { currencyId: mga.id, amount: 50_000_000, alertLevel: 5_000_000 }
    })
    await prisma.stockLog.create({
      data: {
        stockId: stock.id,
        operation: 'DEPOT',
        delta: 50_000_000,
        balanceBefore: 0,
        balanceAfter: 50_000_000,
        note: 'Fonds de caisse initial MGA',
        userId: admin.id
      }
    })
  }
  // ── Fin MGA ──

  const currencies = [
    {code:'EUR',name:'Euro',             symbol:'€',  flag:'🇪🇺',buy:4850, sell:4920,stock:5000,  alert:500 },
    {code:'USD',name:'Dollar américain', symbol:'$',  flag:'🇺🇸',buy:4420, sell:4490,stock:8000,  alert:800 },
    {code:'GBP',name:'Livre Sterling',   symbol:'£',  flag:'🇬🇧',buy:5580, sell:5660,stock:2000,  alert:200 },
    {code:'CHF',name:'Franc Suisse',     symbol:'₣',  flag:'🇨🇭',buy:4950, sell:5020,stock:3000,  alert:300 },
    {code:'CAD',name:'Dollar Canadien',  symbol:'C$', flag:'🇨🇦',buy:3180, sell:3240,stock:3500,  alert:350 },
    {code:'MUR',name:'Roupie Mauricienne',symbol:'₨', flag:'🇲🇺',buy:96,   sell:100, stock:50000, alert:5000},
    {code:'AED',name:'Dirham Emirates',  symbol:'د.إ',flag:'🇦🇪',buy:1200, sell:1230,stock:10000, alert:1000},
    {code:'CNY',name:'Yuan Chinois',     symbol:'¥',  flag:'🇨🇳',buy:610,  sell:632, stock:15000, alert:1500},
  ]

  for (const c of currencies) {
    const cur = await prisma.currency.upsert({ where:{code:c.code}, update:{},
      create:{code:c.code,name:c.name,symbol:c.symbol,flag:c.flag} })

    const rateExists = await prisma.exchangeRate.findFirst({where:{currencyId:cur.id},orderBy:{createdAt:'desc'}})
    if (!rateExists) {
      await prisma.exchangeRate.create({data:{currencyId:cur.id,buyRate:c.buy,sellRate:c.sell,note:'Taux initial',createdBy:admin.id}})
    }

    const stockExists = await prisma.cashStock.findUnique({where:{currencyId:cur.id}})
    if (!stockExists) {
      const stock = await prisma.cashStock.create({data:{currencyId:cur.id,amount:c.stock,alertLevel:c.alert}})
      await prisma.stockLog.create({data:{stockId:stock.id,operation:'DEPOT',delta:c.stock,balanceBefore:0,balanceAfter:c.stock,note:'Stock initial',userId:admin.id}})
    }
  }

  console.log('✅ Seed completed!')
  console.log('   Admin    : admin / admin123')
  console.log('   Caissier : caissier / caissier123')
}

main().catch(e=>{console.error('❌',e);process.exit(1)}).finally(()=>prisma.$disconnect())
