DO $$ BEGIN
  CREATE TYPE "SocietyOnboardingStatus" AS ENUM ('LEAD', 'PROFILE_CREATED', 'DOCS_PENDING', 'PENDING_VERIFICATION', 'VERIFIED', 'IMPORT_PENDING', 'CONFIG_PENDING', 'ACTIVE', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenanceBillingType" AS ENUM ('FLAT', 'SQUARE_FOOT', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SocietyOnboardingDocumentType" AS ENUM ('REGISTRATION_CERTIFICATE', 'AUTHORIZED_SIGNATORY_ID', 'PAN_PROOF', 'GST_PROOF', 'BANK_PROOF', 'LOGO', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SocietyOnboardingDocumentStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "SocietyImportBatchStatus" AS ENUM ('VALIDATED', 'VALIDATION_FAILED', 'COMMITTED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "FlatOccupancyStatus" AS ENUM ('OWNER_OCCUPIED', 'RENTED', 'VACANT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "GateDeviceStatus" AS ENUM ('ACTIVE', 'INACTIVE');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "Society"
  ADD COLUMN IF NOT EXISTS "registeredName" TEXT,
  ADD COLUMN IF NOT EXISTS "registrationNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "logoKey" TEXT,
  ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "bankIfsc" TEXT,
  ADD COLUMN IF NOT EXISTS "bankBranchName" TEXT,
  ADD COLUMN IF NOT EXISTS "panNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "gstin" TEXT,
  ADD COLUMN IF NOT EXISTS "maintenanceBillingType" "MaintenanceBillingType" NOT NULL DEFAULT 'FLAT',
  ADD COLUMN IF NOT EXISTS "maintenanceBillingConfig" JSONB,
  ADD COLUMN IF NOT EXISTS "onboardingStatus" "SocietyOnboardingStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE "Flat"
  ADD COLUMN IF NOT EXISTS "occupancyStatus" "FlatOccupancyStatus" NOT NULL DEFAULT 'VACANT',
  ADD COLUMN IF NOT EXISTS "squareFeet" DOUBLE PRECISION;

UPDATE "Flat"
SET "occupancyStatus" = CASE
  WHEN "currentTenantId" IS NOT NULL THEN 'RENTED'::"FlatOccupancyStatus"
  WHEN "currentOwnerId" IS NOT NULL OR "isOccupied" = true THEN 'OWNER_OCCUPIED'::"FlatOccupancyStatus"
  ELSE 'VACANT'::"FlatOccupancyStatus"
END;

CREATE TABLE IF NOT EXISTS "SocietyOnboardingDocument" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "documentType" "SocietyOnboardingDocumentType" NOT NULL,
  "status" "SocietyOnboardingDocumentStatus" NOT NULL DEFAULT 'PENDING',
  "fileUrl" TEXT NOT NULL,
  "fileKey" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSizeMB" DOUBLE PRECISION NOT NULL,
  "fileType" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewerNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocietyOnboardingDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SocietyImportBatch" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "status" "SocietyImportBatchStatus" NOT NULL,
  "fileName" TEXT,
  "totalRows" INTEGER NOT NULL DEFAULT 0,
  "validRows" INTEGER NOT NULL DEFAULT 0,
  "errorRows" INTEGER NOT NULL DEFAULT 0,
  "rawRows" JSONB,
  "summary" JSONB,
  "uploadedById" TEXT NOT NULL,
  "committedById" TEXT,
  "committedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocietyImportBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SocietyImportRowError" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "rowNumber" INTEGER NOT NULL,
  "field" TEXT,
  "message" TEXT NOT NULL,
  "rowData" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SocietyImportRowError_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SocietyRuleConfig" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "deliveryCheckInRequired" BOOLEAN NOT NULL DEFAULT true,
  "guestParkingHours" INTEGER NOT NULL DEFAULT 4,
  "visitorOtpRequired" BOOLEAN NOT NULL DEFAULT true,
  "customRules" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SocietyRuleConfig_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "GateDevice" (
  "id" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "gatePointId" TEXT NOT NULL,
  "deviceName" TEXT NOT NULL,
  "deviceIdentifier" TEXT,
  "status" "GateDeviceStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "GateDevice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SocietyRuleConfig_societyId_key" ON "SocietyRuleConfig"("societyId");

CREATE INDEX IF NOT EXISTS "Society_onboardingStatus_isActive_idx" ON "Society"("onboardingStatus", "isActive");
CREATE INDEX IF NOT EXISTS "SocietyOnboardingDocument_societyId_documentType_idx" ON "SocietyOnboardingDocument"("societyId", "documentType");
CREATE INDEX IF NOT EXISTS "SocietyOnboardingDocument_societyId_status_idx" ON "SocietyOnboardingDocument"("societyId", "status");
CREATE INDEX IF NOT EXISTS "SocietyImportBatch_societyId_status_idx" ON "SocietyImportBatch"("societyId", "status");
CREATE INDEX IF NOT EXISTS "SocietyImportBatch_uploadedById_idx" ON "SocietyImportBatch"("uploadedById");
CREATE INDEX IF NOT EXISTS "SocietyImportRowError_batchId_rowNumber_idx" ON "SocietyImportRowError"("batchId", "rowNumber");
CREATE INDEX IF NOT EXISTS "GateDevice_societyId_status_idx" ON "GateDevice"("societyId", "status");
CREATE INDEX IF NOT EXISTS "GateDevice_gatePointId_status_idx" ON "GateDevice"("gatePointId", "status");

ALTER TABLE "SocietyOnboardingDocument"
  ADD CONSTRAINT "SocietyOnboardingDocument_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocietyOnboardingDocument"
  ADD CONSTRAINT "SocietyOnboardingDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocietyOnboardingDocument"
  ADD CONSTRAINT "SocietyOnboardingDocument_reviewedById_fkey"
  FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocietyImportBatch"
  ADD CONSTRAINT "SocietyImportBatch_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocietyImportBatch"
  ADD CONSTRAINT "SocietyImportBatch_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SocietyImportBatch"
  ADD CONSTRAINT "SocietyImportBatch_committedById_fkey"
  FOREIGN KEY ("committedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SocietyImportRowError"
  ADD CONSTRAINT "SocietyImportRowError_batchId_fkey"
  FOREIGN KEY ("batchId") REFERENCES "SocietyImportBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SocietyRuleConfig"
  ADD CONSTRAINT "SocietyRuleConfig_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GateDevice"
  ADD CONSTRAINT "GateDevice_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GateDevice"
  ADD CONSTRAINT "GateDevice_gatePointId_fkey"
  FOREIGN KEY ("gatePointId") REFERENCES "GatePoint"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GateDevice"
  ADD CONSTRAINT "GateDevice_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
