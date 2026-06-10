-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "bureauName" TEXT NOT NULL DEFAULT 'Bureau de Change FX Mada',
    "address" TEXT NOT NULL DEFAULT 'Antananarivo, Madagascar',
    "phone" TEXT NOT NULL DEFAULT '+261 20 22 XXX XX',
    "footer" TEXT NOT NULL DEFAULT 'Merci pour votre confiance',
    "bureauPrefix" TEXT,
    "logoBase64" TEXT,
    "logoName" TEXT,
    "nif" TEXT,
    "stat" TEXT,
    "rcs" TEXT,
    "email" TEXT,
    "rib" TEXT,
    "attestationRate" REAL NOT NULL DEFAULT 100,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Settings" ("address", "attestationRate", "bureauName", "bureauPrefix", "email", "footer", "id", "logoBase64", "logoName", "nif", "phone", "rcs", "rib", "stat", "updatedAt") SELECT "address", "attestationRate", "bureauName", "bureauPrefix", "email", "footer", "id", "logoBase64", "logoName", "nif", "phone", "rcs", "rib", "stat", "updatedAt" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
