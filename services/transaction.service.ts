/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import { getCurrentRate } from './exchange-rate.service'
import { applyStockMovement, checkStock } from './stock.service'
import { generateReceiptNo } from '@/lib/utils'
import type { TxType } from '@/lib/types'
export type { TxType as TransactionType }
import { assertOpenSession } from '@/services/cash-session.service'

export interface CreateTransactionInput {
  type: TxType
  currencyId: number
  amount: number
  commission?: number
  note?: string
  userId?: string
  cashSessionId?: string
  overrideRate?: number
  // Sub-details for ACHAT with categories
  details?: Array<{
    categoryName: string
    denomination: number
    quantity: number
    rateApplied: number
    subtotalAmount: number
    subtotalMGA: number
  }>
}

export async function createTransaction(input: CreateTransactionInput) {
  const { type, currencyId, amount, commission = 0, note, userId, overrideRate, details } = input

  // ── Garde de session (Q1 — bloquant) ─────────────────────────────────
  // Lève une Error si aucune session ouverte pour cet utilisateur.
  // L'action appelante doit fournir input.userId.
  if (!input.userId) {
    throw new Error('userId requis pour créer une transaction.')
  }
  const resolvedSessionId = input.cashSessionId ?? await assertOpenSession(input.userId)
  // 1. Récupération du taux
  const rateRecord = await getCurrentRate(currencyId)
  if (!rateRecord) throw new Error('Aucun taux défini pour cette devise')

  const rate = overrideRate ?? (type === 'ACHAT' ? rateRecord.buyRate : rateRecord.sellRate)
  const totalMGA = type === 'ACHAT' ? (amount * rate) - commission : (amount * rate) + commission

  // 2. Identification de la devise MGA (référence)
  const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
  if (!mgaCurrency) throw new Error('Devise de référence (MGA) introuvable. Veuillez initialiser la base (seed).')

  const count = await prisma.transaction.count()
  const receiptNo = generateReceiptNo(count + 1001)

  // 3. Transaction atomique : Vérifications + Création + Mise à jour des 2 stocks + Logs
  const tx = await prisma.$transaction(async (client) => {
    const foreignStock = await client.cashStock.findUnique({ where: { currencyId }, include: { currency: true } })
    const mgaStock = await client.cashStock.findUnique({ where: { currencyId: mgaCurrency.id }, include: { currency: true } })

    if (!foreignStock) throw new Error('Stock introuvable pour cette devise')
    if (!mgaStock) throw new Error('Stock MGA non initialisé')

    // 4. Vérifications de stock selon le type d'opération
    if (type === 'ACHAT') {
      if (mgaStock.amount < totalMGA) {
        throw new Error(`Stock MGA insuffisant. Disponible: ${mgaStock.amount.toFixed(2)} Ar, Requis: ${totalMGA.toFixed(2)} Ar`)
      }
    } else {
      if (foreignStock.amount < amount) {
        throw new Error(`Stock ${foreignStock.currency.code} insuffisant. Disponible: ${foreignStock.amount.toFixed(2)}, Requis: ${amount.toFixed(2)}`)
      }
    }

    // 5. Création de l'enregistrement Transaction
    const tx = await client.transaction.create({
      data: {
        receiptNo, type, amount, rate, commission, totalMGA, note,
        currencyId, userId, exchangeRateId: rateRecord.id,
        cashSessionId: resolvedSessionId,
        // [CORRECTION SÉCURITÉ] : On n'accepte les détails QUE si c'est un ACHAT
        details: (type === 'ACHAT' && details && details.length > 0) ? {
          create: details.map(d => ({
            categoryName: d.categoryName,
            denomination: d.denomination,
            quantity: d.quantity,
            rateApplied: d.rateApplied,
            subtotalAmount: d.subtotalAmount,
            subtotalMGA: d.subtotalMGA,
          }))
        } : undefined
      },
      include: { currency: true, user: true, exchangeRate: true, details: true },
    })

    // 6. Calcul des deltas (positif = entrée en caisse, négatif = sortie)
    const foreignDelta = type === 'ACHAT' ? amount : -amount
    const mgaDelta = type === 'ACHAT' ? -totalMGA : totalMGA

    // 7. Mise à jour simultanée des deux stocks
    await client.cashStock.update({
      where: { id: foreignStock.id },
      data: { amount: { increment: foreignDelta } }
    })
    await client.cashStock.update({
      where: { id: mgaStock.id },
      data: { amount: { increment: mgaDelta } }
    })

    // 8. Traçabilité : Logs de mouvement pour les deux devises
    // [MODIFICATION] Ajout des StockLogDetail pour le StockLog de la devise étrangère (uniquement pour ACHAT)
    await client.stockLog.create({
      data: {
        stockId: foreignStock.id,
        operation: type,
        delta: foreignDelta,
        balanceBefore: foreignStock.amount,
        balanceAfter: foreignStock.amount + foreignDelta,
        note: `${type} ${amount} ${foreignStock.currency.code} — ${receiptNo}`,
        userId,
        transactionId: tx.id,
        // [AJOUT] Création imbriquée des détails de stock pour audit physique des billets
        details: type === 'ACHAT' && details && details.length > 0 ? {
          create: details.map(d => ({
            denomination: d.denomination,
            quantity: d.quantity,
          }))
        } : undefined
      }
    })

    await client.stockLog.create({
      data: {
        stockId: mgaStock.id,
        operation: type,
        delta: mgaDelta,
        balanceBefore: mgaStock.amount,
        balanceAfter: mgaStock.amount + mgaDelta,
        note: `Contrepartie MGA ${totalMGA.toFixed(2)} Ar — ${receiptNo}`,
        userId,
        transactionId: tx.id,
      }
    })

    // 9. Création du reçu
    await client.receipt.create({ data: { transactionId: tx.id, receiptNo } })

    // 10. Audit log
    if (userId) {
      await client.operationLog.create({
        data: {
          action: 'TX_CREATE', entity: 'Transaction', entityId: tx.id, userId,
          detail: JSON.stringify({ type, amount, rate, totalMGA, currency: tx.currency.code }),
        },
      })
    }

    return tx
  })

  // 11. Génération automatique de l'écriture comptable (non bloquant)
  try {
    const { generateJournalEntryFromTransaction } = await import('./accounting.service')
    await generateJournalEntryFromTransaction(tx.id)
  } catch (error) {
    console.error(`[Comptabilité] Erreur génération écriture pour ${tx.receiptNo}:`, error)
  }

  return tx
}

export async function getTransactions(filters: {
  dateFrom?: string; dateTo?: string; type?: TxType
  currencyId?: number; userId?: string; limit?: number; offset?: number
}) {
  const where: Record<string, any> = {}

  if (filters.dateFrom || filters.dateTo) {
    const range: Record<string, Date> = {}
    if (filters.dateFrom) range.gte = new Date(filters.dateFrom)
    if (filters.dateTo) { const d = new Date(filters.dateTo); d.setHours(23, 59, 59, 999); range.lte = d }
    where.createdAt = range
  }
  if (filters.type) where.type = filters.type
  if (filters.currencyId) where.currencyId = filters.currencyId
  if (filters.userId) where.userId = filters.userId

  const [transactions, total] = await Promise.all([
    prisma.transaction.findMany({
      where,
      include: {
        currency: true,
        user: { select: { name: true } },
        exchangeRate: true,
        journalEntry: { select: { id: true, date: true } },
      },
      orderBy: { createdAt: 'desc' }, take: filters.limit ?? 100, skip: filters.offset ?? 0,
    }),
    prisma.transaction.count({ where }),
  ])

  return { transactions, total }
}

export async function getTransactionById(id: string) {
  return prisma.transaction.findUnique({
    where: { id },
    include: {
      currency: true,
      user: { select: { name: true } },
      exchangeRate: true,
      receipt: true,
      journalEntry: true,
    },
  })
}

export async function getDashboardStats(from: Date, to: Date) {
  const transactions: any[] = await prisma.transaction.findMany({
    where: { createdAt: { gte: from, lte: to } }, include: { currency: true },
  })
  const achats = transactions.filter((t: any) => t.type === 'ACHAT')
  const ventes = transactions.filter((t: any) => t.type === 'VENTE')
  const byCurrency = Object.values(
    transactions.reduce((acc: Record<string, any>, t: any) => {
      const k = t.currencyId
      if (!acc[k]) acc[k] = { currency: t.currency, count: 0, totalMGA: 0 }
      acc[k].count++; acc[k].totalMGA += t.totalMGA
      return acc
    }, {})
  )
  
  // ── CALCUL DU BÉNÉFICE NET (Option B - complète) ──
  
  // 1. Marge sur ventes (quantité vendue × (taux vente - taux achat moyen))
  let margeSurVentes = 0
  for (const vente of ventes) {
    // Calculer le taux d'achat moyen pour cette devise sur la période
    const achatsMemeDevise = achats.filter((a: any) => a.currencyId === vente.currencyId)
    if (achatsMemeDevise.length > 0) {
      const totalAchatMGA = achatsMemeDevise.reduce((s: number, a: any) => s + a.totalMGA, 0)
      const totalAchatQty = achatsMemeDevise.reduce((s: number, a: any) => s + a.amount, 0)
      const tauxAchatMoyen = totalAchatMGA / totalAchatQty
      const margeUnitaire = vente.rate - tauxAchatMoyen
      margeSurVentes += margeUnitaire * vente.amount
    }
  }
  
  // 2. Revenus des attestations payantes
  const settings = await prisma.settings.findUnique({ where: { id: 'singleton' } })
  const attestationRate = settings?.attestationRate ?? 100
  const { getAttestationRevenues } = await import('@/services/attestation.service')
  const attestationRevenues = await getAttestationRevenues(from, to, attestationRate)
  
  // 3. Commissions
  const totalCommissions = transactions.reduce((s: number, t: any) => s + t.commission, 0)
  
  // 4. Dépenses d'exploitation
  const { getExpenses } = await import('@/services/charges.service')
  const expenses = await getExpenses({ dateFrom: from, dateTo: to })
  const totalDepenses = expenses.reduce((s: number, e: any) => s + e.amount, 0)
  
  // 5. Salaires et CNaPS patronal
  const { getPaidSalariesAndCnaps } = await import('@/services/hr.service')
  const { totalGrossSalary, totalCnapsEmployer } = await getPaidSalariesAndCnaps(from, to)
  
  const { getPendingAdvancesTotal } = await import('@/services/hr.service')
  const pendingAdvances = await getPendingAdvancesTotal()

  // 6. Calcul final
  const beneficeNet = margeSurVentes 
    + attestationRevenues.totalRevenue 
    + totalCommissions 
    - totalDepenses 
    - totalGrossSalary 
    - totalCnapsEmployer
  
  return {
    totalTransactions: transactions.length,
    totalAchatMGA: achats.reduce((s: number, t: any) => s + t.totalMGA, 0),
    totalVenteMGA: ventes.reduce((s: number, t: any) => s + t.totalMGA, 0),
    totalCommissions,
    achatsCount: achats.length, 
    ventesCount: ventes.length,
    beneficeEstime: beneficeNet, // Nouveau calcul complet
    // Détails pour affichage
    avancesEnCours: pendingAdvances.totalAmount,
    avancesEnCoursCount: pendingAdvances.count,

    margeSurVentes,
    attestationRevenues: attestationRevenues.totalRevenue,
    totalDepenses,
    totalSalaires: totalGrossSalary,
    totalCnapsEmployer,
    byCurrency,
  }
}

export async function getWeeklyActivity() {
  const days = []
  for (let i = 6; i >= 0; i--) {
    const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0)
    const next = new Date(d); next.setHours(23, 59, 59, 999)

    const txs: any[] = await prisma.transaction.findMany({ where: { createdAt: { gte: d, lte: next } } })

    days.push({
      date: d.toISOString().slice(0, 10), label: i === 0 ? 'Auj.' : `J-${i}`,
      count: txs.length,
      totalMGA: txs.reduce((s: number, t: any) => s + t.totalMGA, 0),
      achats: txs.filter((t: any) => t.type === 'ACHAT').reduce((s: number, t: any) => s + t.totalMGA, 0),
      ventes: txs.filter((t: any) => t.type === 'VENTE').reduce((s: number, t: any) => s + t.totalMGA, 0),
    })
  }
  return days
}

// ── ERREUR MÉTIER ────────────────────────────────────────────────────────────
export class TransactionNotFoundError extends Error {
  constructor(id: string) {
    super(`Transaction introuvable : ${id}`)
    this.name = 'TransactionNotFoundError'
  }
}

// ── REVERSE STOCK ────────────────────────────────────────────────────────────
/**
 * Annule l'impact d'une transaction existante sur les DEUX stocks (devise étrangère ET MGA).
 * Recherche tous les StockLogs liés à cette transaction et inverse leurs deltas.
 */
async function reverseTransactionStock(
  tx: { id: string; type: string; amount: number; currencyId: number },
  userId: string,
  prismaClient: typeof prisma
): Promise<void> {
  const existingLogs = await prismaClient.stockLog.findMany({
    where: { transactionId: tx.id },
    include: {
      stock: {
        include: { currency: true }
      },
      details: true // [AJOUT] Inclure les détails pour les supprimer
    },
  })

  if (existingLogs.length === 0) return

  for (const existingLog of existingLogs) {
    const reverseDelta = -existingLog.delta
    const balanceBefore = existingLog.stock.amount
    const balanceAfter = balanceBefore + reverseDelta

    if (balanceAfter < 0) {
      throw new Error(
        `Impossible d'annuler : le stock ${existingLog.stock.currency.code} deviendrait négatif (${balanceAfter.toFixed(2)})`
      )
    }

    // [AJOUT] Supprimer les StockLogDetail associés avant de détacher le log
    if (existingLog.details.length > 0) {
      await prismaClient.stockLogDetail.deleteMany({
        where: { stockLogId: existingLog.id }
      })
    }

    await prismaClient.stockLog.update({
      where: { id: existingLog.id },
      data: { transactionId: null },
    })

    await prismaClient.cashStock.update({
      where: { id: existingLog.stockId },
      data: { amount: balanceAfter },
    })

    await prismaClient.stockLog.create({
      data: {
        stockId: existingLog.stockId,
        operation: 'AJUSTEMENT',
        delta: reverseDelta,
        balanceBefore,
        balanceAfter,
        note: `Annulation ${tx.type} ${tx.amount} — TX:${tx.id} (${existingLog.stock.currency.code})`,
        userId,
        transactionId: null,
      },
    })
  }
}

// ── SUPPRESSION (soft delete) ─────────────────────────────────────────────────
export async function deleteTransaction(transactionId: string, adminId: string) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { currency: true, stockLogs: { include: { stock: true } } },
  })
  if (!tx) throw new TransactionNotFoundError(transactionId)
  if (tx.deletedAt) throw new Error('Transaction déjà supprimée')

  // 1. Transaction critique : inversion stocks + soft delete UNIQUEMENT
  await prisma.$transaction(async (client) => {
    // 1.1 Inverser l'impact sur le stock (garde l'annulation DANS la transaction)
    await reverseTransactionStock(tx, adminId, client as typeof prisma)

    // 1.2 Soft delete
    await client.transaction.update({
      where: { id: transactionId },
      data: { deletedAt: new Date(), deletedBy: adminId },
    })
  })

  // 2. Opérations post-transaction (non bloquantes pour l'intégrité)
  // 2.1 Supprimer l'écriture comptable liée (si elle existe)
  try {
    const { deleteJournalEntryForTransaction } = await import('./accounting.service')
    await deleteJournalEntryForTransaction(transactionId)
  } catch (error) {
    console.error(`[Comptabilité] Erreur suppression écriture pour ${tx.receiptNo}:`, error)
  }

  // 2.2 Audit log (HORS transaction - c'était la cause du timeout !)
  try {
    await prisma.operationLog.create({
      data: {
        action: 'TX_DELETE',
        entity: 'Transaction',
        entityId: transactionId,
        userId: adminId,
        detail: JSON.stringify({
          receiptNo: tx.receiptNo,
          type: tx.type,
          amount: tx.amount,
          totalMGA: tx.totalMGA,
          currency: tx.currency.code,
        }),
      },
    })
  } catch (error) {
    console.error(`[Audit] Erreur création log suppression pour ${tx.receiptNo}:`, error)
  }
}

// ── MODIFICATION ──────────────────────────────────────────────────────────────
export interface UpdateTransactionInput {
  amount: number
  rate: number
  commission: number
  note?: string
}

export async function updateTransaction(
  transactionId: string,
  input: UpdateTransactionInput,
  adminId: string
) {
  const tx = await prisma.transaction.findUnique({
    where: { id: transactionId },
    include: { currency: true, stockLogs: { include: { stock: true } } },
  })

  if (!tx) throw new TransactionNotFoundError(transactionId)
  if (tx.deletedAt) throw new Error('Impossible de modifier une transaction supprimée')

  const { amount, rate, commission, note } = input
  const newTotalMGA =
    tx.type === 'ACHAT' ? amount * rate - commission : amount * rate + commission

  await prisma.$transaction(async (client) => {
    // 1. Inverser l'ancien impact stock
    await reverseTransactionStock(tx, adminId, client as typeof prisma)

    // 2 & 3. Récupérer foreignStock et mgaCurrency en parallèle (gain ~50ms)
    const [foreignStock, mgaCurrency] = await Promise.all([
      client.cashStock.findUnique({ where: { currencyId: tx.currencyId } }),
      client.currency.findUnique({ where: { code: 'MGA' } }),
    ])
    if (!mgaCurrency) throw new Error('Devise MGA introuvable')
    if (!foreignStock) throw new Error('Stock introuvable pour cette devise')

    const mgaStock = await client.cashStock.findUnique({
      where: { currencyId: mgaCurrency.id },
    })
    if (!mgaStock) throw new Error('Stock MGA introuvable')

    // 4. Vérifications de stock
    const newForeignDelta = tx.type === 'ACHAT' ? amount : -amount
    const newMgaDelta = tx.type === 'ACHAT' ? -newTotalMGA : newTotalMGA

    if (tx.type === 'ACHAT') {
      if (foreignStock.amount < amount) {
        throw new Error(
          `Stock insuffisant après annulation : ${foreignStock.amount.toFixed(2)} disponible, ${amount.toFixed(2)} requis`
        )
      }
      if (mgaStock.amount + newMgaDelta < 0) {
        throw new Error(`Stock MGA insuffisant après modification : ${mgaStock.amount.toFixed(2)} disponible, ${Math.abs(newMgaDelta).toFixed(2)} requis`)
      }
    } else {
      if (foreignStock.amount + newForeignDelta < 0) {
        throw new Error(`Stock ${tx.currency.code} insuffisant après modification : ${foreignStock.amount.toFixed(2)} disponible, ${Math.abs(newForeignDelta).toFixed(2)} requis`)
      }
    }

    // 5. Appliquer les nouveaux deltas
    const foreignBalanceBefore = foreignStock.amount
    const foreignBalanceAfter = foreignBalanceBefore + newForeignDelta
    const mgaBalanceBefore = mgaStock.amount
    const mgaBalanceAfter = mgaBalanceBefore + newMgaDelta

    await client.cashStock.update({
      where: { id: foreignStock.id },
      data: { amount: foreignBalanceAfter },
    })
    await client.stockLog.create({
      data: {
        stockId: foreignStock.id,
        operation: tx.type as any,
        delta: newForeignDelta,
        balanceBefore: foreignBalanceBefore,
        balanceAfter: foreignBalanceAfter,
        note: `Modif. ${tx.type} ${amount} ${tx.currency.code} — ${tx.receiptNo}`,
        userId: adminId,
        transactionId,
      },
    })

    await client.cashStock.update({
      where: { id: mgaStock.id },
      data: { amount: mgaBalanceAfter },
    })
    await client.stockLog.create({
      data: {
        stockId: mgaStock.id,
        operation: tx.type as any,
        delta: newMgaDelta,
        balanceBefore: mgaBalanceBefore,
        balanceAfter: mgaBalanceAfter,
        note: `Modif. contrepartie MGA ${newTotalMGA.toFixed(2)} Ar — ${tx.receiptNo}`,
        userId: adminId,
        transactionId,
      },
    })

    // 6. Audit de modification + mise à jour transaction en parallèle
    await Promise.all([
      client.transactionEdit.create({
        data: {
          transactionId,
          editedBy: adminId,
          beforeAmount: tx.amount,
          beforeRate: tx.rate,
          beforeCommission: tx.commission,
          beforeTotalMGA: tx.totalMGA,
          beforeNote: tx.note,
          afterAmount: amount,
          afterRate: rate,
          afterCommission: commission,
          afterTotalMGA: newTotalMGA,
          afterNote: note ?? null,
        },
      }),
      client.transaction.update({
        where: { id: transactionId },
        data: { amount, rate, commission, totalMGA: newTotalMGA, note: note ?? null },
      }),
      client.operationLog.create({
        data: {
          action: 'TX_EDIT',
          entity: 'Transaction',
          entityId: transactionId,
          userId: adminId,
          detail: JSON.stringify({
            receiptNo: tx.receiptNo,
            before: { amount: tx.amount, rate: tx.rate, totalMGA: tx.totalMGA },
            after: { amount, rate, totalMGA: newTotalMGA },
          }),
        },
      }),
    ])
  })

  // 7. Supprimer l'ancienne écriture comptable HORS transaction (évite le timeout — même pattern que deleteTransaction)
  try {
    const { deleteJournalEntryForTransaction } = await import('./accounting.service')
    await deleteJournalEntryForTransaction(transactionId)
  } catch (error) {
    console.error(`[Comptabilité] Erreur suppression ancienne écriture pour ${tx.receiptNo}:`, error)
  }

  // 8. Régénérer l'écriture comptable avec les nouvelles valeurs (non bloquant)
  try {
    const { generateJournalEntryFromTransaction } = await import('./accounting.service')
    await generateJournalEntryFromTransaction(transactionId)
  } catch (error) {
    console.error(`[Comptabilité] Erreur régénération écriture pour ${tx.receiptNo}:`, error)
  }

  return prisma.transaction.findUnique({
    where: { id: transactionId },
    include: {
      currency: true,
      user: { select: { name: true } },
      exchangeRate: true,
      journalEntry: true,
    },
  })
}