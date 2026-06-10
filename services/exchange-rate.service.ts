import { prisma } from '@/lib/prisma'

/** Get the active (most recent) rate for a currency */
export async function getCurrentRate(currencyId: number) {
  return prisma.exchangeRate.findFirst({
    where: { currencyId },
    orderBy: { createdAt: 'desc' },
    include: {
      currency: true,
      categoryRates: {
        include: { category: true }
      }
    },
  })
}

/** Get all rates for a currency (history) */
export async function getRateHistory(currencyId?: number, limit = 30) {
  return prisma.exchangeRate.findMany({
    where: currencyId ? { currencyId } : undefined,
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      currency: { select: { flag: true, code: true } },
      user: { select: { name: true } },
      categoryRates: { include: { category: true } }
    },
  })
}

/** Push a new rate — becomes immediately active */
export async function addRate(data: {
  currencyId: number
  buyRate: number
  sellRate: number
  note?: string
  userId?: string
  categoryRates?: Array<{ categoryId: number; buyRate: number }>
}) {
  if (data.sellRate < data.buyRate) {
    throw new Error("Le taux de vente doit être ≥ taux d'achat")
  }
  const rate = await prisma.exchangeRate.create({
    data: {
      currencyId: data.currencyId,
      buyRate: data.buyRate,
      sellRate: data.sellRate,
      note: data.note,
      createdBy: data.userId,
      categoryRates: data.categoryRates ? {
        create: data.categoryRates.map(cr => ({
          categoryId: cr.categoryId,
          buyRate: cr.buyRate
        }))
      } : undefined
    },
    include: { categoryRates: true }
  })
  if (data.userId) {
    const cur = await prisma.currency.findUnique({ where: { id: data.currencyId } })
    await prisma.operationLog.create({
      data: {
        action: 'RATE_UPDATE', entity: 'ExchangeRate',
        entityId: String(rate.id), userId: data.userId,
        detail: JSON.stringify({ currency: cur?.code, buyRate: data.buyRate, sellRate: data.sellRate }),
      },
    })
  }
  return rate
}

/** Get latest rates for all active currencies */
export async function getAllCurrentRates() {
  const currencies = await prisma.currency.findMany({
    where: { isActive: true },
    orderBy: { code: 'asc' },
  })
  return Promise.all(
    currencies.map(async (c: any) => {
      const rate = await prisma.exchangeRate.findFirst({
        where: { currencyId: c.id },
        orderBy: { createdAt: 'desc' },
      })
      return { currency: c, rate }
    })
  )
}
