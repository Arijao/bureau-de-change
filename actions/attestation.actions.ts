'use server'
import { revalidatePath } from 'next/cache'
import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { saveAttestation } from '@/services/attestation.service'
import { getSettings } from '@/services/settings.service'

async function requireAuth() {
  const user = await getSessionUser()
  if (!user) throw new Error('Non authentifié')
  return user
}

export async function createAttestationAction(data: {
  clientName: string
  passportNo: string
  nationality: string
  currencyCode: string
  amount: number
  attestationRate: number
  destination?:    string
  travelNature?:   string
  transportTitle?: string
  ticketNo?:       string
  departureDate?:  string
  returnDate?:     string
}) {
  try {
    const user = await requireAuth()
    
    if (data.amount <= 0) {
      return { error: 'Le montant doit être positif' }
    }
    
    const settings = await getSettings()

    // Récupérer le taux de change réel — affiché sur l'attestation
    const currency = await prisma.currency.findUnique({ where: { code: data.currencyCode } })
    let currentRate = 0
    if (currency) {
      const { getCurrentRate } = await import('@/services/exchange-rate.service')
      const rateRecord = await getCurrentRate(currency.id)
      currentRate = rateRecord?.sellRate ?? 0
    }
    if (currentRate <= 0) {
      return { error: `Taux de change introuvable pour ${data.currencyCode}. Veuillez configurer le taux de vente.` }
    }

    // facturationMGA = montant × tarif attestation
    // = prix réel encaissé (historique + comptabilité)
    const facturationMGA = data.amount * data.attestationRate

    // Vérifier le stock MGA
    const mgaCurrency = await prisma.currency.findUnique({ where: { code: 'MGA' } })
    if (!mgaCurrency) throw new Error('Devise MGA introuvable')
    
    const mgaStock = await prisma.cashStock.findUnique({ where: { currencyId: mgaCurrency.id } })
    if (!mgaStock) throw new Error('Stock MGA introuvable')
    
    if (mgaStock.amount < facturationMGA) {
      return { error: `Stock MGA insuffisant. Disponible: ${mgaStock.amount.toFixed(2)} Ar, Requis: ${facturationMGA.toFixed(2)} Ar` }
    }

    // Créer l'attestation (transactionId = null car pas liée à une vente)
    const attestation = await saveAttestation({
      receiptNo: `ATT-${Date.now()}`,
      clientName: data.clientName,
      passportNo: data.passportNo,
      passportIssuedAt: new Date().toISOString().split('T')[0],
      passportExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      nationality: data.nationality,
      currencyCode: data.currencyCode,
      currencyFlag: '',
      amount: data.amount,
      rate: currentRate,         // Vrai taux de change du jour (affiché sur l'attestation)
      commission: 0,
      totalMGA: facturationMGA,  // Prix de l'attestation (historique + comptabilité)
      destination:    data.destination,
      travelNature:   data.travelNature,
      transportTitle: data.transportTitle,
      ticketNo:       data.ticketNo,
      departureDate:  data.departureDate,
      returnDate:     data.returnDate,
      createdBy: user.id,
    }, settings.bureauName, settings.bureauPrefix)
    
    // Mettre à jour le stock MGA (entrée = prix encaissé)
    await prisma.cashStock.update({
      where: { id: mgaStock.id },
      data: { amount: mgaStock.amount + facturationMGA },
    })
    
    // Créer un log de mouvement (sur le prix encaissé)
    await prisma.stockLog.create({
      data: {
        stockId: mgaStock.id,
        operation: 'DEPOT',
        delta: facturationMGA,
        balanceBefore: mgaStock.amount,
        balanceAfter: mgaStock.amount + facturationMGA,
        note: `Vente attestation ${attestation.attestationNo} - ${data.clientName}`,
        userId: user.id,
        transactionId: null,
      },
    })
    
    // Générer l'écriture comptable
    // Le revenu comptabilisé correspond au tarif commercial (facturationMGA)
    const { ensureChartOfAccounts } = await import('@/services/accounting.service')
    await ensureChartOfAccounts()
    
    const revenueAccount = await prisma.ledgerAccount.findUnique({ where: { code: '706000' } })
    const mgaCashAccount = await prisma.ledgerAccount.findUnique({ where: { code: '530000' } })
    
    if (revenueAccount && mgaCashAccount) {
      await prisma.journalEntry.create({
        data: {
          date: new Date(),
          description: `Vente attestation ${attestation.attestationNo} - ${data.clientName}`,
          reference: attestation.attestationNo,
          lines: {
            create: [
              {
                accountId: mgaCashAccount.id,
                debit: facturationMGA,
                credit: 0,
                description: `Encaissement attestation ${data.clientName}`,
              },
              {
                accountId: revenueAccount.id,
                debit: 0,
                credit: facturationMGA,
                description: `Revenu attestation ${data.currencyCode} ${data.amount}`,
              },
            ],
          },
        },
      })
    }
    
    revalidatePath('/attestations')
    revalidatePath('/dashboard')
    revalidatePath('/accounting/journal')
    
    return { success: true, attestation }
  } catch (e: any) {
    console.error('Erreur création attestation:', e)
    return { error: e.message ?? 'Erreur lors de la création' }
  }
}
