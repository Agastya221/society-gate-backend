DROP INDEX IF EXISTS "OnboardingRequest_userId_key";

CREATE TABLE "UserFlatMembership" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT,
    "role" "Role" NOT NULL DEFAULT 'RESIDENT',
    "residentType" "ResidentType",
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserFlatMembership_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "UserFlatMembership_userId_isActive_idx" ON "UserFlatMembership"("userId", "isActive");
CREATE INDEX "UserFlatMembership_societyId_role_isActive_idx" ON "UserFlatMembership"("societyId", "role", "isActive");
CREATE INDEX "UserFlatMembership_flatId_isActive_idx" ON "UserFlatMembership"("flatId", "isActive");

CREATE UNIQUE INDEX "UserFlatMembership_userId_societyId_flatId_key"
ON "UserFlatMembership"("userId", "societyId", "flatId")
WHERE "flatId" IS NOT NULL;

CREATE UNIQUE INDEX "UserFlatMembership_userId_societyId_role_no_flat_key"
ON "UserFlatMembership"("userId", "societyId", "role")
WHERE "flatId" IS NULL;

ALTER TABLE "UserFlatMembership"
ADD CONSTRAINT "UserFlatMembership_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFlatMembership"
ADD CONSTRAINT "UserFlatMembership_societyId_fkey"
FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserFlatMembership"
ADD CONSTRAINT "UserFlatMembership_flatId_fkey"
FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "UserFlatMembership" (
    "id",
    "userId",
    "societyId",
    "flatId",
    "role",
    "residentType",
    "isOwner",
    "isPrimary",
    "isActive",
    "isDefault",
    "createdAt",
    "updatedAt"
)
SELECT
    md5("id" || ':' || COALESCE("societyId", '') || ':' || COALESCE("flatId", '') || ':' || "role"::text),
    "id",
    "societyId",
    "flatId",
    "role",
    CASE
        WHEN "flatId" IS NULL THEN NULL
        WHEN "isOwner" THEN 'OWNER'::"ResidentType"
        ELSE 'TENANT'::"ResidentType"
    END,
    "isOwner",
    "isPrimaryResident",
    "isActive",
    true,
    "createdAt",
    "updatedAt"
FROM "User"
WHERE "societyId" IS NOT NULL
ON CONFLICT DO NOTHING;
