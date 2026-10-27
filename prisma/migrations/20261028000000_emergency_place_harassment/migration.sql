-- A woman being harassed or abused gets her own kind of emergency (private alert).
ALTER TYPE "EmergencyType" ADD VALUE 'HARASSMENT';

-- Where it is happening: the block picked when raising it, and one location reading taken at that moment.
ALTER TABLE "Emergency" ADD COLUMN "blockId" TEXT,
                        ADD COLUMN "latitude" DOUBLE PRECISION,
                        ADD COLUMN "longitude" DOUBLE PRECISION;

ALTER TABLE "Emergency" ADD CONSTRAINT "Emergency_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;
