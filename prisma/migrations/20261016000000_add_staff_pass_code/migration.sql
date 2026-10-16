-- Nullable, additive: existing staff rows get NULL until the backfill script runs.
ALTER TABLE "DomesticStaff" ADD COLUMN "passCode" TEXT;
CREATE UNIQUE INDEX "DomesticStaff_passCode_key" ON "DomesticStaff"("passCode");
