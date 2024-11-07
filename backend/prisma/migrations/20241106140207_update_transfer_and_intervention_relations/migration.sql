-- Drop existing constraints first
ALTER TABLE IF EXISTS "Transfer" DROP CONSTRAINT IF EXISTS "Transfer_targetInterventionId_fkey";
ALTER TABLE IF EXISTS "Transfer" DROP CONSTRAINT IF EXISTS "Transfer_sourceClaimId_fkey";

-- First add the columns as nullable
ALTER TABLE "CarbonClaim" 
ADD COLUMN IF NOT EXISTS "claimLevel" INTEGER,
ADD COLUMN IF NOT EXISTS "partialClaimSequence" INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS "totalClaimedAtLevel" DOUBLE PRECISION;

ALTER TABLE "Transfer" 
ADD COLUMN IF NOT EXISTS "sourceClaimId" TEXT,
ADD COLUMN IF NOT EXISTS "sourceLevel" INTEGER,
ADD COLUMN IF NOT EXISTS "targetLevel" INTEGER;

-- Update existing Carbon Claims with default values
UPDATE "CarbonClaim" cc
SET "claimLevel" = d."supplyChainLevel"
FROM "Domain" d
WHERE cc."claimingDomainId" = d.id;

UPDATE "CarbonClaim" c1
SET "totalClaimedAtLevel" = (
  SELECT SUM(c2.amount)
  FROM "CarbonClaim" c2
  WHERE c2."interventionId" = c1."interventionId"
    AND c2."claimLevel" = c1."claimLevel"
);

-- Update existing Transfers with default values
UPDATE "Transfer" t
SET 
  "sourceLevel" = sd."supplyChainLevel",
  "targetLevel" = td."supplyChainLevel"
FROM "Domain" sd, "Domain" td
WHERE t."sourceDomainId" = sd.id 
AND t."targetDomainId" = td.id;

-- Create a dummy claim for each transfer if needed
INSERT INTO "CarbonClaim" (
  "id", 
  "interventionId", 
  "claimingDomainId", 
  "amount", 
  "vintage", 
  "expiryDate", 
  "claimDate", 
  "status", 
  "claimLevel",
  "createdAt",
  "updatedAt"
)
SELECT 
  CONCAT('migrated_claim_', t.id),
  t."sourceInterventionId",
  t."sourceDomainId",
  t.amount,
  2023,
  NOW() + INTERVAL '2 years',
  NOW(),
  'active',
  sd."supplyChainLevel",
  NOW(),
  NOW()
FROM "Transfer" t
JOIN "Domain" sd ON t."sourceDomainId" = sd.id
WHERE t."sourceClaimId" IS NULL
ON CONFLICT DO NOTHING;

-- Update transfers to link to newly created claims
UPDATE "Transfer" t
SET "sourceClaimId" = CONCAT('migrated_claim_', t.id)
WHERE t."sourceClaimId" IS NULL;

-- Now make the columns required
ALTER TABLE "CarbonClaim" 
ALTER COLUMN "claimLevel" SET NOT NULL;

ALTER TABLE "Transfer"
ALTER COLUMN "sourceClaimId" SET NOT NULL,
ALTER COLUMN "sourceLevel" SET NOT NULL,
ALTER COLUMN "targetLevel" SET NOT NULL,
ALTER COLUMN "targetInterventionId" SET NOT NULL;

-- Drop existing indexes if they exist
DROP INDEX IF EXISTS "CarbonClaim_interventionId_claimLevel_partialClaimSequence_key";
DROP INDEX IF EXISTS "Transfer_sourceDomainId_idx";
DROP INDEX IF EXISTS "Transfer_targetDomainId_idx";

-- Create indexes
CREATE UNIQUE INDEX "CarbonClaim_interventionId_claimLevel_partialClaimSequence_key" 
ON "CarbonClaim"("interventionId", "claimLevel", "partialClaimSequence");

CREATE INDEX "Transfer_sourceDomainId_idx" ON "Transfer"("sourceDomainId");
CREATE INDEX "Transfer_targetDomainId_idx" ON "Transfer"("targetDomainId");

-- Re-add foreign key constraints
ALTER TABLE "Transfer" 
ADD CONSTRAINT "Transfer_targetInterventionId_fkey" 
FOREIGN KEY ("targetInterventionId") 
REFERENCES "InterventionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transfer" 
ADD CONSTRAINT "Transfer_sourceClaimId_fkey" 
FOREIGN KEY ("sourceClaimId") 
REFERENCES "CarbonClaim"("id") ON DELETE RESTRICT ON UPDATE CASCADE;