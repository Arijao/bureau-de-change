import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

export async function GET() {
  // 1. Sécurité : Réservé aux administrateurs
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    // 2. Extraction de toutes les tables en parallèle pour la rapidité
    const [
      currencies,
      exchangeRates,
      cashStocks,
      stockLogs,
      users,
      transactions,
      receipts,
      settings,
      operationLogs,
      transactionEdits
    ] = await Promise.all([
      prisma.currency.findMany(),
      prisma.exchangeRate.findMany(),
      prisma.cashStock.findMany(),
      prisma.stockLog.findMany(),
      prisma.user.findMany({ 
        select: { 
          id: true, username: true, name: true, role: true, active: true, createdAt: true 
          // ⚠️ passwordHash est volontairement exclu pour la sécurité
        } 
      }),
      prisma.transaction.findMany(),
      prisma.receipt.findMany(),
      prisma.settings.findMany(),
      prisma.operationLog.findMany(),
      prisma.transactionEdit.findMany(),
    ])

    // 3. Construction du payload JSON avec métadonnées
    const backupData = {
      meta: {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: user.username,
        app: 'Bureau de Change FX Mada'
      },
      data: {
        settings,
        currencies,
        exchangeRates,
        cashStocks,
        stockLogs,
        users,
        transactions,
        receipts,
        transactionEdits,
        operationLogs
      }
    }

    // 4. Génération du fichier téléchargeable
    const jsonString = JSON.stringify(backupData, null, 2)
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
    const filename = `bdc_backup_json_${timestamp}.json`

    return new NextResponse(jsonString, {
      headers: {
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Type': 'application/json',
        'Content-Length': String(Buffer.byteLength(jsonString)),
      },
    })
  } catch (error) {
    console.error('Erreur export JSON:', error)
    return NextResponse.json({ error: 'Erreur lors de l\'export' }, { status: 500 })
  }
}