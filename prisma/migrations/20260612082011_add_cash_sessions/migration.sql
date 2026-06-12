-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "openingNote" TEXT,
    "closingNote" TEXT,
    "userId" TEXT NOT NULL,
    "previousSessionId" TEXT,
    CONSTRAINT "CashSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CashSession_previousSessionId_fkey" FOREIGN KEY ("previousSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashSessionBalance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sessionId" TEXT NOT NULL,
    "currencyId" INTEGER NOT NULL,
    "balanceType" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    CONSTRAINT "CashSessionBalance_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "CashSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "CashSessionBalance_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CashSessionCountDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "balanceId" INTEGER NOT NULL,
    "denomination" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "CashSessionCountDetail_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "CashSessionBalance" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Expense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" REAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "period" TEXT,
    "note" TEXT,
    "cashSessionId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Expense" ("accountId", "amount", "category", "createdAt", "date", "description", "id", "note", "period", "reference", "supplier", "updatedAt") SELECT "accountId", "amount", "category", "createdAt", "date", "description", "id", "note", "period", "reference", "supplier", "updatedAt" FROM "Expense";
DROP TABLE "Expense";
ALTER TABLE "new_Expense" RENAME TO "Expense";
CREATE INDEX "Expense_date_idx" ON "Expense"("date");
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
CREATE TABLE "new_Transaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "receiptNo" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "rate" REAL NOT NULL,
    "commission" REAL NOT NULL DEFAULT 0,
    "totalMGA" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currencyId" INTEGER NOT NULL,
    "userId" TEXT,
    "exchangeRateId" INTEGER,
    "deletedAt" DATETIME,
    "deletedBy" TEXT,
    "cashSessionId" TEXT,
    CONSTRAINT "Transaction_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_deletedBy_fkey" FOREIGN KEY ("deletedBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Transaction_cashSessionId_fkey" FOREIGN KEY ("cashSessionId") REFERENCES "CashSession" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Transaction" ("amount", "commission", "createdAt", "currencyId", "deletedAt", "deletedBy", "exchangeRateId", "id", "note", "rate", "receiptNo", "totalMGA", "type", "userId") SELECT "amount", "commission", "createdAt", "currencyId", "deletedAt", "deletedBy", "exchangeRateId", "id", "note", "rate", "receiptNo", "totalMGA", "type", "userId" FROM "Transaction";
DROP TABLE "Transaction";
ALTER TABLE "new_Transaction" RENAME TO "Transaction";
CREATE UNIQUE INDEX "Transaction_receiptNo_key" ON "Transaction"("receiptNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_sessionNo_key" ON "CashSession"("sessionNo");

-- CreateIndex
CREATE UNIQUE INDEX "CashSession_previousSessionId_key" ON "CashSession"("previousSessionId");

-- CreateIndex
CREATE INDEX "CashSession_userId_idx" ON "CashSession"("userId");

-- CreateIndex
CREATE INDEX "CashSession_status_idx" ON "CashSession"("status");

-- CreateIndex
CREATE INDEX "CashSession_openedAt_idx" ON "CashSession"("openedAt");

-- CreateIndex
CREATE INDEX "CashSessionBalance_sessionId_idx" ON "CashSessionBalance"("sessionId");

-- CreateIndex
CREATE UNIQUE INDEX "CashSessionBalance_sessionId_currencyId_balanceType_key" ON "CashSessionBalance"("sessionId", "currencyId", "balanceType");

-- CreateIndex
CREATE INDEX "CashSessionCountDetail_balanceId_idx" ON "CashSessionCountDetail"("balanceId");
