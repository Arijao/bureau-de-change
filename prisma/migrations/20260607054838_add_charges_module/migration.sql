-- CreateTable
CREATE TABLE "Expense" (
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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Expense_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "hr_settings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "cnapsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "cnapsEmployeeRate" REAL NOT NULL DEFAULT 0.01,
    "cnapsEmployerRate" REAL NOT NULL DEFAULT 0.13,
    "cnapsCeiling" REAL NOT NULL DEFAULT 6000000,
    "ostieEnabled" BOOLEAN NOT NULL DEFAULT false,
    "ostieRate" REAL NOT NULL DEFAULT 0.01,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Salary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "employeeId" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "baseSalary" REAL NOT NULL,
    "bonuses" REAL NOT NULL DEFAULT 0,
    "deductions" REAL NOT NULL DEFAULT 0,
    "netSalary" REAL NOT NULL,
    "paidAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cnapsEmployee" REAL NOT NULL DEFAULT 0,
    "cnapsEmployer" REAL NOT NULL DEFAULT 0,
    "ostieEmployee" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Salary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Salary" ("baseSalary", "bonuses", "createdAt", "deductions", "employeeId", "id", "month", "netSalary", "note", "paidAt", "year") SELECT "baseSalary", "bonuses", "createdAt", "deductions", "employeeId", "id", "month", "netSalary", "note", "paidAt", "year" FROM "Salary";
DROP TABLE "Salary";
ALTER TABLE "new_Salary" RENAME TO "Salary";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "Expense_date_idx" ON "Expense"("date");

-- CreateIndex
CREATE INDEX "Expense_category_idx" ON "Expense"("category");
