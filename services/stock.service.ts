import { prisma } from '@/lib/prisma'
import type { StockOperation } from '@/lib/types'

/** Get stock for a currency */
export async function getStock(currencyId: number) {
  return prisma.cashStock.findUnique({
    where: { currencyId },
    include: { currency: true },
  })
}

/** Get all stocks with alert info */
export async function getAllStocks() {
  const stocks = await prisma.cashStock.findMany({
    include: { currency: true },
    orderBy: { currency: { code: 'asc' } },
  })
  return stocks.map((s: any) => ({
    ...s,
    isLow: s.amount <= s.alertLevel,
    percentage: s.alertLevel > 0 ? Math.round((s.amount / (s.alertLevel * 10)) * 100) : 100,
  }))
}

/** Check if sufficient stock exists (for ACHAT — bureau gives currency) */
export async function checkStock(currencyId: number, amount: number): Promise<{ ok: boolean; available: number }> {
  const stock = await prisma.cashStock.findUnique({ where: { currencyId } })
  const available = stock?.amount ?? 0
  return { ok: available >= amount, available }
}

/** Apply stock movement — called inside a transaction */
export async function applyStockMovement(params: {
  currencyId: number
  operation: StockOperation
  delta: number          // positive = enter, negative = exit
  note?: string
  userId?: string
  transactionId?: string
}) {
  const stock = await prisma.cashStock.findUnique({ where: { currencyId: params.currencyId } })
  if (!stock) throw new Error('Stock introuvable pour cette devise')

  const balanceBefore = stock.amount
  const balanceAfter = balanceBefore + params.delta

  if (balanceAfter < 0) {
    throw new Error(`Stock insuffisant : disponible ${balanceBefore.toFixed(2)}, requis ${Math.abs(params.delta).toFixed(2)}`)
  }

  const [updatedStock, log] = await prisma.$transaction([
    prisma.cashStock.update({
      where: { id: stock.id },
      data: { amount: balanceAfter },
    }),
    prisma.stockLog.create({
      data: {
        stockId: stock.id,
        operation: params.operation,
        delta: params.delta,
        balanceBefore,
        balanceAfter,
        note: params.note,
        userId: params.userId,
        transactionId: params.transactionId,
      },
    }),
  ])

  return { stock: updatedStock, log, balanceBefore, balanceAfter }
}

/** Manual adjustment (depot / retrait) — admin only */
export async function adjustStock(data: {
  currencyId: number
  operation: 'DEPOT' | 'RETRAIT' | 'AJUSTEMENT'
  amount: number
  note?: string
  userId?: string
}) {
  // Récupérer le stock actuel
  const stock = await prisma.cashStock.findUnique({ where: { currencyId: data.currencyId } })
  if (!stock) throw new Error('Stock introuvable pour cette devise')

  let delta: number
  let balanceAfter: number

  if (data.operation === 'AJUSTEMENT') {
    // AJUSTEMENT : Définir directement le nouveau solde
    balanceAfter = Math.abs(data.amount)
    delta = balanceAfter - stock.amount
  } else {
    // DEPOT / RETRAIT : Ajouter ou soustraire
    delta = data.operation === 'RETRAIT' ? -Math.abs(data.amount) : Math.abs(data.amount)
    balanceAfter = stock.amount + delta
  }

  if (balanceAfter < 0) {
    throw new Error(`Stock insuffisant : disponible ${stock.amount.toFixed(2)}, requis ${Math.abs(delta).toFixed(2)}`)
  }

  const [updatedStock, log] = await prisma.$transaction([
    prisma.cashStock.update({
      where: { id: stock.id },
      data: { amount: balanceAfter },
    }),
    prisma.stockLog.create({
      data: {
        stockId: stock.id,
        operation: data.operation,
        delta,
        balanceBefore: stock.amount,
        balanceAfter,
        note: data.note,
        userId: data.userId,
      },
    }),
  ])

  if (data.userId) {
    await prisma.operationLog.create({
      data: {
        action: 'STOCK_ADJUST', entity: 'CashStock',
        entityId: String(updatedStock.id), userId: data.userId,
        detail: JSON.stringify({ operation: data.operation, amount: data.amount, delta }),
      },
    })
  }

  return { stock: updatedStock, log, balanceBefore: stock.amount, balanceAfter }
}

/** Get stock movement history */
export async function getStockLogs(currencyId?: number, limit = 50) {
  return prisma.stockLog.findMany({
    where: {
      AND: [
        currencyId ? { stock: { currencyId } } : {},
        { operation: { not: 'INITIAL' } }, // Exclure les stocks initiaux
      ],
    },
    include: { stock: { include: { currency: true } }, user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}

/** Get current physical denominations breakdown for a currency */
export async function getCurrentPhysicalDenominations(currencyId: number) {
  const stock = await prisma.cashStock.findUnique({
    where: { currencyId },
    include: { currency: true }
  })

  if (!stock) throw new Error('Stock introuvable pour cette devise')

  // Aggregate all StockLogDetail from ACHAT operations
  const details = await prisma.stockLogDetail.findMany({
    where: {
      stockLog: {
        stockId: stock.id,
        operation: 'ACHAT'
      }
    },
    include: {
      stockLog: {
        select: {
          transaction: {
            select: {
              deletedAt: true
            }
          }
        }
      }
    }
  })

  // Filter out details from deleted transactions and group by denomination
  const activeDetails = details.filter(d => !d.stockLog.transaction?.deletedAt)

  const byDenomination = activeDetails.reduce((acc, detail) => {
    const denom = detail.denomination
    if (!acc[denom]) acc[denom] = 0
    acc[denom] += detail.quantity
    return acc
  }, {} as Record<number, number>)

  // Convert to sorted array (highest denomination first)
  const result = Object.entries(byDenomination)
    .map(([denom, qty]) => ({
      denomination: parseFloat(denom),
      quantity: qty
    }))
    .sort((a, b) => b.denomination - a.denomination)

  return {
    currency: stock.currency,
    totalAmount: stock.amount,
    denominations: result
  }
}

/** Get cash closing report for a specific currency and date */
export async function getCashClosingReport(currencyId: number, dateStr: string) {
  // 1. Calculer le solde d'ouverture (dernier mouvement avant la date cible)
  const targetDate = new Date(dateStr)
  targetDate.setHours(0, 0, 0, 0)

  const lastLogBefore = await prisma.stockLog.findFirst({
    where: {
      stock: { currencyId },
      createdAt: { lt: targetDate },
    },
    orderBy: { createdAt: 'desc' },
  })

  const openingBalance = lastLogBefore ? lastLogBefore.balanceAfter : 0

  // 2. Récupérer tous les mouvements de la journée
  const startOfDay = new Date(dateStr)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(dateStr)
  endOfDay.setHours(23, 59, 59, 999)

  const movements = await prisma.stockLog.findMany({
    where: {
      stock: { currencyId },
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    include: {
      user: { select: { name: true } },
    },
    orderBy: { createdAt: 'asc' },
  })

  // 3. Calculer le solde théorique de fermeture
  const totalDelta = movements.reduce((sum, m) => sum + m.delta, 0)
  const closingBalance = openingBalance + totalDelta

  return {
    openingBalance,
    movements,
    closingBalance,
    totalDelta,
  }
}
