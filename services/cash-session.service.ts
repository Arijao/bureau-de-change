/**
 *
 * Gestion des sessions de caisse et des passations.
 * Toutes les fonctions sont read-safe vis-à-vis des données existantes :
 * elles n'accèdent qu'aux nouveaux modèles CashSession / CashSessionBalance /
 * CashSessionCountDetail et aux FK nullable ajoutées sur Transaction et Expense.
 *
 * Décisions de conception appliquées :
 *  Q1 — Bloquant : assertOpenSession() lève une erreur si aucune session ouverte
 *  Q2 — Hybride  : getPreviousSessionClosingBalances() pour pré-remplissage UI
 *  Q3 — Coupures : CashSessionCountDetail stocke denomination × quantity
 *  Q4 — Admin    : la garde s'applique à tous les rôles (ADMIN inclus)
 *  Q5 — RH       : getHrMovements() filtre les StockLog par plage horaire
 */

import { prisma } from '@/lib/prisma'
import type {
  CashSessionBanner,
  CashSessionWithRelations,
  CashSessionReport,
  OpenSessionInput,
  CloseSessionInput,
  SessionMovementByCurrency,
  SessionDiscrepancy,
  SessionHrMovement,
} from '@/lib/types'

// ═══════════════════════════════════════════════════════════
// ── GARDE DE SESSION (Q1 — bloquant) ─────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Vérifie qu'une session est ouverte pour l'utilisateur.
 * À appeler en tête de createTransaction() et createExpense().
 * Lève une Error si aucune session ouverte → le service appelant retourne
 * { error } sans créer la ressource.
 */
export async function assertOpenSession(userId: string): Promise<string> {
  const session = await prisma.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
    select: { id: true, sessionNo: true },
  })

  if (!session) {
    throw new Error(
      'Aucune session de caisse ouverte. Veuillez ouvrir une session avant de créer une transaction.'
    )
  }

  return session.id
}

// ═══════════════════════════════════════════════════════════
// ── LECTURE ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/** Session ouverte pour un utilisateur donné (null si aucune). */
export async function getOpenSession(userId: string) {
  return prisma.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
    include: {
      user: { select: { name: true, role: true } },
      balances: {
        include: { currency: true, countDetails: true },
        orderBy: { currencyId: 'asc' },
      },
      previousSession: { select: { sessionNo: true, closedAt: true } },
    },
  })
}

/** Version allégée pour le bandeau Navbar — un seul aller Prisma. */
export async function getSessionBanner(userId: string): Promise<CashSessionBanner | null> {
  const session = await prisma.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
    select: {
      id:        true,
      sessionNo: true,
      status:    true,
      openedAt:  true,
      user:      { select: { name: true } },
    },
  })

  if (!session) return null

  return {
    id:        session.id,
    sessionNo: session.sessionNo,
    status:    session.status as 'OPEN' | 'CLOSED',
    openedAt:  session.openedAt,
    userName:  session.user.name,
  }
}

/**
 * Soldes de clôture de la session précédente pour pré-remplissage hybride (Q2).
 * Préfère PHYSICAL_COUNT s'il existe, sinon CLOSING_THEORETICAL.
 * Retourne un tableau prêt à passer dans openingBalances de openSession().
 */
export async function getPreviousSessionClosingBalances(previousSessionId: string) {
  const balances = await prisma.cashSessionBalance.findMany({
    where: {
      sessionId:   previousSessionId,
      balanceType: { in: ['PHYSICAL_COUNT', 'CLOSING_THEORETICAL'] },
    },
    include: { currency: true, countDetails: true },
    orderBy: { currencyId: 'asc' },
  })

  // Par devise : préférer PHYSICAL_COUNT sur CLOSING_THEORETICAL
  const byCurrency: Record<number, typeof balances[0]> = {}
  for (const b of balances) {
    const existing = byCurrency[b.currencyId]
    if (!existing || b.balanceType === 'PHYSICAL_COUNT') {
      byCurrency[b.currencyId] = b
    }
  }

  return Object.values(byCurrency).map(b => ({
    currencyId:   b.currencyId,
    currency:     b.currency,
    amount:       b.amount,
    denominations: b.countDetails.map(d => ({
      denomination: d.denomination,
      quantity:     d.quantity,
    })),
  }))
}

/** Dernière session clôturée tous utilisateurs confondus (pour démarrer une passation). */
export async function getLastClosedSession() {
  return prisma.cashSession.findFirst({
    where:   { status: 'CLOSED' },
    orderBy: { closedAt: 'desc' },
    include: {
      user:    { select: { name: true, role: true } },
      balances: { include: { currency: true, countDetails: true } },
    },
  })
}

// ═══════════════════════════════════════════════════════════
// ── OUVERTURE ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Ouvre une nouvelle session de caisse.
 *
 * Préconditions vérifiées :
 *  - Aucune session OPEN déjà active pour cet utilisateur
 *  - Si previousSessionId fourni : session précédente est bien CLOSED
 *  - Au moins une devise dans openingBalances
 */
export async function openSession(input: OpenSessionInput): Promise<CashSessionWithRelations> {
  const { userId, openingNote, previousSessionId, openingBalances } = input

  // ── Vérifications ────────────────────────────────────────
  const existingOpen = await prisma.cashSession.findFirst({
    where: { userId, status: 'OPEN' },
  })
  if (existingOpen) {
    throw new Error(
      `Une session est déjà ouverte pour cet utilisateur (${existingOpen.sessionNo}). ` +
      `Clôturez-la avant d'en ouvrir une nouvelle.`
    )
  }

  if (openingBalances.length === 0) {
    throw new Error('Au moins un solde d\'ouverture est requis.')
  }

  if (previousSessionId) {
    const prev = await prisma.cashSession.findUnique({
      where:  { id: previousSessionId },
      select: { status: true, sessionNo: true },
    })
    if (!prev) throw new Error('Session précédente introuvable.')
    if (prev.status !== 'CLOSED') {
      throw new Error(
        `La session précédente (${prev.sessionNo}) doit être clôturée avant de l'enchaîner.`
      )
    }
    // Vérifier que cette session précédente n'a pas déjà un successeur
    const alreadyChained = await prisma.cashSession.findFirst({
      where: { previousSessionId },
    })
    if (alreadyChained) {
      throw new Error(
        `La session précédente est déjà enchaînée à ${alreadyChained.sessionNo}.`
      )
    }
  }

  // ── Numérotation ─────────────────────────────────────────
  const sessionNo = await generateSessionNo()

  // ── Création atomique ─────────────────────────────────────
  const session = await prisma.cashSession.create({
    data: {
      sessionNo,
      status:      'OPEN',
      openingNote: openingNote ?? null,
      userId,
      previousSessionId: previousSessionId ?? null,
      balances: {
        create: openingBalances.map(b => ({
          currencyId:  b.currencyId,
          balanceType: 'OPENING',
          amount:      b.amount,
          ...(b.denominations && b.denominations.length > 0
            ? {
                countDetails: {
                  create: b.denominations
                    .filter(d => d.quantity > 0)
                    .map(d => ({ denomination: d.denomination, quantity: d.quantity })),
                },
              }
            : {}),
        })),
      },
    },
    include: {
      user:    { select: { name: true, role: true } },
      balances: {
        include:  { currency: true, countDetails: true },
        orderBy:  { currencyId: 'asc' },
      },
      previousSession: { select: { sessionNo: true, closedAt: true } },
    },
  })

  return session as CashSessionWithRelations
}

// ═══════════════════════════════════════════════════════════
// ── CLÔTURE ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Clôture une session de caisse.
 *
 * Étapes :
 *  1. Vérifications (session OPEN, utilisateur propriétaire)
 *  2. Calcul des soldes théoriques par devise
 *  3. Calcul des soldes physiques depuis les coupures saisies (Q3)
 *  4. Persistance atomique : CLOSING_THEORETICAL + PHYSICAL_COUNT + status CLOSED
 */
export async function closeSession(
  input: CloseSessionInput,
  requestingUserId: string
): Promise<CashSessionWithRelations> {
  const { sessionId, closingNote, physicalCounts } = input

  // ── Vérifications ────────────────────────────────────────
  const session = await prisma.cashSession.findUnique({
    where:   { id: sessionId },
    include: { balances: { where: { balanceType: 'OPENING' } } },
  })

  if (!session) throw new Error('Session introuvable.')
  if (session.status !== 'OPEN') throw new Error('Cette session est déjà clôturée.')
  if (session.userId !== requestingUserId) {
    throw new Error('Seul le caissier propriétaire peut clôturer sa session.')
  }

  if (physicalCounts.length === 0) {
    throw new Error('Le comptage physique est requis pour clôturer une session.')
  }

  const closedAt = new Date()

  // ── Soldes théoriques ─────────────────────────────────────
  const theoreticalMap = await computeTheoreticalBalances(
    sessionId,
    session.openedAt,
    closedAt
  )

  // ── Soldes physiques (coupures → total par devise) ────────
  const physicalMap: Record<number, { amount: number; denominations: Array<{ denomination: number; quantity: number }> }> = {}
  for (const pc of physicalCounts) {
    const activeDenominations = pc.denominations.filter(d => d.quantity > 0)
    const total = activeDenominations.reduce(
      (sum, d) => sum + d.denomination * d.quantity,
      0
    )
    physicalMap[pc.currencyId] = { amount: total, denominations: activeDenominations }
  }

  // ── Transaction atomique ──────────────────────────────────
  await prisma.$transaction(async client => {
    // 1. Soldes théoriques
    for (const [currencyIdStr, amount] of Object.entries(theoreticalMap)) {
      const currencyId = Number(currencyIdStr)
      await client.cashSessionBalance.upsert({
        where: {
          sessionId_currencyId_balanceType: {
            sessionId,
            currencyId,
            balanceType: 'CLOSING_THEORETICAL',
          },
        },
        create: { sessionId, currencyId, balanceType: 'CLOSING_THEORETICAL', amount },
        update: { amount },
      })
    }

    // 2. Comptages physiques avec coupures
    for (const [currencyIdStr, pc] of Object.entries(physicalMap)) {
      const currencyId = Number(currencyIdStr)

      // Supprimer un éventuel comptage précédent (ré-clôture annulée)
      const existing = await client.cashSessionBalance.findFirst({
        where: { sessionId, currencyId, balanceType: 'PHYSICAL_COUNT' },
      })
      if (existing) {
        await client.cashSessionCountDetail.deleteMany({
          where: { balanceId: existing.id },
        })
        await client.cashSessionBalance.delete({ where: { id: existing.id } })
      }

      await client.cashSessionBalance.create({
        data: {
          sessionId,
          currencyId,
          balanceType: 'PHYSICAL_COUNT',
          amount:      pc.amount,
          countDetails: {
            create: pc.denominations.map(d => ({
              denomination: d.denomination,
              quantity:     d.quantity,
            })),
          },
        },
      })
    }

    // 3. Fermer la session
    await client.cashSession.update({
      where: { id: sessionId },
      data: {
        status:      'CLOSED',
        closedAt,
        closingNote: closingNote ?? null,
      },
    })
  })

  return prisma.cashSession.findUnique({
    where:   { id: sessionId },
    include: {
      user:    { select: { name: true, role: true } },
      balances: {
        include:  { currency: true, countDetails: true },
        orderBy:  { currencyId: 'asc' },
      },
      previousSession: { select: { sessionNo: true, closedAt: true } },
      nextSession:     { select: { sessionNo: true } },
    },
  }) as Promise<CashSessionWithRelations>
}

// ═══════════════════════════════════════════════════════════
// ── RAPPORT DE CLÔTURE ────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Génère le rapport de clôture complet pour une session.
 *
 * Contient :
 *  - Informations générales de session
 *  - Mouvements par devise (achats / ventes)
 *  - Dépenses rattachées à la session
 *  - Mouvements RH par plage horaire (Q5)
 *  - Soldes d'ouverture, théoriques, physiques
 *  - Écarts par devise
 *  - Durée de session en minutes
 */
export async function getSessionReport(sessionId: string): Promise<CashSessionReport> {
  // ── Chargement principal ──────────────────────────────────
  const session = await prisma.cashSession.findUnique({
    where:   { id: sessionId },
    include: {
      user: { select: { name: true, role: true } },
      balances: {
        include:  { currency: true, countDetails: true },
        orderBy:  { currencyId: 'asc' },
      },
      transactions: {
        where:   { deletedAt: null },
        include: { currency: true, user: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
      expenses: {
        include: { account: true },
        orderBy: { date: 'asc' },
      },
      previousSession: { select: { sessionNo: true, closedAt: true } },
      nextSession:     { select: { sessionNo: true } },
    },
  })

  if (!session) throw new Error('Session introuvable.')

  const sessionEnd = session.closedAt ?? new Date()

  // ── Mouvements RH par plage horaire (Q5) ─────────────────
  const hrMovements = await getHrMovements(session.openedAt, sessionEnd)

  // ── Ventilation des transactions par devise ───────────────
  const movementsByCurrency = buildMovementsByCurrency(session.transactions as any[])

  // ── Tri des soldes par type ───────────────────────────────
  const openingBalances     = session.balances.filter(b => b.balanceType === 'OPENING')
  const theoreticalBalances = session.balances.filter(b => b.balanceType === 'CLOSING_THEORETICAL')
  const physicalBalances    = session.balances.filter(b => b.balanceType === 'PHYSICAL_COUNT')

  // ── Écarts ───────────────────────────────────────────────
  const discrepancies = buildDiscrepancies(theoreticalBalances, physicalBalances)

  // ── Totaux récapitulatifs ─────────────────────────────────
  const totalExpensesMGA = session.expenses.reduce((s, e) => s + e.amount, 0)
  const totalHrDelta     = hrMovements.reduce((s, m) => s + m.delta, 0)
  const sessionDuration  = Math.round(
    (sessionEnd.getTime() - session.openedAt.getTime()) / 60_000
  )

  return {
    session:             session as any,
    movementsByCurrency,
    achats:              session.transactions.filter(t => t.type === 'ACHAT') as any[],
    ventes:              session.transactions.filter(t => t.type === 'VENTE') as any[],
    expenses:            session.expenses as any[],
    hrMovements,
    openingBalances:     openingBalances as any[],
    theoreticalBalances: theoreticalBalances as any[],
    physicalBalances:    physicalBalances as any[],
    discrepancies,
    totalTransactions:   session.transactions.length,
    totalExpensesMGA,
    totalHrDelta,
    sessionDuration,
  }
}

// ═══════════════════════════════════════════════════════════
// ── HISTORIQUE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getSessionHistory(filters: {
  userId?:   string
  status?:   string
  dateFrom?: Date
  dateTo?:   Date
  limit?:    number
  offset?:   number
}) {
  const where: Record<string, any> = {}

  if (filters.userId)  where.userId = filters.userId
  if (filters.status)  where.status = filters.status
  if (filters.dateFrom || filters.dateTo) {
    where.openedAt = {}
    if (filters.dateFrom) where.openedAt.gte = filters.dateFrom
    if (filters.dateTo)   where.openedAt.lte = filters.dateTo
  }

  const [sessions, total] = await Promise.all([
    prisma.cashSession.findMany({
      where,
      include: {
        user: { select: { name: true, role: true } },
        balances: {
          where:   { balanceType: 'OPENING' },
          include: { currency: true },
        },
        _count: { select: { transactions: true, expenses: true } },
      },
      orderBy: { openedAt: 'desc' },
      take:    filters.limit  ?? 50,
      skip:    filters.offset ?? 0,
    }),
    prisma.cashSession.count({ where }),
  ])

  return { sessions, total }
}

// ═══════════════════════════════════════════════════════════
// ── HELPERS PRIVÉS ────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Génère un numéro de session unique : CS-YYYYMM-NNN
 * En cas de collision (race condition rare), Prisma lèvera une
 * UniqueConstraintError sur sessionNo — l'action peut réessayer.
 */
async function generateSessionNo(): Promise<string> {
  const now    = new Date()
  const year   = now.getFullYear()
  const month  = String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `CS-${year}${month}-`

  const count = await prisma.cashSession.count({
    where: { sessionNo: { startsWith: prefix } },
  })

  return `${prefix}${String(count + 1).padStart(3, '0')}`
}

/**
 * Calcule les soldes théoriques de clôture pour toutes les devises
 * ayant eu des mouvements pendant la session.
 *
 * theoreticalClosing[currencyId] = openingBalance + Σ(stockLog.delta)
 *
 * Les StockLogs capturent déjà TOUS les mouvements :
 * transactions, dépenses, ajustements manuels, salaires, avances.
 */
async function computeTheoreticalBalances(
  sessionId: string,
  openedAt:  Date,
  closedAt:  Date
): Promise<Record<number, number>> {
  // 1. Soldes d'ouverture enregistrés (base de calcul)
  const openingBalances = await prisma.cashSessionBalance.findMany({
    where: { sessionId, balanceType: 'OPENING' },
  })

  const result: Record<number, number> = {}
  for (const ob of openingBalances) {
    result[ob.currencyId] = ob.amount
  }

  // 2. Tous les stocks actifs → scan des logs pendant la période
  const allStocks = await prisma.cashStock.findMany({
    select: { id: true, currencyId: true },
  })

  for (const stock of allStocks) {
    const logs = await prisma.stockLog.findMany({
      where: {
        stockId:   stock.id,
        createdAt: { gte: openedAt, lte: closedAt },
      },
      select: { delta: true },
    })

    if (logs.length === 0) continue

    const netDelta = logs.reduce((sum, l) => sum + l.delta, 0)
    const opening  = result[stock.currencyId] ?? 0
    result[stock.currencyId] = opening + netDelta
  }

  return result
}

/**
 * Mouvements RH par plage horaire (Q5).
 *
 * Filtre les StockLog MGA sans transactionId sur la période de la session.
 * Cible les opérations RETRAIT / DEPOT hors transaction :
 *   → paiements de salaires, versements d'avances, remboursements.
 * Exclut les logs issus de dépenses (déjà comptés dans session.expenses).
 */
async function getHrMovements(
  openedAt:  Date,
  closedAt:  Date
): Promise<SessionHrMovement[]> {
  const mgaCurrency = await prisma.currency.findUnique({
    where:  { code: 'MGA' },
    select: { id: true },
  })
  if (!mgaCurrency) return []

  const mgaStock = await prisma.cashStock.findUnique({
    where:  { currencyId: mgaCurrency.id },
    select: { id: true },
  })
  if (!mgaStock) return []

  const logs = await prisma.stockLog.findMany({
    where: {
      stockId:       mgaStock.id,
      transactionId: null,
      createdAt:     { gte: openedAt, lte: closedAt },
      operation:     { in: ['RETRAIT', 'DEPOT'] },
      // Exclure les logs de dépenses (leur note contient "Dépense :")
      NOT: { note: { startsWith: 'Dépense:' } },
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'asc' },
  })

  return logs.map(l => ({
    id:            l.id,
    operation:     l.operation,
    delta:         l.delta,
    balanceBefore: l.balanceBefore,
    balanceAfter:  l.balanceAfter,
    note:          l.note,
    createdAt:     l.createdAt,
    user:          l.user,
  }))
}

/**
 * Construit la ventilation des mouvements par devise.
 * Transactions de type ACHAT et VENTE, groupées par currencyId.
 */
function buildMovementsByCurrency(
  transactions: Array<{
    type:       string
    currencyId: number
    amount:     number
    totalMGA:   number
    currency: { code: string; flag: string }
  }>
): SessionMovementByCurrency[] {
  const map: Record<number, SessionMovementByCurrency> = {}

  for (const tx of transactions) {
    if (!map[tx.currencyId]) {
      map[tx.currencyId] = {
        currencyId:   tx.currencyId,
        currencyCode: tx.currency.code,
        currencyFlag: tx.currency.flag,
        achatCount:   0, achatAmount: 0, achatMGA: 0,
        venteCount:   0, venteAmount: 0, venteMGA: 0,
      }
    }

    const m = map[tx.currencyId]
    if (tx.type === 'ACHAT') {
      m.achatCount++
      m.achatAmount += tx.amount
      m.achatMGA    += tx.totalMGA
    } else {
      m.venteCount++
      m.venteAmount += tx.amount
      m.venteMGA    += tx.totalMGA
    }
  }

  // Trier par code devise
  return Object.values(map).sort((a, b) => a.currencyCode.localeCompare(b.currencyCode))
}

/**
 * Calcule les écarts : physique − théorique par devise.
 * Ne retourne que les devises présentes dans les deux listes
 * ou ayant un écart non nul.
 */
function buildDiscrepancies(
  theoreticalBalances: Array<{ currencyId: number; amount: number; currency: { id: number; code: string; name: string; symbol: string | null; flag: string; isActive: boolean; createdAt: Date; updatedAt: Date } }>,
  physicalBalances:    Array<{ currencyId: number; amount: number; currency: { id: number; code: string; name: string; symbol: string | null; flag: string; isActive: boolean; createdAt: Date; updatedAt: Date } }>
): SessionDiscrepancy[] {
  const theoMap: Record<number, number> = {}
  const currencyMap: Record<number, SessionDiscrepancy['currency']> = {}

  for (const tb of theoreticalBalances) {
    theoMap[tb.currencyId]     = tb.amount
    currencyMap[tb.currencyId] = tb.currency
  }

  const discrepancies: SessionDiscrepancy[] = []

  for (const pb of physicalBalances) {
    const theoretical = theoMap[pb.currencyId] ?? 0
    const physical    = pb.amount
    const diff        = physical - theoretical

    discrepancies.push({
      currency:    currencyMap[pb.currencyId] ?? pb.currency,
      theoretical,
      physical,
      diff,
    })
  }

  // Trier : écarts d'abord, puis ordre alphabétique
  return discrepancies.sort((a, b) => {
    if (a.diff !== 0 && b.diff === 0) return -1
    if (a.diff === 0 && b.diff !== 0) return  1
    return a.currency.code.localeCompare(b.currency.code)
  })
}
