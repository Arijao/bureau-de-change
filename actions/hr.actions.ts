'use server'

import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import * as hrService from '@/services/hr.service'
import type { AdvanceStatus } from '@/lib/types'


// Helper pour vérifier les droits admin
async function requireAdmin() {
  const user = await getSessionUser()
  if (!user) throw new Error('Non authentifié')
  if (user.role !== 'ADMIN') throw new Error('Accès refusé — Admin uniquement')
  return user
}

// ═══════════════════════════════════════════════════════════
// ── EMPLOYÉS ────────────────────────────────────────────
// ══════════════════════════════════════════════════════════

export async function createEmployeeAction(data: Parameters<typeof hrService.createEmployee>[0]) {
  try {
    await requireAdmin()
    const employee = await hrService.createEmployee(data)
    revalidatePath('/hr')
    revalidatePath('/hr/employees')
    return { success: true, employee }
  } catch (e: any) {
    console.error('[createEmployeeAction] Erreur:', e)
    
    // Messages utilisateur-friendly
    if (e.message?.includes('CIN existe déjà')) {
      return { error: 'Un employé avec ce numéro CIN existe déjà. Veuillez vérifier le numéro saisi ou utiliser un numéro différent.' }
    }
    
    if (e.message?.includes('Unique constraint')) {
      return { error: 'Cette valeur est déjà utilisée par un autre employé. Veuillez modifier la saisie.' }
    }
    
    return { error: e.message ?? 'Erreur lors de la création' }
  }
}

export async function getEmployeesAction(includeInactive = false) {
  try {
    await requireAdmin()
    const employees = await hrService.getEmployees(includeInactive)
    return { success: true, employees }
  } catch (e: any) {
    console.error('[getEmployeesAction] Erreur:', e)
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

export async function getEmployeeByIdAction(id: number) {
  try {
    await requireAdmin()
    const employee = await hrService.getEmployeeById(id)
    if (!employee) return { error: 'Employé introuvable' }
    return { success: true, employee }
  } catch (e: any) {
    console.error('[getEmployeeByIdAction] Erreur:', e)
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

export async function updateEmployeeAction(id: number, data: Parameters<typeof hrService.updateEmployee>[1]) {
  try {
    await requireAdmin()
    const employee = await hrService.updateEmployee(id, data)
    revalidatePath('/hr')
    revalidatePath('/hr/employees')
    return { success: true, employee }
  } catch (e: any) {
    console.error('[updateEmployeeAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la modification' }
  }
}

export async function deactivateEmployeeAction(id: number) {
  try {
    await requireAdmin()
    await hrService.deactivateEmployee(id)
    revalidatePath('/hr')
    revalidatePath('/hr/employees')
    return { success: true }
  } catch (e: any) {
    console.error('[deactivateEmployeeAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la désactivation' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── POINTAGE ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function recordAttendanceAction(data: Parameters<typeof hrService.recordAttendance>[0]) {
  try {
    await requireAdmin()
    const attendance = await hrService.recordAttendance(data)
    revalidatePath('/hr/attendance')
    return { success: true, attendance }
  } catch (e: any) {
    console.error('[recordAttendanceAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors du pointage' }
  }
}

export async function getAttendanceReportAction(employeeId: number, dateFrom: string, dateTo: string) {
  try {
    await requireAdmin()
    const report = await hrService.getAttendanceReport(employeeId, new Date(dateFrom), new Date(dateTo))
    return { success: true, report }
  } catch (e: any) {
    console.error('[getAttendanceReportAction] Erreur:', e)
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

// ═══════════════════════════════════════════════════════════
// ─ AVANCES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function requestAdvanceAction(data: Parameters<typeof hrService.requestAdvance>[0]) {
  try {
    await requireAdmin()
    const advance = await hrService.requestAdvance(data)
    revalidatePath('/hr/advances')
    return { success: true, advance }
  } catch (e: any) {
    console.error('[requestAdvanceAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la demande' }
  }
}

export async function updateAdvanceStatusAction(id: number, status: AdvanceStatus) {
  try {
    await requireAdmin()
    
    const advance = await prisma.advance.update({
      where: { id },
      data: { status },
      include: { employee: true },
    })

    // Si l'avance est approuvée, créer l'écriture comptable et décrémenter la caisse
    if (status === 'APPROVED') {
      const { createAdvanceAccountingEntry } = await import('@/services/hr.service')
      await createAdvanceAccountingEntry(id, prisma)
    }

    revalidatePath('/hr/advances')
    revalidatePath('/dashboard')
    revalidatePath('/accounting/journal')
    
    return { success: true, advance }
  } catch (e: any) {
    console.error('[updateAdvanceStatusAction] Erreur:', e)
    
    // Messages d'erreur utilisateur-friendly
    if (e.message?.includes('Stock MGA insuffisant')) {
      return { error: 'Le stock de caisse MGA est insuffisant pour accorder cette avance.' }
    }
    
    return { error: e.message ?? 'Erreur lors de la mise à jour' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── SANCTIONS ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function addSanctionAction(data: Parameters<typeof hrService.addSanction>[0]) {
  try {
    await requireAdmin()
    const sanction = await hrService.addSanction(data)
    revalidatePath('/hr/sanctions')
    return { success: true, sanction }
  } catch (e: any) {
    console.error('[addSanctionAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de l\'ajout' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── CONGÉS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function requestLeaveAction(data: Parameters<typeof hrService.requestLeave>[0]) {
  try {
    await requireAdmin()
    const leave = await hrService.requestLeave(data)
    revalidatePath('/hr/leaves')
    return { success: true, leave }
  } catch (e: any) {
    console.error('[requestLeaveAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la demande' }
  }
}

export async function updateLeaveStatusAction(id: number, status: Parameters<typeof hrService.updateLeaveStatus>[1]) {
  try {
    await requireAdmin()
    const leave = await hrService.updateLeaveStatus(id, status)
    revalidatePath('/hr/leaves')
    return { success: true, leave }
  } catch (e: any) {
    console.error('[updateLeaveStatusAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la mise à jour' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── PAIE ────────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function generateSalaryAction(data: Parameters<typeof hrService.generateSalary>[0]) {
  try {
    await requireAdmin()
    
    // Validation stricte des types
    if (!data.employeeId || data.employeeId <= 0) {
      return { error: 'Veuillez sélectionner un employé valide.' }
    }
    
    if (typeof data.month !== 'number' || isNaN(data.month) || data.month < 1 || data.month > 12) {
      console.error('[generateSalaryAction] Mois invalide:', data.month, typeof data.month)
      return { error: 'Le mois sélectionné est invalide. Veuillez recharger la page et réessayer.' }
    }
    
    if (typeof data.year !== 'number' || isNaN(data.year) || data.year < 2020 || data.year > 2100) {
      console.error('[generateSalaryAction] Année invalide:', data.year, typeof data.year)
      return { error: 'L\'année sélectionnée est invalide. Veuillez recharger la page et réessayer.' }
    }
    
    console.log(`[generateSalaryAction] Génération bulletin - Employé: ${data.employeeId}, Mois: ${data.month}, Année: ${data.year}`)
    
    const salary = await hrService.generateSalary(data)
    
    console.log(`[generateSalaryAction] ✅ Bulletin créé ID: ${salary.id}`)
    
    revalidatePath('/hr/salary')
    return { success: true, salary }
  } catch (e: any) {
    console.error('[generateSalaryAction] Erreur détaillée:', e)
    
    // Messages d'erreur utilisateur-friendly
    if (e.message?.includes('déjà')) {
      return { error: 'Un bulletin existe déjà pour cet employé ce mois-ci.' }
    }
    
    if (e.message?.includes('Employé introuvable')) {
      return { error: 'L\'employé sélectionné n\'existe plus.' }
    }
    
    if (e.message?.includes('Employé inactif')) {
      return { error: 'Cet employé est inactif et ne peut pas recevoir de salaire.' }
    }
    
    if (e.message?.includes('Invalid value') && e.message?.includes('month')) {
      console.error('[generateSalaryAction] Erreur de type mois:', e.message)
      return { error: 'Le mois sélectionné est invalide. Veuillez recharger la page et réessayer.' }
    }
    
    if (e.message?.includes('Invalid value') && e.message?.includes('year')) {
      console.error('[generateSalaryAction] Erreur de type année:', e.message)
      return { error: 'L\'année sélectionnée est invalide. Veuillez recharger la page et réessayer.' }
    }
    
    return { error: 'Le bulletin de salaire n\'a pas pu être généré. Veuillez vérifier les informations saisies et réessayer.' }
  }
}

export async function getSalariesAction(employeeId?: number, year?: number) {
  try {
    await requireAdmin()
    const salaries = await hrService.getSalaries(employeeId, year)
    return { success: true, salaries }
  } catch (e: any) {
    console.error('[getSalariesAction] Erreur:', e)
    return { error: e.message ?? 'Erreur de chargement' }
  }
}

export async function markSalaryAsPaidAction(id: number) {
  try {
    await requireAdmin()
    console.log(`[markSalaryAsPaidAction] Début marquage salaire ID: ${id}`)

    // Importer les fonctions nécessaires
    const { updateCashStockForSalary, clearAdvanceOnSalaryPayment, generateSalaryAccountingEntry } = await import('@/services/hr.service')

    // 1. Marquer comme payé EN PREMIER (requis par generateSalaryAccountingEntry)
    console.log(`[markSalaryAsPaidAction] Étape 1: Marquer comme payé`)
    const salary = await prisma.salary.update({
      where: { id },
      data: { paidAt: new Date() },
    })

    try {
      // 2. GÉNÉRER L'ÉCRITURE COMPTABLE
      console.log(`[markSalaryAsPaidAction] Étape 2: Génération écriture comptable`)
      await generateSalaryAccountingEntry(id, prisma)

      // 3. Mettre à jour le stock de caisse MGA
      console.log(`[markSalaryAsPaidAction] Étape 3: Mise à jour stock MGA`)
      await updateCashStockForSalary(id, prisma)

      // 4. Solder les avances si présentes
      console.log(`[markSalaryAsPaidAction] Étape 4: Solder avances`)
      await clearAdvanceOnSalaryPayment(id, prisma)

      console.log(`[markSalaryAsPaidAction] ✅ Terminé avec succès`)
    } catch (error) {
      // [CORRECTION] Si une étape échoue, annuler le marquage comme payé
      console.error(`[markSalaryAsPaidAction] ❌ Erreur, annulation du marquage:`, error)
      await prisma.salary.update({
        where: { id },
        data: { paidAt: null },
      })
      throw error
    }

    revalidatePath('/hr/salary')
    revalidatePath('/dashboard')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/balance')

    return { success: true }
  } catch (e: any) {
    console.error(`[markSalaryAsPaidAction] ❌ Erreur: ${e.message}`)
    console.error(e)
    // Messages d'erreur utilisateur-friendly
    if (e.message?.includes('Stock MGA insuffisant')) {
      return { error: 'Le stock de caisse MGA est insuffisant pour payer ce salaire.' }
    }

    if (e.message?.includes('Déséquilibre')) {
      return { error: 'Erreur comptable détectée. Veuillez contacter l\'administrateur.' }
    }

    return { error: 'Le salaire n\'a pas pu être marqué comme payé. Veuillez réessayer.' }
  }
}

export async function deleteSalaryAction(id: number) {
  try {
    await requireAdmin()
    
    const salary = await prisma.salary.findUnique({ where: { id } })
    if (!salary) throw new Error('Bulletin introuvable')
    
    // On autorise la suppression même si payé (pour corriger une erreur)
    // La vérification se fait côté UI via confirm()
    
    await prisma.salary.delete({ where: { id } })
    revalidatePath('/hr/salary')
    return { success: true }
  } catch (e: any) {
    console.error('[deleteSalaryAction] Erreur:', e)
    return { error: e.message ?? 'Erreur lors de la suppression' }
  }
}

export async function generateSalaryAccountingEntryAction(salaryId: number) {
  try {
    await requireAdmin()
    
    const { generateSalaryAccountingEntry } = await import('@/services/hr.service')
    await generateSalaryAccountingEntry(salaryId, prisma)
    
    revalidatePath('/hr/salary')
    revalidatePath('/accounting/journal')
    revalidatePath('/accounting/balance')
    
    return { success: true }
  } catch (e: any) {
    console.error('[generateSalaryAccountingEntryAction] Erreur:', e)
    
    // Messages d'erreur utilisateur-friendly
    if (e.message?.includes('existe déjà')) {
      return { error: 'Une écriture comptable existe déjà pour ce bulletin.' }
    }
    
    if (e.message?.includes('Déséquilibre')) {
      return { error: 'Erreur comptable détectée. Veuillez contacter l\'administrateur.' }
    }
    
    return { error: 'L\'écriture comptable n\'a pas pu être générée. Veuillez réessayer.' }
  }
}

// ═══════════════════════════════════════════════════════════
// ── DASHBOARD ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getHrDashboardStatsAction() {
  try {
    await requireAdmin()
    const stats = await hrService.getHrDashboardStats()
    return { success: true, stats }
  } catch (e: any) {
    console.error('[getHrDashboardStatsAction] Erreur:', e)
    return { error: e.message ?? 'Erreur de chargement' }
  }
}