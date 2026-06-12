'use server'

/**
 *
 * Actions serveur Next.js pour la gestion des sessions de caisse.
 * Suit le même pattern que les actions existantes du projet :
 *  - getSessionUser() pour l'authentification
 *  - Retour { error: string } | données
 *  - revalidatePath() après chaque mutation
 *
 * Nouveau fichier — rien d'existant n'est modifié.
 */

import { revalidatePath } from 'next/cache'
import { getSessionUser }  from '@/lib/auth'
import { prisma }         from '@/lib/prisma'
import {
  openSession,
  closeSession,
  getOpenSession,
  getSessionBanner,
  getSessionHistory,
  getSessionReport,
  getPreviousSessionClosingBalances,
  getLastClosedSession,
} from '@/services/cash-session.service'
import type { OpenSessionInput, CloseSessionInput } from '@/lib/types'

/**
 * Retourne les soldes théoriques en cours pour une session ouverte.
 * Utile pour afficher une estimation pendant la session.
 * (Appelé optionnellement depuis la page caisse — non bloquant.)
 */
export async function getTheoreticalBalancesAction(sessionId: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const session = await prisma.cashSession.findUnique({
      where:   { id: sessionId },
      include: { balances: { where: { balanceType: 'OPENING' } } },
    })

    if (!session) return { error: 'Session introuvable.' }

    const sessionEnd = session.closedAt ?? new Date()

    const allStocks = await prisma.cashStock.findMany({
      include: { currency: true },
    })

    const result: Array<{ currencyId: number; currencyCode: string; currencyFlag: string; theoretical: number }> = []

    for (const stock of allStocks) {
      const opening = session.balances.find(b => b.currencyId === stock.currencyId)
      if (!opening) continue

      const logs = await prisma.stockLog.findMany({
        where: {
          stockId:   stock.id,
          createdAt: { gte: session.openedAt, lte: sessionEnd },
        },
        select: { delta: true },
      })

      const net = logs.reduce((s, l) => s + l.delta, 0)
      result.push({
        currencyId:   stock.currencyId,
        currencyCode: stock.currency.code,
        currencyFlag: stock.currency.flag,
        theoretical:  opening.amount + net,
      })
    }

    return { balances: result }
  } catch (e: any) {
    return { error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════
// ── LECTURE ───────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/** Session ouverte de l'utilisateur connecté — pour la page Caisse. */
export async function getCurrentSessionAction() {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const session = await getOpenSession(user.id)
    return { session }
  } catch (e: any) {
    return { error: e.message }
  }
}

/** Bandeau Navbar — appelé depuis layout.tsx. */
export async function getSessionBannerAction() {
  const user = await getSessionUser()
  if (!user) return null

  try {
    return await getSessionBanner(user.id)
  } catch {
    return null
  }
}

/**
 * Données de pré-remplissage pour l'ouverture d'une nouvelle session (Q2 hybride).
 * Retourne les soldes de clôture de la session précédente choisie.
 */
export async function getPreviousBalancesAction(previousSessionId: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const balances = await getPreviousSessionClosingBalances(previousSessionId)
    return { balances }
  } catch (e: any) {
    return { error: e.message }
  }
}

/** Dernière session clôturée — pour proposer une passation. */
export async function getLastClosedSessionAction() {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const session = await getLastClosedSession()
    return { session }
  } catch (e: any) {
    return { error: e.message }
  }
}

/** Rapport de clôture d'une session par son ID. */
export async function getSessionReportAction(sessionId: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const report = await getSessionReport(sessionId)
    return { report }
  } catch (e: any) {
    return { error: e.message }
  }
}

/** Historique des sessions avec filtres. */
export async function getSessionHistoryAction(filters: {
  userId?:    string
  status?:    string
  dateFrom?:  string
  dateTo?:    string
  limit?:     number
  offset?:    number
}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const result = await getSessionHistory({
      userId:   filters.userId,
      status:   filters.status,
      dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo:   filters.dateTo   ? new Date(filters.dateTo)   : undefined,
      limit:    filters.limit,
      offset:   filters.offset,
    })
    return result
  } catch (e: any) {
    return { error: e.message }
  }
}

// ═══════════════════════════════════════════════════════════
// ── MUTATIONS ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/** Ouvre une nouvelle session pour l'utilisateur connecté. */
export async function openSessionAction(input: {
  openingNote?:       string
  previousSessionId?: string
  openingBalances: Array<{
    currencyId: number
    amount:     number
    denominations?: Array<{ denomination: number; quantity: number }>
  }>
}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const session = await openSession({
      userId:            user.id,
      openingNote:       input.openingNote,
      previousSessionId: input.previousSessionId,
      openingBalances:   input.openingBalances,
    } satisfies OpenSessionInput)

    revalidatePath('/caisse')
    revalidatePath('/dashboard')
    revalidatePath('/transactions')

    return { session }
  } catch (e: any) {
    return { error: e.message }
  }
}

/**
 * Clôture la session de l'utilisateur connecté.
 * Seul le propriétaire de la session peut la clôturer.
 */
export async function closeSessionAction(input: {
  sessionId:    string
  closingNote?: string
  physicalCounts: Array<{
    currencyId: number
    denominations: Array<{ denomination: number; quantity: number }>
  }>
}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié.' }

  try {
    const session = await closeSession(
      {
        sessionId:     input.sessionId,
        closingNote:   input.closingNote,
        physicalCounts: input.physicalCounts,
      } satisfies CloseSessionInput,
      user.id  // requestingUserId — vérifié dans le service
    )

    revalidatePath('/caisse')
    revalidatePath(`/caisse/rapport/${input.sessionId}`)
    revalidatePath('/caisse/historique')
    revalidatePath('/dashboard')
    revalidatePath('/transactions')

    return { session }
  } catch (e: any) {
    return { error: e.message }
  }
}
