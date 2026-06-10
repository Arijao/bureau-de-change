'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth'
import type { JournalFilters, LedgerFilters } from '@/lib/types'
import {
  ensureChartOfAccounts,
  getChartOfAccounts,
  getJournal,
  getLedger,
  getTrialBalance,
  generateJournalEntryFromTransaction,
  deleteJournalEntryForTransaction,
  getJournalEntryById,
} from '@/services/accounting.service'

// ... (le reste du fichier reste inchangé)

// ═══════════════════════════════════════════════════════════
// ── INITIALISATION ──────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Initialise le plan comptable de base (admin uniquement).
 */
export async function initChartOfAccountsAction() {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Accès refusé — Admin uniquement' }
  }

  try {
    await ensureChartOfAccounts()
    revalidatePath('/accounting')
    return { success: true, message: 'Plan comptable initialisé' }
  } catch (e: any) {
    return { error: e.message ?? "Erreur lors de l'initialisation" }
  }
}

/**
 * Récupère tous les comptes du plan comptable.
 */
export async function getChartOfAccountsAction() {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }

  try {
    const accounts = await getChartOfAccounts()
    return { success: true, accounts }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── LECTURE ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Récupère le journal général avec filtres.
 */
export async function getJournalAction(filters: JournalFilters = {}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }

  try {
    const result = await getJournal(filters)
    return { success: true, ...result }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement du journal' }
  }
}

/**
 * Récupère le grand livre d'un compte.
 */
export async function getLedgerAction(accountId: number, filters: LedgerFilters = {}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }

  try {
    const result = await getLedger(accountId, filters)
    return { success: true, ...result }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement du grand livre' }
  }
}

/**
 * Récupère la balance générale sur une période.
 */
export async function getTrialBalanceAction(dateFrom?: string, dateTo?: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }

  try {
    const result = await getTrialBalance(dateFrom, dateTo)
    return { success: true, ...result }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement de la balance' }
  }
}

/**
 * Récupère une écriture comptable par ID.
 */
export async function getJournalEntryByIdAction(id: number) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }

  try {
    const entry = await getJournalEntryById(id)
    if (!entry) return { error: 'Écriture introuvable' }
    return { success: true, entry }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── GÉNÉRATION D'ÉCRITURES ──────────────────────────────
// ═══════════════════════════════════════════════════════════

/**
 * Génère une écriture comptable pour une transaction donnée.
 * Peut être appelé manuellement depuis l'interface.
 */
export async function generateJournalEntryAction(transactionId: string) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Accès refusé — Admin uniquement' }
  }

  try {
    const entry = await generateJournalEntryFromTransaction(transactionId)
    revalidatePath('/accounting')
    revalidatePath('/transactions')
    return { success: true, entry }
  } catch (e: any) {
    return { error: e.message ?? "Erreur lors de la génération de l'écriture" }
  }
}

/**
 * Supprime l'écriture comptable liée à une transaction.
 */
export async function deleteJournalEntryAction(transactionId: string) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return { error: 'Accès refusé — Admin uniquement' }
  }

  try {
    await deleteJournalEntryForTransaction(transactionId)
    revalidatePath('/accounting')
    revalidatePath('/transactions')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? "Erreur lors de la suppression de l'écriture" }
  }
}