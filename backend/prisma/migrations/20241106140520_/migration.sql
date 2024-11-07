/*
  Warnings:

  - Made the column `partialClaimSequence` on table `CarbonClaim` required. This step will fail if there are existing NULL values in that column.

*/
-- DropIndex
DROP INDEX "Transfer_targetInterventionId_idx";

-- AlterTable
ALTER TABLE "CarbonClaim" ALTER COLUMN "partialClaimSequence" SET NOT NULL;
