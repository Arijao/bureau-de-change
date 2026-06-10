/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'

// ── READ ─────────────────────────────────────────────────────
export async function getCurrencies(activeOnly = false) {
  return prisma.currency.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { code: 'asc' },
  })
}

export async function getCurrencyById(id: number) {
  return prisma.currency.findUnique({ where: { id } })
}

export async function getCurrencyByCode(code: string) {
  return prisma.currency.findUnique({ where: { code: code.toUpperCase() } })
}

/** Full details: currency + current rate + stock */
export async function getCurrenciesWithDetails(activeOnly = false) {
  const currencies = await prisma.currency.findMany({
    where: activeOnly ? { isActive: true } : undefined,
    orderBy: { code: 'asc' },
    include: { denominationCategories: { where: { active: true } } }
  })

  return Promise.all(
    currencies.map(async (c: any) => {
      const [rate, stock] = await Promise.all([
        prisma.exchangeRate.findFirst({
          where: { currencyId: c.id },
          orderBy: { createdAt: 'desc' },
          include: { categoryRates: { include: { category: true } } }
        }),
        prisma.cashStock.findUnique({ where: { currencyId: c.id } }),
      ])
      return { ...c, currentRate: rate, stock }
    })
  )
}

// ── CREATE ────────────────────────────────────────────────────
export async function createCurrency(data: {
  code: string; name: string; symbol?: string; flag?: string
  buyRate: number; sellRate: number; initialStock?: number
  alertLevel?: number; userId?: string
}) {
  const code = data.code.toUpperCase()
  const existing = await prisma.currency.findUnique({ where: { code } })
  if (existing) throw new Error(`La devise ${code} existe déjà`)

  const currency = await prisma.currency.create({
    data: { code, name: data.name, symbol: data.symbol, flag: data.flag ?? '🏳️' },
  })

  // Initial rate
  await prisma.exchangeRate.create({
    data: {
      currencyId: currency.id, buyRate: data.buyRate, sellRate: data.sellRate,
      note: 'Taux initial', createdBy: data.userId,
    },
  })

  // Initial stock
  const initStock = data.initialStock ?? 0
  const stock = await prisma.cashStock.create({
    data: { currencyId: currency.id, amount: initStock, alertLevel: data.alertLevel ?? initStock * 0.1 },
  })
  if (initStock > 0) {
    await prisma.stockLog.create({
      data: {
        stockId: stock.id, operation: 'DEPOT', delta: initStock,
        balanceBefore: 0, balanceAfter: initStock,
        note: 'Stock initial', userId: data.userId,
      },
    })
  }

  // Audit log
  if (data.userId) {
    await prisma.operationLog.create({
      data: { action: 'CURRENCY_CREATE', entity: 'Currency', entityId: String(currency.id), userId: data.userId, detail: JSON.stringify({ code, name: data.name }) },
    })
  }

  return currency
}

// ── UPDATE ────────────────────────────────────────────────────
export async function updateCurrency(id: number, data: {
  name?: string; symbol?: string; flag?: string; userId?: string
}) {
  const currency = await prisma.currency.update({ where: { id }, data: { name: data.name, symbol: data.symbol, flag: data.flag } })
  if (data.userId) {
    await prisma.operationLog.create({
      data: { action: 'CURRENCY_UPDATE', entity: 'Currency', entityId: String(id), userId: data.userId, detail: JSON.stringify(data) },
    })
  }
  return currency
}

export async function toggleCurrency(id: number, userId?: string) {
  const cur = await prisma.currency.findUnique({ where: { id } })
  if (!cur) throw new Error('Devise introuvable')
  const updated = await prisma.currency.update({ where: { id }, data: { isActive: !cur.isActive } })
  if (userId) {
    await prisma.operationLog.create({
      data: { action: 'CURRENCY_TOGGLE', entity: 'Currency', entityId: String(id), userId, detail: JSON.stringify({ isActive: updated.isActive }) },
    })
  }
  return updated
}

// ── DELETE ────────────────────────────────────────────────────
export async function deleteCurrency(id: number, userId?: string) {
  // Check no transactions
  const txCount = await prisma.transaction.count({ where: { currencyId: id } })
  if (txCount > 0) throw new Error(`Impossible de supprimer : ${txCount} transaction(s) liée(s)`)
  // Cascade deletes rates, stocks, logs via Prisma relations
  await prisma.currency.delete({ where: { id } })
  if (userId) {
    await prisma.operationLog.create({
      data: { action: 'CURRENCY_DELETE', entity: 'Currency', entityId: String(id), userId },
    })
  }
}

export async function getRateHistory(currencyId?: number, limit = 50) {
  return prisma.exchangeRate.findMany({
    where: currencyId ? { currencyId } : undefined,
    include: { currency: true, user: true },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
