-- DropForeignKey
ALTER TABLE "Transfer" DROP CONSTRAINT "Transfer_targetInterventionId_fkey";

-- AlterTable
ALTER TABLE "Transfer" ALTER COLUMN "targetInterventionId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_targetInterventionId_fkey" FOREIGN KEY ("targetInterventionId") REFERENCES "InterventionRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
