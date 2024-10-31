-- Update existing NULL values with defaults
UPDATE "InterventionRequest"
SET
  "clientName" = 'Unknown Client' 
WHERE "clientName" IS NULL;

UPDATE "InterventionRequest"
SET
  "date" = NOW() 
WHERE "date" IS NULL;

UPDATE "InterventionRequest"
SET
  "emissionsAbated" = 0 
WHERE "emissionsAbated" IS NULL;

UPDATE "InterventionRequest"
SET
  "interventionId" = CONCAT('LEGACY_', id) 
WHERE "interventionId" IS NULL;

UPDATE "InterventionRequest"
SET
  "causality" = false 
WHERE "causality" IS NULL;

UPDATE "InterventionRequest"
SET
  "additionality" = false 
WHERE "additionality" IS NULL;