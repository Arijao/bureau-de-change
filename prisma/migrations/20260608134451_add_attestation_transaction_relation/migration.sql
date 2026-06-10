-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Attestation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "attestationNo" TEXT NOT NULL,
    "transactionId" TEXT,
    "receiptNo" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "passportNo" TEXT NOT NULL,
    "passportIssuedAt" TEXT NOT NULL,
    "passportExpiresAt" TEXT NOT NULL,
    "nationality" TEXT NOT NULL,
    "clientAddress" TEXT,
    "destination" TEXT,
    "travelNature" TEXT,
    "transportTitle" TEXT,
    "ticketNo" TEXT,
    "departureDate" TEXT,
    "returnDate" TEXT,
    "currencyCode" TEXT NOT NULL,
    "currencyFlag" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "rate" REAL NOT NULL,
    "commission" REAL NOT NULL DEFAULT 0,
    "totalMGA" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy" TEXT,
    CONSTRAINT "Attestation_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "Transaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Attestation_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Attestation" ("amount", "attestationNo", "clientAddress", "clientName", "commission", "createdAt", "createdBy", "currencyCode", "currencyFlag", "departureDate", "destination", "id", "nationality", "passportExpiresAt", "passportIssuedAt", "passportNo", "rate", "receiptNo", "returnDate", "ticketNo", "totalMGA", "transactionId", "transportTitle", "travelNature") SELECT "amount", "attestationNo", "clientAddress", "clientName", "commission", "createdAt", "createdBy", "currencyCode", "currencyFlag", "departureDate", "destination", "id", "nationality", "passportExpiresAt", "passportIssuedAt", "passportNo", "rate", "receiptNo", "returnDate", "ticketNo", "totalMGA", "transactionId", "transportTitle", "travelNature" FROM "Attestation";
DROP TABLE "Attestation";
ALTER TABLE "new_Attestation" RENAME TO "Attestation";
CREATE UNIQUE INDEX "Attestation_attestationNo_key" ON "Attestation"("attestationNo");
CREATE UNIQUE INDEX "Attestation_transactionId_key" ON "Attestation"("transactionId");
CREATE INDEX "Attestation_attestationNo_idx" ON "Attestation"("attestationNo");
CREATE INDEX "Attestation_createdAt_idx" ON "Attestation"("createdAt");
CREATE INDEX "Attestation_receiptNo_idx" ON "Attestation"("receiptNo");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
