-- Drop foreign key from Entry referencing PreApproval before dropping the table
ALTER TABLE "Entry" DROP COLUMN IF EXISTS "preApprovalId";

-- Truncate old tables to remove data before dropping
TRUNCATE TABLE "PreApproval" CASCADE;
TRUNCATE TABLE "ExpectedDelivery" CASCADE;
TRUNCATE TABLE "DeliveryAutoApproveRule" CASCADE;

-- Drop old tables
DROP TABLE IF EXISTS "DeliveryAutoApproveRule";
DROP TABLE IF EXISTS "ExpectedDelivery";
DROP TABLE IF EXISTS "PreApproval";

-- Drop old enum
DROP TYPE IF EXISTS "PreApprovalStatus";
