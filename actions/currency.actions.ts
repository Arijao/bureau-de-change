'use server'
import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth'
import { createCurrency, updateCurrency, toggleCurrency, deleteCurrency } from '@/services/currency.service'
import { addRate } from '@/services/exchange-rate.service'
import { adjustStock } from '@/services/stock.service'

export async function createCurrencyAction(data: {
  code: string; name: string; symbol?: string; flag?: string
  buyRate: number; sellRate: number; initialStock?: number; alertLevel?: number
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    const currency = await createCurrency({ ...data, userId: user.id })
    revalidatePath('/currencies'); revalidatePath('/dashboard')
    return { success: true, currency }
  } catch (e: any) { return { error: e.message ?? 'Erreur' } }
}

export async function updateCurrencyAction(id: number, data: { name?: string; symbol?: string; flag?: string }) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    await updateCurrency(id, { ...data, userId: user.id })
    revalidatePath('/currencies')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function toggleCurrencyAction(id: number) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    await toggleCurrency(id, user.id)
    revalidatePath('/currencies'); revalidatePath('/transactions/new')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function deleteCurrencyAction(id: number) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    await deleteCurrency(id, user.id)
    revalidatePath('/currencies')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function addRateAction(data: {
  currencyId: number; buyRate: number; sellRate: number; note?: string;
  categoryRates?: Array<{ categoryId: number; buyRate: number }>
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    await addRate({ ...data, userId: user.id })
    revalidatePath('/currencies'); revalidatePath('/transactions/new'); revalidatePath('/dashboard')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function updateDenominationCategoriesAction(currencyId: number, categories: Array<{ id?: number; name: string; denominations: string }>) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    const { prisma } = await import('@/lib/prisma')
    await prisma.$transaction(async (client) => {
      // Désactiver toutes les catégories existantes non incluses
      const keepIds = categories.filter(c => c.id).map(c => c.id as number)
      await client.denominationCategory.updateMany({
        where: { currencyId, id: { notIn: keepIds } },
        data: { active: false },
      })
      // Upsert des catégories
      for (const cat of categories) {
        if (cat.id) {
          await client.denominationCategory.update({
            where: { id: cat.id },
            data: { name: cat.name, denominations: cat.denominations, active: true },
          })
        } else {
          await client.denominationCategory.create({
            data: { currencyId, name: cat.name, denominations: cat.denominations, active: true },
          })
        }
      }
    })
    revalidatePath('/currencies'); revalidatePath('/transactions/new')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function adjustStockAction(data: {
  currencyId: number; operation: 'DEPOT' | 'RETRAIT' | 'AJUSTEMENT'; amount: number; note?: string
}) {
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') return { error: 'Accès refusé' }
  try {
    await adjustStock({ ...data, userId: user.id })
    revalidatePath('/currencies'); revalidatePath('/stock'); revalidatePath('/transactions/new')
    return { success: true }
  } catch (e: any) { return { error: e.message } }
}

export async function getPhysicalDenominationsAction(currencyId: number) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const { getCurrentPhysicalDenominations } = await import('@/services/stock.service')
    const result = await getCurrentPhysicalDenominations(currencyId)
    return { success: true, ...result }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la récupération' }
  }
}

export async function getCashClosingReportAction(currencyId: number, dateStr: string) {
  const user = await getSessionUser()
  if (!user) return { error: 'Non authentifié' }
  try {
    const { getCashClosingReport } = await import('@/services/stock.service')
    const data = await getCashClosingReport(currencyId, dateStr)
    return { success: true, ...data }
  } catch (e: any) {
    return { error: e.message ?? 'Erreur lors de la génération du rapport' }
  }
}