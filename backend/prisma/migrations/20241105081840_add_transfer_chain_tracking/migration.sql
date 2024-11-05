-- First, add the new columns as nullable
ALTER TABLE "Transfer" 
ADD COLUMN "targetInterventionId" TEXT,
ADD COLUMN "parentTransferId" TEXT;

-- Add the foreign key constraints
ALTER TABLE "Transfer"
ADD CONSTRAINT "Transfer_targetInterventionId_fkey" 
FOREIGN KEY ("targetInterventionId") 
REFERENCES "InterventionRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Transfer"
ADD CONSTRAINT "Transfer_parentTransferId_fkey" 
FOREIGN KEY ("parentTransferId") 
REFERENCES "Transfer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Create new indexes
CREATE INDEX "Transfer_sourceInterventionId_idx" ON "Transfer"("sourceInterventionId");
CREATE INDEX "Transfer_targetInterventionId_idx" ON "Transfer"("targetInterventionId");

-- First, let's create target interventions for all transfers that don't have one
INSERT INTO "InterventionRequest" (
  "id",
  "userId",
  "clientName",
  "interventionId",
  "emissionsAbated",
  "date",
  "modality",
  "geography",
  "additionality",
  "causality",
  "status",
  "ghgEmissionSaving",
  "vintage",
  "thirdPartyVerification",
  "lowCarbonFuel",
  "feedstock",
  "certificationScheme",
  "totalAmount",
  "remainingAmount",
  "submissionDate"
)
SELECT 
  CONCAT(t.id, '_target') as id,
  u.id as userId,
  d.name as clientName,
  CONCAT(i."interventionId", '_transfer_', t.id) as interventionId,
  t.amount as emissionsAbated,
  t."createdAt" as date,
  CONCAT('Transfer from ', sd."companyName") as modality,
  i.geography,
  i.additionality,
  i.causality,
  CASE 
    WHEN t.status = 'completed' THEN 'verified'
    WHEN t.status = 'pending' THEN 'pending'
    ELSE 'cancelled'
  END as status,
  i."ghgEmissionSaving",
  i.vintage,
  'Transfer Verified' as "thirdPartyVerification",
  'n/a' as "lowCarbonFuel",
  'n/a' as feedstock,
  'n/a' as "certificationScheme",
  t.amount as "totalAmount",
  t.amount as "remainingAmount",
  t."createdAt" as "submissionDate"
FROM "Transfer" t
JOIN "InterventionRequest" i ON t."sourceInterventionId" = i.id
JOIN "Domain" d ON t."targetDomainId" = d.id
JOIN "Domain" sd ON t."sourceDomainId" = sd.id
JOIN "User" u ON u."domainId" = d.id
WHERE t."targetInterventionId" IS NULL
LIMIT 1 OFFSET 0;

-- Now update all transfers with their target intervention IDs
UPDATE "Transfer" t
SET "targetInterventionId" = CONCAT(t.id, '_target');

-- Finally make targetInterventionId required
ALTER TABLE "Transfer" 
ALTER COLUMN "targetInterventionId" SET NOT NULL;