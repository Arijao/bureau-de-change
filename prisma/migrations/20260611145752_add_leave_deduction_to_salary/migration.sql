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
    "leaveDeduction" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Salary_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Salary" ("baseSalary", "bonuses", "cnapsEmployee", "cnapsEmployer", "createdAt", "deductions", "employeeId", "id", "month", "netSalary", "note", "ostieEmployee", "paidAt", "year") SELECT "baseSalary", "bonuses", "cnapsEmployee", "cnapsEmployer", "createdAt", "deductions", "employeeId", "id", "month", "netSalary", "note", "ostieEmployee", "paidAt", "year" FROM "Salary";
DROP TABLE "Salary";
ALTER TABLE "new_Salary" RENAME TO "Salary";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
