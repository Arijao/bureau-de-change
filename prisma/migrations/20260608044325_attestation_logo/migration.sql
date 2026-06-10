-- Migration corrigée : 20260608044325_attestation_logo
-- Correction : suppression du DROP INDEX sur sqlite_autoindex_AttestationCounter_1
-- SQLite interdit la suppression des index automatiques liés aux contraintes UNIQUE.
-- La table AttestationCounter a été créée avec @@map et la contrainte @@unique dans
-- le schéma Prisma, ce qui a généré un autoindex. On recrée uniquement les index
-- nommés explicitement, sans toucher à l'autoindex.

-- RedefineTables : renommage logoUrl → logoBase64 sur Settings
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;

CREATE TABLE "new_Settings" (
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
    "updatedAt"  DATETIME NOT NULL
);

INSERT INTO "new_Settings" (
    "address","bureauName","email","footer","id",
    "logoBase64","logoName","nif","phone","rcs","rib","stat","updatedAt"
)
SELECT
    "address","bureauName","email","footer","id",
    "logoBase64","logoName","nif","phone","rcs","rib","stat","updatedAt"
FROM "Settings";

DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";

PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- RedefineIndex : renommage de l'index nommé manuellement dans fix_migration_final.sql
-- On supprime uniquement l'index que NOUS avons créé explicitement (pas l'autoindex).
DROP INDEX IF EXISTS "AttestationCounter_prefix_idx";

-- Recréer les index avec les noms attendus par Prisma
CREATE INDEX IF NOT EXISTS "AttestationCounter_bureauPrefix_month_year_idx"
    ON "AttestationCounter"("bureauPrefix", "month", "year");

CREATE UNIQUE INDEX IF NOT EXISTS "AttestationCounter_bureauPrefix_month_year_key"
    ON "AttestationCounter"("bureauPrefix", "month", "year");
