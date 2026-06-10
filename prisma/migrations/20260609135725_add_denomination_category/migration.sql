-- CreateTable
CREATE TABLE "DenominationCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "currencyId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "denominations" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "DenominationCategory_currencyId_fkey" FOREIGN KEY ("currencyId") REFERENCES "Currency" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExchangeCategoryRate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "exchangeRateId" INTEGER NOT NULL,
    "categoryId" INTEGER NOT NULL,
    "buyRate" REAL NOT NULL,
    CONSTRAINT "ExchangeCategoryRate_exchangeRateId_fkey" FOREIGN KEY ("exchangeRateId") REFERENCES "ExchangeRate" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ExchangeCategoryRate_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "DenominationCategory" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "TransactionDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "transactionId" TEXT NOT NULL,
    "categoryName" TEXT NOT NULL,
    "denomination" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    "rateApplied" REAL NOT NULL,
    "subtotalAmount" REAL NOT NULL,
    "subtotalMGA" REAL NOT NULL,
    CONSTRAINT "TransactionDetail_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StockLogDetail" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "stockLogId" INTEGER NOT NULL,
    "denomination" REAL NOT NULL,
    "quantity" INTEGER NOT NULL,
    CONSTRAINT "StockLogDetail_stockLogId_fkey" FOREIGN KEY ("stockLogId") REFERENCES "StockLog" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
