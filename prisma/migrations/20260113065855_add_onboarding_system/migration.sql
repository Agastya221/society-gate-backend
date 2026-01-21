/*
  Warnings:

  - The values [MAID] on the enum `EntryType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `maidId` on the `Entry` table. All the data in the column will be lost.
  - You are about to drop the column `block` on the `Flat` table. All the data in the column will be lost.
  - You are about to drop the `Maid` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "OnboardingStatus" AS ENUM ('DRAFT', 'PENDING_DOCS', 'PENDING_APPROVAL', 'RESUBMIT_REQUESTED', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ResidentType" AS ENUM ('OWNER', 'TENANT');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('OWNERSHIP_PROOF', 'TENANT_AGREEMENT', 'AADHAR_CARD', 'PAN_CARD', 'PASSPORT', 'DRIVING_LICENSE', 'VOTER_ID', 'OTHER');

-- CreateEnum
CREATE TYPE "OnboardingAction" AS ENUM ('CREATED', 'SOCIETY_SELECTED', 'FLAT_SELECTED', 'DOCUMENTS_UPLOADED', 'SUBMITTED_FOR_REVIEW', 'APPROVED', 'REJECTED', 'RESUBMIT_REQUESTED', 'DOCUMENTS_RESUBMITTED');

-- CreateEnum
CREATE TYPE "DomesticStaffType" AS ENUM ('MAID', 'COOK', 'NANNY', 'DRIVER', 'CLEANER', 'GARDENER', 'LAUNDRY', 'CARETAKER', 'SECURITY_GUARD', 'OTHER');

-- CreateEnum
CREATE TYPE "StaffAvailabilityStatus" AS ENUM ('AVAILABLE', 'BUSY', 'ON_LEAVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "StaffBookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "EntryType_new" AS ENUM ('VISITOR', 'DELIVERY', 'DOMESTIC_STAFF', 'CAB', 'VENDOR');
ALTER TABLE "Entry" ALTER COLUMN "type" TYPE "EntryType_new" USING ("type"::text::"EntryType_new");
ALTER TYPE "EntryType" RENAME TO "EntryType_old";
ALTER TYPE "EntryType_new" RENAME TO "EntryType";
DROP TYPE "public"."EntryType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "Entry" DROP CONSTRAINT "Entry_maidId_fkey";

-- DropForeignKey
ALTER TABLE "Maid" DROP CONSTRAINT "Maid_flatId_fkey";

-- DropForeignKey
ALTER TABLE "Maid" DROP CONSTRAINT "Maid_societyId_fkey";

-- AlterTable
ALTER TABLE "Entry" DROP COLUMN "maidId",
ADD COLUMN     "domesticStaffId" TEXT;

-- AlterTable
ALTER TABLE "Flat" DROP COLUMN "block",
ADD COLUMN     "blockId" TEXT,
ADD COLUMN     "currentOwnerId" TEXT,
ADD COLUMN     "currentTenantId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "isOccupied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "ownerEmail" TEXT;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "isActive" SET DEFAULT false;

-- DropTable
DROP TABLE "Maid";

-- CreateTable
CREATE TABLE "Block" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "totalFloors" INTEGER,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DomesticStaff" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "photoUrl" TEXT,
    "staffType" "DomesticStaffType" NOT NULL,
    "experienceYears" INTEGER,
    "description" TEXT,
    "languages" TEXT[],
    "idProofType" TEXT,
    "idProofNumber" TEXT,
    "idProofUrl" TEXT,
    "address" TEXT,
    "emergencyContact" TEXT,
    "isFullTime" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" TEXT[],
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "availabilityStatus" "StaffAvailabilityStatus" NOT NULL DEFAULT 'AVAILABLE',
    "hourlyRate" DOUBLE PRECISION,
    "dailyRate" DOUBLE PRECISION,
    "monthlyRate" DOUBLE PRECISION,
    "rating" DOUBLE PRECISION DEFAULT 0,
    "totalReviews" INTEGER NOT NULL DEFAULT 0,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "verifiedBy" TEXT,
    "societyId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isCurrentlyWorking" BOOLEAN NOT NULL DEFAULT false,
    "currentFlatId" TEXT,
    "lastCheckIn" TIMESTAMP(3),
    "lastCheckOut" TIMESTAMP(3),
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "flatId" TEXT,

    CONSTRAINT "DomesticStaff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffFlatAssignment" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "workingDays" TEXT[],
    "workStartTime" TEXT,
    "workEndTime" TEXT,
    "agreedRate" DOUBLE PRECISION,
    "rateType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffFlatAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAttendance" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "checkInTime" TIMESTAMP(3) NOT NULL,
    "checkOutTime" TIMESTAMP(3),
    "duration" INTEGER,
    "checkInMethod" TEXT NOT NULL DEFAULT 'QR',
    "checkOutMethod" TEXT,
    "verifiedByGuardId" TEXT,
    "notes" TEXT,
    "workCompleted" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffBooking" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "bookedById" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "bookingDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "durationHours" DOUBLE PRECISION NOT NULL,
    "workType" TEXT NOT NULL,
    "requirements" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "status" "StaffBookingStatus" NOT NULL DEFAULT 'PENDING',
    "acceptedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "completedAt" TIMESTAMP(3),
    "actualDuration" DOUBLE PRECISION,
    "finalCost" DOUBLE PRECISION,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffBooking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffReview" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "review" TEXT,
    "workQuality" INTEGER,
    "punctuality" INTEGER,
    "behavior" INTEGER,
    "workType" TEXT,
    "workDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "blockId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "residentType" "ResidentType" NOT NULL,
    "status" "OnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "resubmitReason" TEXT,
    "resubmissionCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResidentDocument" (
    "id" TEXT NOT NULL,
    "onboardingRequestId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "documentUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResidentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingAuditLog" (
    "id" TEXT NOT NULL,
    "onboardingRequestId" TEXT NOT NULL,
    "action" "OnboardingAction" NOT NULL,
    "performedBy" TEXT NOT NULL,
    "previousStatus" "OnboardingStatus",
    "newStatus" "OnboardingStatus",
    "notes" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OnboardingAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Block_societyId_isActive_idx" ON "Block"("societyId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Block_societyId_name_key" ON "Block"("societyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticStaff_phone_key" ON "DomesticStaff"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "DomesticStaff_qrToken_key" ON "DomesticStaff"("qrToken");

-- CreateIndex
CREATE INDEX "DomesticStaff_qrToken_idx" ON "DomesticStaff"("qrToken");

-- CreateIndex
CREATE INDEX "DomesticStaff_societyId_staffType_idx" ON "DomesticStaff"("societyId", "staffType");

-- CreateIndex
CREATE INDEX "DomesticStaff_societyId_availabilityStatus_idx" ON "DomesticStaff"("societyId", "availabilityStatus");

-- CreateIndex
CREATE INDEX "DomesticStaff_phone_idx" ON "DomesticStaff"("phone");

-- CreateIndex
CREATE INDEX "StaffFlatAssignment_flatId_idx" ON "StaffFlatAssignment"("flatId");

-- CreateIndex
CREATE INDEX "StaffFlatAssignment_domesticStaffId_isActive_idx" ON "StaffFlatAssignment"("domesticStaffId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "StaffFlatAssignment_domesticStaffId_flatId_key" ON "StaffFlatAssignment"("domesticStaffId", "flatId");

-- CreateIndex
CREATE INDEX "StaffAttendance_domesticStaffId_checkInTime_idx" ON "StaffAttendance"("domesticStaffId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffAttendance_flatId_checkInTime_idx" ON "StaffAttendance"("flatId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffAttendance_societyId_checkInTime_idx" ON "StaffAttendance"("societyId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "StaffBooking_domesticStaffId_bookingDate_idx" ON "StaffBooking"("domesticStaffId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffBooking_bookedById_status_idx" ON "StaffBooking"("bookedById", "status");

-- CreateIndex
CREATE INDEX "StaffBooking_flatId_bookingDate_idx" ON "StaffBooking"("flatId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffBooking_societyId_bookingDate_idx" ON "StaffBooking"("societyId", "bookingDate");

-- CreateIndex
CREATE INDEX "StaffReview_domesticStaffId_rating_idx" ON "StaffReview"("domesticStaffId", "rating");

-- CreateIndex
CREATE INDEX "StaffReview_reviewerId_idx" ON "StaffReview"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "OnboardingRequest_userId_key" ON "OnboardingRequest"("userId");

-- CreateIndex
CREATE INDEX "OnboardingRequest_userId_status_idx" ON "OnboardingRequest"("userId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_societyId_status_idx" ON "OnboardingRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_flatId_status_idx" ON "OnboardingRequest"("flatId", "status");

-- CreateIndex
CREATE INDEX "OnboardingRequest_status_createdAt_idx" ON "OnboardingRequest"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ResidentDocument_onboardingRequestId_idx" ON "ResidentDocument"("onboardingRequestId");

-- CreateIndex
CREATE INDEX "ResidentDocument_documentType_idx" ON "ResidentDocument"("documentType");

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_onboardingRequestId_createdAt_idx" ON "OnboardingAuditLog"("onboardingRequestId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "OnboardingAuditLog_performedBy_idx" ON "OnboardingAuditLog"("performedBy");

-- CreateIndex
CREATE INDEX "Flat_blockId_idx" ON "Flat"("blockId");

-- CreateIndex
CREATE INDEX "Flat_isOccupied_idx" ON "Flat"("isOccupied");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Block" ADD CONSTRAINT "Block_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DomesticStaff" ADD CONSTRAINT "DomesticStaff_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFlatAssignment" ADD CONSTRAINT "StaffFlatAssignment_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffFlatAssignment" ADD CONSTRAINT "StaffFlatAssignment_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAttendance" ADD CONSTRAINT "StaffAttendance_verifiedByGuardId_fkey" FOREIGN KEY ("verifiedByGuardId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_bookedById_fkey" FOREIGN KEY ("bookedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffBooking" ADD CONSTRAINT "StaffBooking_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffReview" ADD CONSTRAINT "StaffReview_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingRequest" ADD CONSTRAINT "OnboardingRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ResidentDocument" ADD CONSTRAINT "ResidentDocument_onboardingRequestId_fkey" FOREIGN KEY ("onboardingRequestId") REFERENCES "OnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditLog" ADD CONSTRAINT "OnboardingAuditLog_onboardingRequestId_fkey" FOREIGN KEY ("onboardingRequestId") REFERENCES "OnboardingRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingAuditLog" ADD CONSTRAINT "OnboardingAuditLog_performedBy_fkey" FOREIGN KEY ("performedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
