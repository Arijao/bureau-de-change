'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth'
import * as chargesService from '@/services/charges.service'
import { CAISSIER_ALLOWED_CATEGORY_VALUES } from '@/lib/expense-roles'

// Helper pour vérifier les droits admin
async function requireAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Non authentifié')
  if (user.role !== 'ADMIN') throw new Error('Accès refusé — Admin uniquement')
  return user
}

// ═══════════════════════════════════════════════════════════
// ── DÉPENSES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function createExpenseAction(data: {
  date: string
  amount: number
  accountId: number
  category: string
  supplier?: string
  description: string
  reference?: string
  period?: string
  note?: string
}) {
  try {
    const user = await getSessionUser()
    if (!user) return { error: 'Non authentifié' }

    let cashSessionId: string | undefined = undefined

    if (user.role === 'CAISSIER') {
      // ── Garde 1 : catégorie opérationnelle uniquement ──────────────────────
      if (!(CAISSIER_ALLOWED_CATEGORY_VALUES as readonly string[]).includes(data.category)) {
        return {
          error: `Catégorie non autorisée. Le caissier peut saisir : ${CAISSIER_ALLOWED_CATEGORY_VALUES.join(', ')}.`,
        }
      }

      // [MOD-6] Garde 2 supprimée : aucun plafond de montant imposé au caissier.
      // Le contrôle est assuré par la clôture de session (écart physique / théorique).

      // ── Garde 2 : session de caisse ouverte obligatoire ───────────────────
      const { assertOpenSession } = await import('@/services/cash-session.service')
      try {
        cashSessionId = await assertOpenSession(user.id)
      } catch {
        return {
          error: "Aucune session de caisse ouverte. Ouvrez une session avant d'enregistrer une dépense.",
        }
      }
    } else if (user.role !== 'ADMIN') {
      return { error: 'Accès refusé' }
    }

    const expense = await chargesService.createExpense({
      ...data,
      date: new Date(data.date),
      cashSessionId,
    })

    const { createExpenseAccountingEntry } = await import('@/services/charges.service')
    const { prisma } = await import('@/lib/prisma')
    await createExpenseAccountingEntry(expense.id, prisma)

    revalidatePath('/charges')
    revalidatePath('/charges/expenses')
    revalidatePath('/dashboard')
    revalidatePath('/accounting/journal')
    revalidatePath('/caisse')

    return { success: true, expense }
  } catch (e: any) {
    console.error('Erreur création dépense:', e)
    return { error: e.message ?? 'Erreur lors de la création de la dépense' }
  }
}

export async function getExpensesAction(filters?: {
  category?: string
  dateFrom?: string
  dateTo?: string
}) {
  try {
    await requireAdmin()

    const expenses = await chargesService.getExpenses({
      category: filters?.category,
      dateFrom: filters?.dateFrom ? new Date(filters.dateFrom) : undefined,
      dateTo: filters?.dateTo ? new Date(filters.dateTo) : undefined,
    })

    return { success: true, expenses }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

export async function deleteExpenseAction(id: number) {
  try {
    await requireAdmin()
    await chargesService.deleteExpense(id)

    revalidatePath('/charges')
    revalidatePath('/charges/expenses')

    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la suppression' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── CNAPS - Configuration ────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getCnapsSettingsAction() {
  try {
    await requireAdmin()
    const settings = await chargesService.getCnapsSettings()
    return { success: true, settings }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

export async function updateCnapsSettingsAction(data: {
  cnapsEnabled: boolean
  cnapsEmployeeRate: number
  cnapsEmployerRate: number
  cnapsCeiling: number
  ostieEnabled: boolean
  ostieRate: number
}) {
  try {
    await requireAdmin()
    const settings = await chargesService.updateCnapsSettings(data)

    revalidatePath('/charges')
    revalidatePath('/charges/cnaps')

    return { success: true, settings }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la mise à jour' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── CNAPS - Versement ───────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function payCnapsAction(data: {
  amount: number
  employeePart: number
  employerPart: number
  period: string
}) {
  try {
    await requireAdmin()

    const { createCnapsPaymentAccountingEntry } = await import('@/services/charges.service')
    const { prisma } = await import('@/lib/prisma')

    await createCnapsPaymentAccountingEntry(data, prisma)

    revalidatePath('/charges')
    revalidatePath('/charges/cnaps')
    revalidatePath('/dashboard')
    revalidatePath('/accounting/journal')

    return { success: true }
  } catch (e: any) {
    console.error('Erreur versement CNaPS:', e)
    return { error: e.message ?? 'Erreur lors du versement CNaPS' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── STATISTIQUES ─────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getChargesDashboardStatsAction(year: number, month: number) {
  try {
    await requireAdmin()
    const stats = await chargesService.getChargesDashboardStats(year, month)
    return { success: true, stats }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement' }
  }
}