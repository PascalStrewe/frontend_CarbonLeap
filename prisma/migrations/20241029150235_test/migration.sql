/*
  Warnings:

  - You are about to drop the column `additionality` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `causality` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `clientName` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `createdAt` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `date` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `emissionsAbated` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `geography` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `interventionId` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `modality` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `Intervention` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `Intervention` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "Intervention_date_idx";

-- DropIndex
DROP INDEX "Intervention_domainId_idx";

-- AlterTable
ALTER TABLE "Intervention" DROP COLUMN "additionality",
DROP COLUMN "causality",
DROP COLUMN "clientName",
DROP COLUMN "createdAt",
DROP COLUMN "date",
DROP COLUMN "emissionsAbated",
DROP COLUMN "geography",
DROP COLUMN "interventionId",
DROP COLUMN "modality",
DROP COLUMN "status",
DROP COLUMN "updatedAt";

-- CreateTable
CREATE TABLE "InterventionRequest" (
    "id" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyDomain" TEXT NOT NULL,
    "intervention" TEXT NOT NULL,
    "modality" TEXT NOT NULL,
    "vesselType" TEXT,
    "geography" TEXT NOT NULL,
    "lowCarbonFuelLiters" TEXT,
    "lowCarbonFuelMT" TEXT,
    "scope3EmissionsAbated" TEXT,
    "ghgEmissionSaving" TEXT NOT NULL,
    "vintage" TEXT NOT NULL,
    "lowCarbonFuel" TEXT NOT NULL,
    "feedstock" TEXT NOT NULL,
    "causality" TEXT NOT NULL,
    "additionality" TEXT NOT NULL,
    "thirdPartyVerification" TEXT NOT NULL,
    "certificationScheme" TEXT NOT NULL,
    "otherCertificationScheme" TEXT,
    "standards" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "notificationSent" BOOLEAN NOT NULL DEFAULT false,
    "submissionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "comments" TEXT,

    CONSTRAINT "InterventionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterventionRequest_status_idx" ON "InterventionRequest"("status");

-- CreateIndex
CREATE INDEX "InterventionRequest_companyDomain_idx" ON "InterventionRequest"("companyDomain");

-- AddForeignKey
ALTER TABLE "InterventionRequest" ADD CONSTRAINT "InterventionRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
