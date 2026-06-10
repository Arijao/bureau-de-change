'use server'
import { revalidatePath } from 'next/cache'
import { getSessionUser, verifyAdminCredentials } from '@/lib/auth'
import { createTransaction, deleteTransaction, updateTransaction, type TransactionType } from '@/services/transaction.service'
import { prisma } from '@/lib/prisma'
import { saveAttestation, getAttestations, type SaveAttestationInput, type AttestationFilters } from '@/services/attestation.service'
import { getSettings } from '@/services/settings.service'

// [CORRECTION] Ajout du champ 'details' dans la signature
export async function createTransactionAction(data: {
  type: TransactionType
  currencyId: number
  amount: number
  commission?: number
  note?: string
  overrideRate?: number
  details?: Array<{
    categoryName: string
    denomination: number
    quantity: number
    rateApplied: number
    subtotalAmount: number
    subtotalMGA: number
  }>
}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const tx = await createTransaction({ ...data, userId: user.id })
    revalidatePath('/dashboard')
    revalidatePath('/transactions')
    revalidatePath('/currencies')
    revalidatePath('/stock')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/ledger')
    revalidatePath('/accounting/balance')
    return { success: true, transaction: tx }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la transaction' }
  }
}

export async function deleteTransactionAction(transactionId: string) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé — Admin uniquement' }
  try {
    await deleteTransaction(transactionId, user.id)
    revalidatePath('/transactions')
    revalidatePath('/dashboard')
    revalidatePath('/stock')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/ledger')
    revalidatePath('/accounting/balance')
    return { success: true }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la suppression' }
  }
}

export async function updateTransactionAction(
  transactionId: string,
  data: { amount: number; rate: number; commission: number; note?: string }
) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé — Admin uniquement' }
  if (data.amount <= 0) return { error: 'Le montant doit être positif' }
  if (data.rate <= 0) return { error: 'Le taux doit être positif' }
  if (data.commission < 0) return { error: 'La commission ne peut pas être négative' }
  try {
    const tx = await updateTransaction(transactionId, data, user.id)
    revalidatePath('/transactions')
    revalidatePath('/dashboard')
    revalidatePath('/stock')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/ledger')
    revalidatePath('/accounting/balance')
    return { success: true, transaction: tx }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la modification' }
  }
}

// ── ADMIN OVERRIDE (depuis poste caissier) ───────────────────────────────────
export async function deleteTransactionWithOverrideAction(
  transactionId: string,
  adminUsername: string,
  adminPassword: string
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { error: 'Non authentifié' }
  const admin = await verifyAdminCredentials(adminUsername, adminPassword)
  if (!admin) return { error: 'Identifiants admin incorrects' }
  try {
    await deleteTransaction(transactionId, admin.id)
    await prisma.operationLog.create({
      data: {
        action: 'TX_DELETE_OVERRIDE',
        entity: 'Transaction',
        entityId: transactionId,
        userId: admin.id,
        detail: JSON.stringify({
          performedBy: sessionUser.name,
          performedByRole: sessionUser.role,
          validatedByAdmin: admin.name,
          poste: 'caissier-override',
        }),
      },
    }).catch(() => { })
    revalidatePath('/transactions')
    revalidatePath('/dashboard')
    revalidatePath('/stock')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/ledger')
    revalidatePath('/accounting/balance')
    return { success: true, adminName: admin.name }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la suppression' }
  }
}

export async function updateTransactionWithOverrideAction(
  transactionId: string,
  data: { amount: number; rate: number; commission: number; note?: string },
  adminUsername: string,
  adminPassword: string
) {
  const sessionUser = await getSessionUser()
  if (!sessionUser) return { error: 'Non authentifié' }
  if (data.amount <= 0) return { error: 'Le montant doit être positif' }
  if (data.rate <= 0) return { error: 'Le taux doit être positif' }
  if (data.commission < 0) return { error: 'La commission ne peut pas être négative' }
  const admin = await verifyAdminCredentials(adminUsername, adminPassword)
  if (!admin) return { error: 'Identifiants admin incorrects' }
  try {
    const tx = await updateTransaction(transactionId, data, admin.id)
    await prisma.operationLog.create({
      data: {
        action: 'TX_EDIT_OVERRIDE',
        entity: 'Transaction',
        entityId: transactionId,
        userId: admin.id,
        detail: JSON.stringify({
          performedBy: sessionUser.name,
          performedByRole: sessionUser.role,
          validatedByAdmin: admin.name,
          changes: data,
          poste: 'caissier-override',
        }),
      },
    }).catch(() => { })
    revalidatePath('/transactions')
    revalidatePath('/dashboard')
    revalidatePath('/stock')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/ledger')
    revalidatePath('/accounting/balance')
    return { success: true, transaction: tx, adminName: admin.name }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la modification' }
  }
}

// ── ARCHIVAGE ATTESTATION ─────────────────────────────────────────────────────
export async function saveAttestationAction(input: SaveAttestationInput) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const settings = await getSettings()
    const attestation = await saveAttestation(
      { ...input, createdBy: user.id },
      settings.bureauName,
      settings.bureauPrefix,
    )
    return { success: true, attestation }
  } catch (e: any) {
    return { error: e.message ?? "Erreur lors de l'archivage de l'attestation" }
  }
}

export async function getAttestationsAction(filters: AttestationFilters = {}) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const result = await getAttestations(filters)
    return { success: true, ...result }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la récupération des attestations' }
  }
}

export async function getAttestationByTransactionIdAction(transactionId: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const { getAttestationByTransactionId } = await import('@/services/attestation.service')
    const attestation = await getAttestationByTransactionId(transactionId)
    return { success: true, attestation }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la récupération' }
  }
}

export async function updateAttestationAction(
  id: string,
  data: SaveAttestationInput,
) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const { updateAttestation } = await import('@/services/attestation.service')
    const attestation = await updateAttestation(id, data)
    revalidatePath('/transactions/attestations')
    return { success: true, attestation }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la mise à jour' }
  }
}