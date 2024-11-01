-- Modify the migration.sql file to look like this:
-- prisma/migrations/[timestamp]_add_supply_chain_level/migration.sql

-- First add the column as nullable
ALTER TABLE "Domain" ADD COLUMN "supplyChainLevel" INTEGER;

-- Update existing records with default value
UPDATE "Domain" SET "supplyChainLevel" = 1 WHERE "supplyChainLevel" IS NULL;

-- Then make the column required
ALTER TABLE "Domain" ALTER COLUMN "supplyChainLevel" SET NOT NULL;