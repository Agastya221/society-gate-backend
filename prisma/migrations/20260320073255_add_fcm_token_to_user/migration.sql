/*
  Warnings:

  - You are about to drop the `Invitation` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "FamilyRole" AS ENUM ('SPOUSE', 'CHILD', 'PARENT', 'SIBLING', 'OTHER');

-- CreateEnum
CREATE TYPE "SocietyRegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
ALTER TYPE "ComplaintCategory" ADD VALUE 'PLUMBING';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'STAFF_CHECKIN';
ALTER TYPE "NotificationType" ADD VALUE 'STAFF_CHECKOUT';

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_createdById_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_flatId_fkey";

-- DropForeignKey
ALTER TABLE "Invitation" DROP CONSTRAINT "Invitation_societyId_fkey";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deviceType" TEXT,
ADD COLUMN     "familyRole" "FamilyRole",
ADD COLUMN     "fcmToken" TEXT,
ADD COLUMN     "isPrimaryResident" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "lastTokenRefresh" TIMESTAMP(3),
ADD COLUMN     "primaryResidentId" TEXT,
ADD COLUMN     "refreshToken" TEXT,
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;

-- DropTable
DROP TABLE "Invitation";

-- DropEnum
DROP TYPE "InvitationStatus";

-- CreateTable
CREATE TABLE "SocietyRegistrationRequest" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requestedById" TEXT NOT NULL,
    "societyName" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "totalFlats" INTEGER,
    "monthlyFee" DOUBLE PRECISION,
    "status" "SocietyRegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "societyId" TEXT,

    CONSTRAINT "SocietyRegistrationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SocietyRegistrationRequest_societyId_key" ON "SocietyRegistrationRequest"("societyId");

-- CreateIndex
CREATE INDEX "SocietyRegistrationRequest_status_idx" ON "SocietyRegistrationRequest"("status");

-- CreateIndex
CREATE INDEX "SocietyRegistrationRequest_requestedById_idx" ON "SocietyRegistrationRequest"("requestedById");

-- CreateIndex
CREATE INDEX "User_refreshToken_idx" ON "User"("refreshToken");

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SocietyRegistrationRequest" ADD CONSTRAINT "SocietyRegistrationRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_primaryResidentId_fkey" FOREIGN KEY ("primaryResidentId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
