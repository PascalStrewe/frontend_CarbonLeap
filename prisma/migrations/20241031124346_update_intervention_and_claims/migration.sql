-- First, add the new columns without dropping the old ones
ALTER TABLE "InterventionRequest" 
ADD COLUMN "vintage_new" INTEGER,
ADD COLUMN "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "remainingAmount_new" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Convert existing vintage data to integer
UPDATE "InterventionRequest" 
SET "vintage_new" = CAST(NULLIF("vintage", '') AS INTEGER);

-- Convert existing remainingAmount data
UPDATE "InterventionRequest"
SET "remainingAmount_new" = CAST(NULLIF("remainingAmount", '') AS DOUBLE PRECISION);

-- Now that data is converted, we can make vintage_new NOT NULL
ALTER TABLE "InterventionRequest" 
ALTER COLUMN "vintage_new" SET NOT NULL;

-- Drop old columns and rename new ones
ALTER TABLE "InterventionRequest"
DROP COLUMN "vintage",
DROP COLUMN "remainingAmount";

ALTER TABLE "InterventionRequest"
RENAME COLUMN "vintage_new" TO "vintage";

ALTER TABLE "InterventionRequest"
RENAME COLUMN "remainingAmount_new" TO "remainingAmount";

-- Create new tables
CREATE TABLE "CarbonClaim" (
    "id" TEXT NOT NULL,
    "interventionId" TEXT NOT NULL,
    "claimingDomainId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "vintage" INTEGER NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CarbonClaim_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ClaimStatement" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "pdfUrl" TEXT NOT NULL,
    "templateVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB,

    CONSTRAINT "ClaimStatement_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX "CarbonClaim_interventionId_idx" ON "CarbonClaim"("interventionId");
CREATE INDEX "CarbonClaim_claimingDomainId_idx" ON "CarbonClaim"("claimingDomainId");
CREATE INDEX "CarbonClaim_vintage_idx" ON "CarbonClaim"("vintage");
CREATE INDEX "CarbonClaim_status_idx" ON "CarbonClaim"("status");
CREATE UNIQUE INDEX "ClaimStatement_claimId_key" ON "ClaimStatement"("claimId");

-- Add foreign keys
ALTER TABLE "CarbonClaim" 
ADD CONSTRAINT "CarbonClaim_interventionId_fkey" 
FOREIGN KEY ("interventionId") REFERENCES "InterventionRequest"("interventionId") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CarbonClaim" 
ADD CONSTRAINT "CarbonClaim_claimingDomainId_fkey" 
FOREIGN KEY ("claimingDomainId") REFERENCES "Domain"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ClaimStatement" 
ADD CONSTRAINT "ClaimStatement_claimId_fkey" 
FOREIGN KEY ("claimId") REFERENCES "CarbonClaim"("id") 
ON DELETE RESTRICT ON UPDATE CASCADE;