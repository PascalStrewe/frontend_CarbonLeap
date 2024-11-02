/*
  Warnings:

  - Made the column `clientName` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `date` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `emissionsAbated` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `interventionId` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `causality` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.
  - Made the column `additionality` on table `InterventionRequest` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "InterventionRequest" ADD COLUMN     "amount" DOUBLE PRECISION,
ADD COLUMN     "baselineFuelProduct" TEXT,
ADD COLUMN     "deliveryTicketNumber" TEXT,
ADD COLUMN     "emissionReductionPercentage" DOUBLE PRECISION,
ADD COLUMN     "intensityLowCarbonFuel" TEXT,
ADD COLUMN     "intensityOfBaseline" TEXT,
ADD COLUMN     "interventionType" TEXT,
ADD COLUMN     "materialId" TEXT,
ADD COLUMN     "materialName" TEXT,
ADD COLUMN     "materialSustainabilityStatus" BOOLEAN,
ADD COLUMN     "quantity" DOUBLE PRECISION,
ADD COLUMN     "scope" TEXT,
ADD COLUMN     "thirdPartyVerifier" TEXT,
ADD COLUMN     "typeOfVehicle" TEXT,
ADD COLUMN     "unit" TEXT,
ADD COLUMN     "vendorName" TEXT,
ALTER COLUMN "standards" DROP NOT NULL,
ALTER COLUMN "clientName" SET NOT NULL,
ALTER COLUMN "clientName" SET DEFAULT 'Unknown Client',
ALTER COLUMN "date" SET NOT NULL,
ALTER COLUMN "date" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "emissionsAbated" SET NOT NULL,
ALTER COLUMN "emissionsAbated" SET DEFAULT 0,
ALTER COLUMN "interventionId" SET NOT NULL,
ALTER COLUMN "causality" SET NOT NULL,
ALTER COLUMN "causality" SET DEFAULT false,
ALTER COLUMN "additionality" SET NOT NULL,
ALTER COLUMN "additionality" SET DEFAULT false;
