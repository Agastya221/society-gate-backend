ALTER TABLE "SocietyRegistrationRequest"
ADD COLUMN "applicantIsMember" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "adminBlockName" TEXT,
ADD COLUMN "adminFlatNumber" TEXT,
ADD COLUMN "adminResidentType" "ResidentType";
