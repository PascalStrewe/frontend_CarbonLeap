-- prisma/migrations/[timestamp]_add_supply_chain_level_descriptions/migration.sql

-- Create the supply chain level descriptions table
CREATE TABLE "SupplyChainLevelDescription" (
    "level" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "examples" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplyChainLevelDescription_pkey" PRIMARY KEY ("level")
);