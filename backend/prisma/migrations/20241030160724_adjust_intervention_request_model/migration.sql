/*
  Warnings:

  - You are about to drop the column `companyDomain` on the `InterventionRequest` table. All the data in the column will be lost.
  - You are about to drop the column `intervention` on the `InterventionRequest` table. All the data in the column will be lost.
  - The `causality` column on the `InterventionRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `additionality` column on the `InterventionRequest` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - A unique constraint covering the columns `[interventionId]` on the table `InterventionRequest` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "InterventionRequest_companyDomain_idx";

-- AlterTable
ALTER TABLE "InterventionRequest" DROP COLUMN "companyDomain",
DROP COLUMN "intervention",
ADD COLUMN     "clientName" TEXT,
ADD COLUMN     "date" TIMESTAMP(3),
ADD COLUMN     "emissionsAbated" DOUBLE PRECISION,
ADD COLUMN     "interventionId" TEXT,
ADD COLUMN     "remainingAmount" TEXT NOT NULL DEFAULT '0',
ALTER COLUMN "lowCarbonFuel" SET DEFAULT 'n/a',
ALTER COLUMN "feedstock" SET DEFAULT 'n/a',
DROP COLUMN "causality",
ADD COLUMN     "causality" BOOLEAN,
DROP COLUMN "additionality",
ADD COLUMN     "additionality" BOOLEAN,
ALTER COLUMN "certificationScheme" SET DEFAULT 'n/a';

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "sourceInterventionId" TEXT NOT NULL,
    "sourceDomainId" INTEGER NOT NULL,
    "targetDomainId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdById" INTEGER NOT NULL,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "domainId" INTEGER NOT NULL,
    "metadata" JSONB,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomainPartnership" (
    "id" SERIAL NOT NULL,
    "domain1Id" INTEGER NOT NULL,
    "domain2Id" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DomainPartnership_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Transfer_status_idx" ON "Transfer"("status");

-- CreateIndex
CREATE INDEX "Notification_domainId_idx" ON "Notification"("domainId");

-- CreateIndex
CREATE INDEX "Notification_type_idx" ON "Notification"("type");

-- CreateIndex
CREATE INDEX "DomainPartnership_domain1Id_idx" ON "DomainPartnership"("domain1Id");

-- CreateIndex
CREATE INDEX "DomainPartnership_domain2Id_idx" ON "DomainPartnership"("domain2Id");

-- CreateIndex
CREATE UNIQUE INDEX "DomainPartnership_domain1Id_domain2Id_key" ON "DomainPartnership"("domain1Id", "domain2Id");

-- CreateIndex
CREATE UNIQUE INDEX "InterventionRequest_interventionId_key" ON "InterventionRequest"("interventionId");

-- CreateIndex
CREATE INDEX "InterventionRequest_clientName_idx" ON "InterventionRequest"("clientName");

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceInterventionId_fkey" FOREIGN KEY ("sourceInterventionId") REFERENCES "InterventionRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_sourceDomainId_fkey" FOREIGN KEY ("sourceDomainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_targetDomainId_fkey" FOREIGN KEY ("targetDomainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPartnership" ADD CONSTRAINT "DomainPartnership_domain1Id_fkey" FOREIGN KEY ("domain1Id") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomainPartnership" ADD CONSTRAINT "DomainPartnership_domain2Id_fkey" FOREIGN KEY ("domain2Id") REFERENCES "Domain"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
