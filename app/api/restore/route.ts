import { getSessionUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { hashPassword } from '@/lib/auth'
import fs from 'fs'
import path from 'path'

// Mot de passe par défaut attribué aux users restaurés
const DEFAULT_PASSWORD = 'changeme123'

export async function POST(request: Request) {
  // 1. Sécurité : Réservé aux administrateurs
  const user = await getSessionUser()
  if (!user || user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  try {
    // 2. Lire et parser le fichier JSON uploadé
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    const text = await file.text()
    let backup: any
    try {
      backup = JSON.parse(text)
    } catch {
      return NextResponse.json({ error: 'Fichier JSON invalide' }, { status: 400 })
    }

    // 3. Validation de la structure
    if (!backup.meta || !backup.data) {
      return NextResponse.json({ 
        error: 'Format de backup invalide : sections meta/data manquantes' 
      }, { status: 400 })
    }

    const requiredTables = ['currencies', 'users', 'cashStocks', 'transactions']
    for (const table of requiredTables) {
      if (!Array.isArray(backup.data[table])) {
        return NextResponse.json({ 
          error: `Table manquante ou invalide : ${table}` 
        }, { status: 400 })
      }
    }

    // 4. Safety net : Créer un backup automatique AVANT restauration
    const timestamp = new Date().toISOString().slice(0, 16).replace('T', '_').replace(':', 'h')
    const preRestoreBackup = {
      meta: {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: user.username,
        app: 'Bureau de Change FX Mada',
        note: `Backup automatique avant restauration du backup "${backup.meta.exportedAt}"`
      },
      data: backup.data // On sauvegarde ce qui va être remplacé (l'ancien état)
    }
    
    // Sauvegarder l'ancien état dans un fichier de sécurité
    const backupDir = path.join(process.cwd(), 'backups')
    if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })
    const safetyPath = path.join(backupDir, `pre_restore_${timestamp}.json`)
    
    // Exporter l'état actuel de la base AVANT de la remplacer
    const [
      currentCurrencies, currentExchangeRates, currentCashStocks, currentStockLogs,
      currentUsers, currentTransactions, currentReceipts, currentSettings,
      currentOperationLogs, currentTransactionEdits
    ] = await Promise.all([
      prisma.currency.findMany(),
      prisma.exchangeRate.findMany(),
      prisma.cashStock.findMany(),
      prisma.stockLog.findMany(),
      prisma.user.findMany({ 
        select: { id: true, username: true, name: true, role: true, active: true, createdAt: true }
      }),
      prisma.transaction.findMany(),
      prisma.receipt.findMany(),
      prisma.settings.findMany(),
      prisma.operationLog.findMany(),
      prisma.transactionEdit.findMany(),
    ])
    
    const currentState = {
      meta: {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        exportedBy: user.username,
        app: 'Bureau de Change FX Mada',
        note: 'Backup automatique pré-restauration'
      },
      data: {
        settings: currentSettings,
        currencies: currentCurrencies,
        exchangeRates: currentExchangeRates,
        cashStocks: currentCashStocks,
        stockLogs: currentStockLogs,
        users: currentUsers,
        transactions: currentTransactions,
        receipts: currentReceipts,
        transactionEdits: currentTransactionEdits,
        operationLogs: currentOperationLogs,
      }
    }
    fs.writeFileSync(safetyPath, JSON.stringify(currentState, null, 2))

    // 5. Restauration atomique dans une transaction Prisma
    const result = await prisma.$transaction(async (tx) => {
      // 5.1 Suppression dans l'ordre inverse des dépendances
      await tx.operationLog.deleteMany()
      await tx.transactionEdit.deleteMany()
      await tx.receipt.deleteMany()
      await tx.stockLog.deleteMany()
      await tx.transaction.deleteMany()
      await tx.cashStock.deleteMany()
      await tx.exchangeRate.deleteMany()
      await tx.session.deleteMany() // Nettoyer les sessions
      await tx.user.deleteMany()
      await tx.currency.deleteMany()
      await tx.settings.deleteMany()

      // 5.2 Insertion dans l'ordre des dépendances
      // Settings
      if (backup.data.settings?.length > 0) {
        for (const s of backup.data.settings) {
          await tx.settings.create({ 
            data: { ...s, id: s.id || 'singleton' } 
          })
        }
      }

      // Currencies
      for (const c of backup.data.currencies) {
        await tx.currency.create({ 
          data: { 
            id: c.id,
            code: c.code,
            name: c.name,
            symbol: c.symbol,
            flag: c.flag,
            isActive: c.isActive,
            isBase: c.isBase,
            createdAt: new Date(c.createdAt),
            updatedAt: new Date(c.updatedAt),
          } 
        })
      }

      // Users (avec mot de passe par défaut)
      const defaultHash = hashPassword(DEFAULT_PASSWORD)
      for (const u of backup.data.users) {
        await tx.user.create({ 
          data: { 
            id: u.id,
            username: u.username,
            name: u.name,
            role: u.role,
            active: u.active,
            passwordHash: defaultHash, // ⚠️ Réinitialisation
            createdAt: new Date(u.createdAt),
          } 
        })
      }

      // ExchangeRates
      for (const r of backup.data.exchangeRates) {
        await tx.exchangeRate.create({ 
          data: { 
            id: r.id,
            buyRate: r.buyRate,
            sellRate: r.sellRate,
            note: r.note,
            createdAt: new Date(r.createdAt),
            currencyId: r.currencyId,
            createdBy: r.createdBy,
          } 
        })
      }

      // CashStocks
      for (const s of backup.data.cashStocks) {
        await tx.cashStock.create({ 
          data: { 
            id: s.id,
            amount: s.amount,
            alertLevel: s.alertLevel,
            updatedAt: new Date(s.updatedAt),
            currencyId: s.currencyId,
          } 
        })
      }

      // Transactions
      for (const t of backup.data.transactions) {
        await tx.transaction.create({ 
          data: { 
            id: t.id,
            receiptNo: t.receiptNo,
            type: t.type,
            amount: t.amount,
            rate: t.rate,
            commission: t.commission,
            totalMGA: t.totalMGA,
            note: t.note,
            createdAt: new Date(t.createdAt),
            currencyId: t.currencyId,
            userId: t.userId,
            exchangeRateId: t.exchangeRateId,
            deletedAt: t.deletedAt ? new Date(t.deletedAt) : null,
            deletedBy: t.deletedBy,
          } 
        })
      }

      // Receipts
      for (const r of backup.data.receipts) {
        await tx.receipt.create({ 
          data: { 
            id: r.id,
            transactionId: r.transactionId,
            receiptNo: r.receiptNo,
            size: r.size,
            printedAt: r.printedAt ? new Date(r.printedAt) : null,
            createdAt: new Date(r.createdAt),
          } 
        })
      }

      // StockLogs
      for (const l of backup.data.stockLogs) {
        await tx.stockLog.create({ 
          data: { 
            id: l.id,
            operation: l.operation,
            delta: l.delta,
            balanceBefore: l.balanceBefore,
            balanceAfter: l.balanceAfter,
            note: l.note,
            createdAt: new Date(l.createdAt),
            stockId: l.stockId,
            userId: l.userId,
            transactionId: l.transactionId,
          } 
        })
      }

      // TransactionEdits
      for (const e of backup.data.transactionEdits) {
        await tx.transactionEdit.create({ 
          data: { 
            id: e.id,
            transactionId: e.transactionId,
            editedBy: e.editedBy,
            editedAt: new Date(e.editedAt),
            beforeAmount: e.beforeAmount,
            beforeRate: e.beforeRate,
            beforeCommission: e.beforeCommission,
            beforeTotalMGA: e.beforeTotalMGA,
            beforeNote: e.beforeNote,
            afterAmount: e.afterAmount,
            afterRate: e.afterRate,
            afterCommission: e.afterCommission,
            afterTotalMGA: e.afterTotalMGA,
            afterNote: e.afterNote,
          } 
        })
      }

      // OperationLogs
      for (const l of backup.data.operationLogs) {
        await tx.operationLog.create({ 
          data: { 
            id: l.id,
            action: l.action,
            entity: l.entity,
            entityId: l.entityId,
            detail: l.detail,
            createdAt: new Date(l.createdAt),
            userId: l.userId,
          } 
        })
      }

      return {
        currencies: backup.data.currencies.length,
        users: backup.data.users.length,
        transactions: backup.data.transactions.length,
        cashStocks: backup.data.cashStocks.length,
      }
    })

    // 6. Log de l'opération de restauration
    await prisma.operationLog.create({
      data: {
        action: 'BACKUP_RESTORE',
        entity: 'System',
        entityId: 'restore',
        userId: user.id,
        detail: JSON.stringify({
          sourceFile: file.name,
          sourceBackupDate: backup.meta.exportedAt,
          safetyBackupPath: safetyPath,
          restored: result,
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: `Restauration réussie. ${result.transactions} transactions, ${result.currencies} devises, ${result.users} utilisateurs restaurés.`,
      safetyBackup: safetyPath,
      defaultPassword: DEFAULT_PASSWORD,
      warning: 'Tous les mots de passe ont été réinitialisés. Les utilisateurs doivent se connecter et changer leur mot de passe immédiatement.',
    })
  } catch (error) {
    console.error('Erreur restauration:', error)
    return NextResponse.json({ 
      error: `Erreur lors de la restauration : ${error instanceof Error ? error.message : 'Erreur inconnue'}` 
    }, { status: 500 })
  }
}