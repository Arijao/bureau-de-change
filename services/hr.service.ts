/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@/lib/prisma'
import type {
  AttendanceStatus,
  AdvanceStatus,
  SanctionType,
  LeaveType,
  LeaveStatus,
  HrDashboardStats,
} from '@/lib/types'

// ═══════════════════════════════════════════════════════════
// ── EMPLOYÉS ────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function createEmployee(data: {
  firstName: string
  lastName: string
  cin?: string
  phone?: string
  email?: string
  address?: string         
  sex?: string         
  maritalStatus?: string   
  numberOfChildren?: number
  department?: string
  position?: string
  bankAccount?: string
  baseSalary: number
  userId?: string
}) {
  // Vérifier l'unicité du CIN si fourni
  if (data.cin) {
    const existing = await prisma.employee.findUnique({ where: { cin: data.cin } })
    if (existing) throw new Error('Un employé avec ce CIN existe déjà')
  }

  return prisma.employee.create({
    data: {
      ...data,
      hiredAt: new Date(),
      active: true,
    },
    include: { user: { select: { name: true, username: true } } },
  })
}

export async function getEmployees(includeInactive = false) {
  return prisma.employee.findMany({
    where: includeInactive ? {} : { active: true },
    include: { user: { select: { name: true, username: true } } },
    orderBy: { lastName: 'asc' },
  })
}

export async function getEmployeeById(id: number) {
  return prisma.employee.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, username: true } },
      attendances: { orderBy: { date: 'desc' }, take: 10 },
      advances: { where: { status: { in: ['PENDING', 'APPROVED'] } }, orderBy: { date: 'desc' } },
      sanctions: { orderBy: { date: 'desc' }, take: 10 },
      leaves: { orderBy: { createdAt: 'desc' }, take: 10 },
    },
  })
}

export async function updateEmployee(id: number, data: Partial<{
  firstName: string
  lastName: string
  cin: string
  phone: string
  email: string
  address: string        
  sex: string             
  maritalStatus: string    
  numberOfChildren: number
  department: string
  position: string
  bankAccount: string
  baseSalary: number
}>) {
  if (data.cin) {
    const existing = await prisma.employee.findFirst({
      where: { cin: data.cin, NOT: { id } },
    })
    if (existing) throw new Error('Un autre employé avec ce CIN existe déjà')
  }

  return prisma.employee.update({
    where: { id },
    data,
    include: { user: { select: { name: true, username: true } } },
  })
}

export async function deactivateEmployee(id: number) {
  return prisma.employee.update({
    where: { id },
    data: { active: false },
  })
}

// ═══════════════════════════════════════════════════════════
// ── POINTAGE (ATTENDANCE) ───────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function recordAttendance(data: {
  employeeId: number
  date: Date
  checkIn?: Date
  checkOut?: Date
  status: AttendanceStatus
  note?: string
}) {
  // Vérifier si un pointage existe déjà pour ce jour
  const startOfDay = new Date(data.date)
  startOfDay.setHours(0, 0, 0, 0)
  const endOfDay = new Date(data.date)
  endOfDay.setHours(23, 59, 59, 999)

  const existing = await prisma.attendance.findFirst({
    where: {
      employeeId: data.employeeId,
      date: { gte: startOfDay, lte: endOfDay },
    },
  })

  if (existing) {
    // Mise à jour si existe (ex: ajout du checkOut)
    const hours = data.checkIn && data.checkOut 
      ? (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60)
      : existing.hours

    return prisma.attendance.update({
      where: { id: existing.id },
      data: {
        checkIn: data.checkIn ?? existing.checkIn,
        checkOut: data.checkOut ?? existing.checkOut,
        hours,
        status: data.status,
        note: data.note ?? existing.note,
      },
    })
  }

  // Création
  const hours = data.checkIn && data.checkOut
    ? (data.checkOut.getTime() - data.checkIn.getTime()) / (1000 * 60 * 60)
    : null

  return prisma.attendance.create({
    data: {
      employeeId: data.employeeId,
      date: data.date,
      checkIn: data.checkIn,
      checkOut: data.checkOut,
      hours,
      status: data.status,
      note: data.note,
    },
  })
}

export async function getAttendanceReport(employeeId: number, dateFrom: Date, dateTo: Date) {
  return prisma.attendance.findMany({
    where: {
      employeeId,
      date: { gte: dateFrom, lte: dateTo },
    },
    orderBy: { date: 'desc' },
  })
}

// ═══════════════════════════════════════════════════════════
// ── AVANCES ─────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function requestAdvance(data: {
  employeeId: number
  amount: number
  note?: string
}) {
  if (data.amount <= 0) throw new Error('Le montant doit être positif')
  
  return prisma.advance.create({
    data: {
      employeeId: data.employeeId,
      amount: data.amount,
      status: 'PENDING',
      note: data.note,
    },
  })
}

export async function updateAdvanceStatus(id: number, status: AdvanceStatus) {
  return prisma.advance.update({
    where: { id },
    data: { status },
  })
}

export async function getEmployeeAdvances(employeeId: number) {
  return prisma.advance.findMany({
    where: { employeeId },
    orderBy: { date: 'desc' },
  })
}

/**
 * Génère une écriture comptable lors de l'approbation d'une avance.
 * 
 * Écriture :
 * - Débit : 425000 (Avances sur salaire - Actif)
 * - Crédit : 530000 (Caisse MGA)
 * 
 * Met également à jour le stock de caisse MGA.
 */
export async function createAdvanceAccountingEntry(advanceId: number, prismaClient: typeof prisma) {
  const advance = await prismaClient.advance.findUnique({
    where: { id: advanceId },
    include: { employee: true },
  })

  if (!advance) throw new Error('Avance introuvable')
  if (advance.status !== 'APPROVED') throw new Error('L\'avance doit être approuvée')

  // Vérifier si une écriture existe déjà
  const existingEntry = await prismaClient.journalEntry.findFirst({
    where: {
      description: { contains: `Avance sur salaire - ${advance.employee.firstName} ${advance.employee.lastName}` },
    },
  })

  if (existingEntry) {
    throw new Error('Une écriture comptable existe déjà pour cette avance')
  }

  // Auto-création des comptes RH si manquants
  const { ensureHrAccounts } = await import('@/services/accounting.service')
  await ensureHrAccounts()

  // Récupérer les comptes
  const advanceAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '425000' },
  })
  if (!advanceAccount) {
    throw new Error('Compte 425000 (Avances sur salaire) introuvable après auto-création.')
  }
  const mgaCashAccount = await prismaClient.ledgerAccount.findUnique({
    where: { code: '530000' },
  })
  if (!mgaCashAccount) {
    throw new Error('Compte 530000 (Caisse MGA) introuvable')
  }

  // Récupérer le stock MGA
  const mgaStock = await prismaClient.cashStock.findUnique({
    where: { currencyId: mgaCashAccount.id },
  })

  if (!mgaStock) throw new Error('Stock MGA introuvable')

  // Vérifier le solde suffisant
  if (mgaStock.amount < advance.amount) {
    throw new Error(
      `Stock MGA insuffisant pour accorder l'avance. ` +
      `Disponible: ${mgaStock.amount.toFixed(2)} Ar, ` +
      `Requis: ${advance.amount.toFixed(2)} Ar`
    )
  }

  // Créer l'écriture comptable
  await prismaClient.journalEntry.create({
    data: {
      date: advance.date,
      description: `Avance sur salaire - ${advance.employee.firstName} ${advance.employee.lastName}`,
      reference: `ADV-${advance.id}`,
      lines: {
        create: [
          {
            accountId: advanceAccount.id,
            debit: advance.amount,
            credit: 0,
            description: `Avance accordée à ${advance.employee.firstName} ${advance.employee.lastName}`,
          },
          {
            accountId: mgaCashAccount.id,
            debit: 0,
            credit: advance.amount,
            description: `Sortie de caisse - Avance ${advance.employee.firstName} ${advance.employee.lastName}`,
          },
        ],
      },
    },
  })

  // Décrémenter le stock de caisse
  await prismaClient.cashStock.update({
    where: { id: mgaStock.id },
    data: { amount: mgaStock.amount - advance.amount },
  })

  // Créer un log de mouvement
  await prismaClient.stockLog.create({
    data: {
      stockId: mgaStock.id,
      operation: 'RETRAIT',
      delta: -advance.amount,
      balanceBefore: mgaStock.amount,
      balanceAfter: mgaStock.amount - advance.amount,
      note: `Avance sur salaire ${advance.employee.firstName} ${advance.employee.lastName} - Réf: ADV-${advance.id}`,
      transactionId: null,
    },
  })
}

// ═══════════════════════════════════════════════════════════
// ─ SANCTIONS ───────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function addSanction(data: {
  employeeId: number
  type: SanctionType
  amount: number
  reason: string
  note?: string
}) {
  if (data.type === 'FINANCIAL' && data.amount <= 0) {
    throw new Error('Le montant doit être positif pour une sanction financière')
  }

  return prisma.sanction.create({
    data: {
      employeeId: data.employeeId,
      type: data.type,
      amount: data.type === 'FINANCIAL' ? data.amount : 0,
      reason: data.reason,
      note: data.note,
    },
  })
}

export async function getEmployeeSanctions(employeeId: number) {
  return prisma.sanction.findMany({
    where: { employeeId },
    orderBy: { date: 'desc' },
  })
}

// ═══════════════════════════════════════════════════════════
// ── CONGÉS ──────────────────────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function requestLeave(data: {
  employeeId: number
  type: LeaveType
  startDate: Date
  endDate: Date
  note?: string
}) {
  if (data.endDate < data.startDate) {
    throw new Error('La date de fin doit être postérieure à la date de début')
  }

  const diffTime = Math.abs(data.endDate.getTime() - data.startDate.getTime())
  const days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1 // +1 pour inclure le jour de début

  return prisma.leave.create({
    data: {
      employeeId: data.employeeId,
      type: data.type,
      startDate: data.startDate,
      endDate: data.endDate,
      days,
      status: 'PENDING',
      note: data.note,
    },
  })
}

export async function updateLeaveStatus(id: number, status: LeaveStatus) {
  return prisma.leave.update({
    where: { id },
    data: { status },
  })
}

export async function getEmployeeLeaves(employeeId: number) {
  return prisma.leave.findMany({
    where: { employeeId },
    orderBy: { startDate: 'desc' },
  })
}

// ═══════════════════════════════════════════════════════════
// ── PAIE (SALARY) ───────────────────────────────────────
// ══════════════════════════════════════════════════════════
/**
 * Calcule et génère le bulletin de salaire pour un employé sur un mois donné.
 * Intègre automatiquement les avances à déduire, les sanctions financières 
 * et les retenues pour congés sans solde.
 */
export async function generateSalary(data: {
  employeeId: number
  month: number
  year: number
  bonuses?: number
  manualDeductions?: number
  note?: string
}) {
  const employee = await prisma.employee.findUnique({ where: { id: data.employeeId } })
  if (!employee) throw new Error('Employé introuvable')
  if (!employee.active) throw new Error('Employé inactif')

  // Vérifier si le salaire existe déjà
  const existing = await prisma.salary.findFirst({
    where: { employeeId: data.employeeId, month: data.month, year: data.year },
  })
  if (existing) throw new Error('Un bulletin existe déjà pour ce mois')

  const startOfMonth = new Date(data.year, data.month - 1, 1)
  const endOfMonth = new Date(data.year, data.month, 0, 23, 59, 59)

  // ═══════════════════════════════════════════════════════════
  // NOUVEAU : GESTION DES CONGÉS ET ABSENCES
  // ═══════════════════════════════════════════════════════════
  // 1. Récupérer les congés approuvés qui chevauchent le mois de paie
  const approvedLeaves = await prisma.leave.findMany({
    where: {
      employeeId: data.employeeId,
      status: 'APPROVED',
      startDate: { lte: endOfMonth },
      endDate: { gte: startOfMonth },
    },
  })

  // 2. Calculer la retenue sur salaire
  // Standard : 26 jours ouvrables par mois (adaptable si votre convention utilise 30 jours calendaires)
  const WORKING_DAYS_PER_MONTH = 26 
  const dailyRate = employee.baseSalary / WORKING_DAYS_PER_MONTH
  let leaveDeduction = 0

  for (const leave of approvedLeaves) {
    // Calculer les jours effectifs du congé qui tombent dans CE mois précis
    const effectiveStart = leave.startDate < startOfMonth ? startOfMonth : leave.startDate
    const effectiveEnd = leave.endDate > endOfMonth ? endOfMonth : leave.endDate
    
    if (effectiveStart <= effectiveEnd) {
      const daysInMonth = Math.ceil((effectiveEnd.getTime() - effectiveStart.getTime()) / (1000 * 60 * 60 * 24)) + 1
      
      if (leave.type === 'UNPAID') {
        leaveDeduction += daysInMonth * dailyRate
      } else if (leave.type === 'SICK') {
        // RÈGLE CONFIGURABLE : Par défaut, le congé maladie est intégralement payé (0% de retenue).
        // Si votre politique prévoit une retenue partielle (ex: 50%), adaptez ici :
        // leaveDeduction += daysInMonth * dailyRate * 0.5;
      }
      // 'PAID' ne génère aucune déduction
    }
  }
  // Arrondi à 2 décimales pour éviter les erreurs de flottants
  leaveDeduction = Math.round(leaveDeduction * 100) / 100
  // ═══════════════════════════════════════════════════════════
  // FIN GESTION DES CONGÉS
  // ═══════════════════════════════════════════════════════════

  // Le brut comptable reste le salaire théorique (pour l'affichage et l'écriture comptable)
  const grossSalary = employee.baseSalary + (data.bonuses ?? 0)

  // L'assiette de cotisation CNaPS est réduite des absences non rémunérées (logique légale)
  const cnapsBase = grossSalary - leaveDeduction
  const { calculateCnaps } = await import('@/services/charges.service')
  const cnaps = await calculateCnaps(cnapsBase)

  // 1. Calculer les déductions automatiques (avances approuvées non encore déduites)
  const advancesToDeduct = await prisma.advance.findMany({
    where: {
      employeeId: data.employeeId,
      status: 'APPROVED',
      date: { lte: endOfMonth },
    },
  })
  const totalAdvancesDeduction = advancesToDeduct.reduce((sum, a) => sum + a.amount, 0)

  // 2. Calculer les sanctions financières du mois
  const financialSanctions = await prisma.sanction.findMany({
    where: {
      employeeId: data.employeeId,
      type: 'FINANCIAL',
      date: { gte: startOfMonth, lte: endOfMonth },
    },
  })
  const totalSanctionsDeduction = financialSanctions.reduce((sum, s) => sum + s.amount, 0)

  // Calcul des déductions totales (CNaPS salariale + avances + sanctions + Retenue congé + déductions manuelles)
  const totalDeductions = cnaps.employee + totalAdvancesDeduction + totalSanctionsDeduction + leaveDeduction + (data.manualDeductions ?? 0)

  const netSalary = grossSalary - totalDeductions

  console.log(`[generateSalary] Brut: ${grossSalary}, CNaPS sal: ${cnaps.employee}, CNaPS patr: ${cnaps.employer}, Déductions: ${totalDeductions}, Net: ${netSalary}`)

  // 3. Créer le bulletin et marquer les avances comme déduites
  return prisma.$transaction(async (client) => {
    const salary = await client.salary.create({
      data: {
        employeeId: data.employeeId,
        month: data.month,
        year: data.year,
        baseSalary: employee.baseSalary,
        bonuses: data.bonuses ?? 0,
        deductions: totalDeductions,
        netSalary,
        cnapsEmployee: cnaps.employee,
        cnapsEmployer: cnaps.employer,
        leaveDeduction: leaveDeduction, // ⬅️ NOUVEAU : Sauvegarde de la retenue
        note: data.note,
      },
    })

    // Marquer les avances comme déduites
    if (advancesToDeduct.length > 0) {
      await client.advance.updateMany({
        where: { id: { in: advancesToDeduct.map(a => a.id) } },
        data: { status: 'DEDUCTED' },
      })
    }

    return salary
  })
}

export async function getSalaries(employeeId?: number, year?: number) {
  const where: any = {}
  if (employeeId) where.employeeId = employeeId
  if (year) where.year = year

  return prisma.salary.findMany({
    where,
    select: {
      id: true,
      employeeId: true,
      month: true,
      year: true,
      baseSalary: true,
      bonuses: true,
      deductions: true,
      netSalary: true,
      cnapsEmployee: true,  // NOUVEAU
      cnapsEmployer: true,  // NOUVEAU
      leaveDeduction: true,
      paidAt: true,
      note: true,
      createdAt: true,
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          position: true,
        },
      },
    },
    orderBy: [{ year: 'desc' }, { month: 'desc' }],
  })
}

export async function markSalaryAsPaid(id: number) {
  return prisma.salary.update({
    where: { id },
    data: { paidAt: new Date() },
  })
}

/**
 * Génère une écriture comptable pour un salaire payé.
 * 
 * PRINCIPE : Transaction atomique avec validation stricte de l'équilibre
 * 
 * Écriture attendue :
 * - Débit : 641000 (Charges de personnel) = brut complet
 * - Crédit : 425000 (Avances sur salaire) = total des avances
 * - Crédit : 530000 (Caisse MGA) = net réellement payé
 * 
 * Validation : Σ(Débits) DOIT ÊTRE ÉGAL À Σ(Crédits)
 */
export async function generateSalaryAccountingEntry(salaryId: number, prismaClient: typeof prisma): Promise<void> {
  return prismaClient.$transaction(async (tx) => {
    console.log(`[generateSalaryAccountingEntry] Début traitement salaire ID: ${salaryId}`)

    const salary = await tx.salary.findUnique({
      where: { id: salaryId },
      include: { employee: true },
    })

    if (!salary) throw new Error('Bulletin introuvable')

    const existingEntry = await tx.journalEntry.findFirst({
      where: {
        description: { contains: `Salaire ${salary.employee.firstName} ${salary.employee.lastName}` },
      },
    })

    if (existingEntry) {
      throw new Error('Une écriture comptable existe déjà pour ce bulletin')
    }

    // Auto-création des comptes RH si manquants
    const { ensureHrAccounts } = await import('@/services/accounting.service')
    await ensureHrAccounts()

    // Récupérer tous les comptes nécessaires
    const expenseAccount = await tx.ledgerAccount.findUnique({ where: { code: '641000' } })
    const socialChargeAccount = await tx.ledgerAccount.findUnique({ where: { code: '645100' } })
    const cnapsEmployeeAccount = await tx.ledgerAccount.findUnique({ where: { code: '424100' } })
    const cnapsEmployerAccount = await tx.ledgerAccount.findUnique({ where: { code: '424200' } })
    const mgaCashAccount = await tx.ledgerAccount.findUnique({ where: { code: '530000' } })
    const advanceAccount = await tx.ledgerAccount.findUnique({ where: { code: '425000' } })
    if (!expenseAccount || !socialChargeAccount || !cnapsEmployeeAccount || !cnapsEmployerAccount || !mgaCashAccount || !advanceAccount) {
      throw new Error('Comptes comptables introuvables après auto-création.')
    }

    const grossSalary = salary.baseSalary + salary.bonuses
    const netSalary = salary.netSalary
    const cnapsEmployee = salary.cnapsEmployee || 0
    const cnapsEmployer = salary.cnapsEmployer || 0

    // Récupérer les avances pour ce bulletin
    const advances = await tx.advance.findMany({
      where: {
        employeeId: salary.employeeId,
        status: 'DEDUCTED',
        date: { lte: new Date(salary.year, salary.month, 0, 23, 59, 59) },
      },
    })

    const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0)
    
    // Calcul des autres déductions (sanctions + déductions manuelles)
    const otherDeductions = salary.deductions - cnapsEmployee - totalAdvances

    console.log(`[generateSalaryAccountingEntry] Brut: ${grossSalary}, Net: ${netSalary}`)
    console.log(`  CNaPS sal: ${cnapsEmployee}, CNaPS patr: ${cnapsEmployer}`)
    console.log(`  Avances: ${totalAdvances}, Autres déductions: ${otherDeductions}`)

    // Validation de l'équilibre comptable
    const totalDebit = grossSalary + cnapsEmployer
    const totalCredit = cnapsEmployee + cnapsEmployer + netSalary + totalAdvances + (otherDeductions > 0 ? otherDeductions : 0)

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      console.error(`[generateSalaryAccountingEntry] DÉSÉQUILIBRE: Débit=${totalDebit}, Crédit=${totalCredit}`)
      throw new Error(`Déséquilibre comptable: Débit=${totalDebit}, Crédit=${totalCredit}`)
    }

    // Créer l'écriture comptable complète
    const journalEntry = await tx.journalEntry.create({
      data: {
        date: salary.paidAt || new Date(), // Fallback si paidAt est null
        description: `Salaire ${salary.employee.firstName} ${salary.employee.lastName} - ${new Date(salary.year, salary.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
        reference: `SAL-${salary.id}`,
        lines: {
          create: [
            // 1. Débit : Charges de personnel (salaire brut)
            {
              accountId: expenseAccount.id,
              debit: grossSalary,
              credit: 0,
              description: `Salaire brut ${salary.employee.firstName} ${salary.employee.lastName}`,
            },
            // 2. Débit : Charges sociales patronales (CNaPS employeur)
            {
              accountId: socialChargeAccount.id,
              debit: cnapsEmployer,
              credit: 0,
              description: 'Charges sociales patronales (CNaPS)',
            },
            // 3. Crédit : CNaPS part salariale (dette envers CNaPS)
            {
              accountId: cnapsEmployeeAccount.id,
              debit: 0,
              credit: cnapsEmployee,
              description: 'CNaPS part salariale',
            },
            // 4. Crédit : CNaPS part patronale (dette envers CNaPS)
            {
              accountId: cnapsEmployerAccount.id,
              debit: 0,
              credit: cnapsEmployer,
              description: 'CNaPS part patronale',
            },
            // 5. Crédit : Avances sur salaire (si avances déduites)
            ...(totalAdvances > 0 ? [{
              accountId: advanceAccount.id,
              debit: 0,
              credit: totalAdvances,
              description: `Déduction avances sur salaire`,
            }] : []),
            // 6. Crédit : Autres déductions (sanctions, déductions manuelles)
            ...(otherDeductions > 0 ? [{
              accountId: expenseAccount.id,
              debit: 0,
              credit: otherDeductions,
              description: `Autres déductions (sanctions, retenues)`,
            }] : []),
            // 7. Crédit : Caisse MGA (net payé)
            {
              accountId: mgaCashAccount.id,
              debit: 0,
              credit: netSalary,
              description: `Paiement salaire net ${salary.employee.firstName} ${salary.employee.lastName}`,
            },
          ],
        },
      },
      include: { lines: { include: { account: true } } },
    })

    console.log(`[generateSalaryAccountingEntry] ✅ Écriture créée ID: ${journalEntry.id}`)

    // Récupérer les lignes avec les comptes pour le log
    const entryWithLines = await tx.journalEntry.findUnique({
      where: { id: journalEntry.id },
      include: { lines: { include: { account: true } } },
    })

    if (entryWithLines) {
      console.log(`  Lignes: ${entryWithLines.lines.length}`)
      entryWithLines.lines.forEach((line: any) => {
        const type = line.debit > 0 ? 'Débit' : 'Crédit'
        const amount = line.debit > 0 ? line.debit : line.credit
        console.log(`    ${type} ${line.account.code}: ${amount.toLocaleString()} Ar`)
      })
    }

    // Vérification du stock (sans modification - géré par updateCashStockForSalary)
    const mgaStock = await tx.cashStock.findUnique({
      where: { currencyId: mgaCashAccount.id },
    })

    if (mgaStock && mgaStock.amount < netSalary) {
      console.warn(`[generateSalaryAccountingEntry] ⚠️ Stock MGA insuffisant: ${mgaStock.amount} Ar < ${netSalary} Ar`)
      // Ne pas bloquer - le stock a déjà été décrémenté par updateCashStockForSalary
    }
  })
}

/**
 * Met à jour le stock de caisse MGA lors du paiement d'un salaire.
 * Décrémente le stock du montant net du salaire.
 */
export async function updateCashStockForSalary(salaryId: number, prismaClient: typeof prisma) {
  const salary = await prismaClient.salary.findUnique({
    where: { id: salaryId },
    include: { employee: true },
  })

  if (!salary) throw new Error('Bulletin introuvable')
  if (!salary.paidAt) throw new Error('Le bulletin doit être marqué comme payé')

  // Récupérer le stock MGA
  const mgaCurrency = await prismaClient.currency.findUnique({
    where: { code: 'MGA' },
  })

  if (!mgaCurrency) throw new Error('Devise MGA introuvable')

  const mgaStock = await prismaClient.cashStock.findUnique({
    where: { currencyId: mgaCurrency.id },
  })

  if (!mgaStock) throw new Error('Stock MGA introuvable')

  // Vérifier le solde suffisant
  if (mgaStock.amount < salary.netSalary) {
    throw new Error(
      `Stock MGA insuffisant pour payer le salaire. ` +
      `Disponible: ${mgaStock.amount.toFixed(2)} Ar, ` +
      `Requis: ${salary.netSalary.toFixed(2)} Ar`
    )
  }

  // Décrémenter le stock
  await prismaClient.cashStock.update({
    where: { id: mgaStock.id },
    data: { amount: mgaStock.amount - salary.netSalary },
  })

  // Créer un log de mouvement
  await prismaClient.stockLog.create({
    data: {
      stockId: mgaStock.id,
      operation: 'RETRAIT',
      delta: -salary.netSalary,
      balanceBefore: mgaStock.amount,
      balanceAfter: mgaStock.amount - salary.netSalary,
      note: `Paiement salaire ${salary.employee.firstName} ${salary.employee.lastName} - ${new Date(salary.year, salary.month - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}`,
      transactionId: null,
    },
  })
}

/**
 * Solder l'avance lors du paiement du salaire.
 * 
 * Écriture de régularisation :
 * - Débit : 641000 (Charges de personnel) - pour le brut complet
 * - Crédit : 425000 (Avances sur salaire) - pour solder l'avance
 * - Crédit : 530000 (Caisse MGA) - pour le net réellement payé
 */
export async function clearAdvanceOnSalaryPayment(salaryId: number, prismaClient: typeof prisma) {
  const salary = await prismaClient.salary.findUnique({
    where: { id: salaryId },
    include: { employee: true },
  })

  if (!salary) throw new Error('Bulletin introuvable')
  if (!salary.paidAt) throw new Error('Le bulletin doit être marqué comme payé')

  // Récupérer les avances APPROVED mais pas encore DEDUCTED pour cet employé
  const advances = await prismaClient.advance.findMany({
    where: {
      employeeId: salary.employeeId,
      status: 'APPROVED',
      date: { lte: new Date(salary.year, salary.month, 0) }, // Avant la fin du mois de paie
    },
  })

  if (advances.length === 0) return // Aucune avance à solder

  const totalAdvances = advances.reduce((sum, a) => sum + a.amount, 0)

  // Vérifier que le montant des avances correspond aux déductions
  if (Math.abs(totalAdvances - salary.deductions) > 0.01) {
    console.warn(`⚠️  Écart entre avances (${totalAdvances}) et déductions (${salary.deductions})`)
  }

  // Marquer les avances comme DEDUCTED
  await prismaClient.advance.updateMany({
    where: { id: { in: advances.map(a => a.id) } },
    data: { status: 'DEDUCTED' },
  })
}

// ═══════════════════════════════════════════════════════════
// ── STATISTIQUES DASHBOARD ─────────────────────────────
// ═══════════════════════════════════════════════════════════

export async function getHrDashboardStats(): Promise<HrDashboardStats> {
  const [totalEmployees, activeEmployees] = await Promise.all([
    prisma.employee.count(),
    prisma.employee.count({ where: { active: true } }),
  ])

  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()

  const salariesThisMonth = await prisma.salary.findMany({
    where: { month: currentMonth, year: currentYear },
  })
  const totalPayroll = salariesThisMonth.reduce((sum, s) => sum + s.netSalary, 0)

  const [pendingAdvances, pendingLeaves] = await Promise.all([
    prisma.advance.count({ where: { status: 'PENDING' } }),
    prisma.leave.count({ where: { status: 'PENDING' } }),
  ])

  return {
    totalEmployees,
    activeEmployees,
    totalPayroll,
    pendingAdvances,
    pendingLeaves,
  }
}

/**
 * Vérifie que tous les comptes comptables nécessaires au module RH existent.
 * Retourne un tableau des comptes manquants.
 */
export async function verifyHrAccounts(): Promise<{ ok: boolean; missing: string[]; details: Record<string, string> }> {
  const requiredAccounts = {
    '641000': 'Charges de personnel',
    '645100': 'Charges sociales patronales',
    '424100': 'CNaPS part salariale',
    '424200': 'CNaPS part patronale',
    '425000': 'Avances sur salaire',
    '530000': 'Caisse MGA',
  }
  
  const missing: string[] = []
  const details: Record<string, string> = {}
  
  for (const [code, name] of Object.entries(requiredAccounts)) {
    const account = await prisma.ledgerAccount.findUnique({
      where: { code },
    })
    
    if (!account) {
      missing.push(code)
      details[code] = name
    }
  }
  
  return {
    ok: missing.length === 0,
    missing,
    details,
  }
}

/**
 * Récupère les salaires payés et les cotisations CNaPS patronales pour une période
 */
export async function getPaidSalariesAndCnaps(from: Date, to: Date) {
  // CORRECTION : filtrage par mois de PAIE (month/year), pas par date de virement (paidAt)
  // Règle métier : la paie de mai reste attribuée à mai même si versée début juin
  const fromYear  = from.getFullYear()
  const fromMonth = from.getMonth() + 1   // getMonth() est 0-based → 1-12
  const toYear    = to.getFullYear()
  const toMonth   = to.getMonth() + 1

  const salaries = await prisma.salary.findMany({
    where: {
      paidAt: { not: null },   // uniquement les bulletins effectivement payés
      AND: [
        {
          OR: [
            { year: { gt: fromYear } },
            { year: fromYear, month: { gte: fromMonth } },
          ],
        },
        {
          OR: [
            { year: { lt: toYear } },
            { year: toYear, month: { lte: toMonth } },
          ],
        },
      ],
    },
  })
  const totalGrossSalary = salaries.reduce((sum, s) => sum + (s.baseSalary + (s.bonuses || 0)), 0)
  const totalCnapsEmployer = salaries.reduce((sum, s) => sum + (s.cnapsEmployer || 0), 0)
  
  return {
    count: salaries.length,
    totalGrossSalary,
    totalCnapsEmployer,
    salaries,
  }
}

/**
 * Récupère le total des avances approuvées mais non encore déduites
 * (c'est-à-dire les avances en cours de régularisation)
 */
export async function getPendingAdvancesTotal(): Promise<{
  count: number
  totalAmount: number
  advances: any[]
}> {
  const advances = await prisma.advance.findMany({
    where: {
      status: 'APPROVED', // Approuvées mais pas encore DEDUCTED
    },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { date: 'desc' },
  })

  const totalAmount = advances.reduce((sum, a) => sum + a.amount, 0)

  return {
    count: advances.length,
    totalAmount,
    advances,
  }
}