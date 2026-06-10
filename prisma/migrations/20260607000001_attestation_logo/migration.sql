-- ── 1. Renommage logoUrl → logoBase64 sur Settings ───────────────────────────
-- SQLite ne supporte pas ALTER COLUMN RENAME directement avant la v3.25.
-- Prisma gère cela via une table temporaire. La migration générée par
-- `prisma migrate dev` sera plus sûre que ce SQL manuel.
-- Si vous appliquez manuellement, voici la procédure SQLite :

PRAGMA foreign_keys = OFF;

CREATE TABLE "Settings_new" (
    "id"         TEXT NOT NULL PRIMARY KEY DEFAULT 'singleton',
    "bureauName" TEXT NOT NULL DEFAULT 'Bureau de Change FX Mada',
    "address"    TEXT NOT NULL DEFAULT 'Antananarivo, Madagascar',
    "phone"      TEXT NOT NULL DEFAULT '+261 20 22 XXX XX',
    "footer"     TEXT NOT NULL DEFAULT 'Merci pour votre confiance',
    "logoBase64" TEXT,
    "logoName"   TEXT,
    "nif"        TEXT,
    "stat"       TEXT,
    "rcs"        TEXT,
    "email"      TEXT,
    "rib"        TEXT,
    "updatedAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Copie des données existantes (logoUrl → logoBase64)
INSERT INTO "Settings_new"
    ("id","bureauName","address","phone","footer","logoBase64","logoName","nif","stat","email","rib","updatedAt")
SELECT
    "id","bureauName","address","phone","footer","logoUrl","logoName","nif","stat","email","rib","updatedAt"
FROM "Settings";

DROP TABLE "Settings";
ALTER TABLE "Settings_new" RENAME TO "Settings";

PRAGMA foreign_keys = ON;

-- ── 2. Créer la table Attestation ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "Attestation" (
    "id"                TEXT NOT NULL PRIMARY KEY,
    "attestationNo"     TEXT NOT NULL,
    "transactionId"     TEXT,
    "receiptNo"         TEXT NOT NULL,
    "clientName"        TEXT NOT NULL,
    "passportNo"        TEXT NOT NULL,
    "passportIssuedAt"  TEXT NOT NULL,
    "passportExpiresAt" TEXT NOT NULL,
    "nationality"       TEXT NOT NULL,
    "clientAddress"     TEXT,
    "destination"       TEXT,
    "travelNature"      TEXT,
    "transportTitle"    TEXT,
    "ticketNo"          TEXT,
    "departureDate"     TEXT,
    "returnDate"        TEXT,
    "currencyCode"      TEXT NOT NULL,
    "currencyFlag"      TEXT NOT NULL,
    "amount"            REAL NOT NULL,
    "rate"              REAL NOT NULL,
    "commission"        REAL NOT NULL DEFAULT 0,
    "totalMGA"          REAL NOT NULL,
    "createdAt"         DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdBy"         TEXT,
    CONSTRAINT "Attestation_createdBy_fkey"
        FOREIGN KEY ("createdBy") REFERENCES "User"("id")
        ON DELETE SET NULL ON UPDATE CASCADE
);

-- ── 3. Index sur Attestation ──────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS "Attestation_attestationNo_key" ON "Attestation"("attestationNo");
CREATE INDEX IF NOT EXISTS "Attestation_attestationNo_idx" ON "Attestation"("attestationNo");
CREATE INDEX IF NOT EXISTS "Attestation_createdAt_idx"    ON "Attestation"("createdAt");
CREATE INDEX IF NOT EXISTS "Attestation_receiptNo_idx"    ON "Attestation"("receiptNo");

-- ── 4. Table de compteur pour la numérotation séquentielle ───────────────────
-- Permet l'incrémentation atomique sans risque de doublon.
-- Clé composite : bureauPrefix + mois + année
CREATE TABLE IF NOT EXISTS "AttestationCounter" (
    "id"           INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bureauPrefix" TEXT    NOT NULL,   -- ex: "TREX"
    "month"        INTEGER NOT NULL,   -- 1-12
    "year"         INTEGER NOT NULL,   -- ex: 26 (format AA)
    "lastSeq"      INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "AttestationCounter_unique"
        UNIQUE ("bureauPrefix", "month", "year")
);

CREATE INDEX IF NOT EXISTS "AttestationCounter_prefix_idx"
    ON "AttestationCounter"("bureauPrefix","month","year");
