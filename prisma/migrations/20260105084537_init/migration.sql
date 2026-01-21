-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'GUARD', 'RESIDENT');

-- CreateEnum
CREATE TYPE "EntryType" AS ENUM ('VISITOR', 'DELIVERY', 'MAID', 'CAB', 'VENDOR');

-- CreateEnum
CREATE TYPE "EntryStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CHECKED_IN', 'CHECKED_OUT');

-- CreateEnum
CREATE TYPE "VisitorType" AS ENUM ('GUEST', 'DELIVERY_PERSON', 'CAB_DRIVER', 'SERVICE_PROVIDER', 'OTHER');

-- CreateEnum
CREATE TYPE "PreApprovalStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'USED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "Society" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "pincode" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "contactEmail" TEXT,
    "totalFlats" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "monthlyFee" DOUBLE PRECISION NOT NULL DEFAULT 500,
    "lastPaidDate" TIMESTAMP(3),
    "nextDueDate" TIMESTAMP(3) NOT NULL,
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Society_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GatePoint" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GatePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flat" (
    "id" TEXT NOT NULL,
    "flatNumber" TEXT NOT NULL,
    "floor" TEXT,
    "block" TEXT,
    "ownerName" TEXT,
    "ownerPhone" TEXT,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Flat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "password" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "photoUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "flatId" TEXT,
    "isOwner" BOOLEAN NOT NULL DEFAULT false,
    "societyId" TEXT NOT NULL,
    "lastLogin" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Entry" (
    "id" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "status" "EntryStatus" NOT NULL DEFAULT 'PENDING',
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT,
    "visitorType" "VisitorType" NOT NULL DEFAULT 'GUEST',
    "visitorPhoto" TEXT,
    "purpose" TEXT,
    "vehicleNumber" TEXT,
    "companyName" TEXT,
    "packageCount" INTEGER DEFAULT 1,
    "wasAutoApproved" BOOLEAN NOT NULL DEFAULT false,
    "autoApprovalReason" TEXT,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "gatePointId" TEXT,
    "createdById" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "checkInTime" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "checkOutTime" TIMESTAMP(3),
    "preApprovalId" TEXT,
    "maidId" TEXT,
    "remarks" TEXT,
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Entry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PreApproval" (
    "id" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "visitorType" "VisitorType" NOT NULL,
    "purpose" TEXT,
    "vehicleNumber" TEXT,
    "qrToken" TEXT NOT NULL,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "PreApprovalStatus" NOT NULL DEFAULT 'ACTIVE',
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PreApproval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpectedDelivery" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "itemName" TEXT,
    "expectedDate" TIMESTAMP(3) NOT NULL,
    "timeFrom" TEXT,
    "timeUntil" TEXT,
    "autoApprove" BOOLEAN NOT NULL DEFAULT true,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpectedDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryAutoApproveRule" (
    "id" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "companies" TEXT[],
    "allowedDays" TEXT[],
    "timeFrom" TEXT,
    "timeUntil" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryAutoApproveRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Maid" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "photoUrl" TEXT,
    "workType" TEXT NOT NULL,
    "workingDays" TEXT[],
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "qrToken" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isInside" BOOLEAN NOT NULL DEFAULT false,
    "lastCheckIn" TIMESTAMP(3),
    "lastCheckOut" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Maid_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" TEXT NOT NULL,
    "vehicleNumber" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL,
    "model" TEXT,
    "color" TEXT,
    "userId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitorFrequency" (
    "id" TEXT NOT NULL,
    "visitorPhone" TEXT NOT NULL,
    "visitorName" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "visitCount" INTEGER NOT NULL DEFAULT 1,
    "lastVisit" TIMESTAMP(3) NOT NULL,
    "isFrequent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisitorFrequency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentReminder" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "reminderSentAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentReminder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Society_city_isActive_idx" ON "Society"("city", "isActive");

-- CreateIndex
CREATE INDEX "Society_paymentStatus_nextDueDate_idx" ON "Society"("paymentStatus", "nextDueDate");

-- CreateIndex
CREATE INDEX "GatePoint_societyId_isActive_idx" ON "GatePoint"("societyId", "isActive");

-- CreateIndex
CREATE INDEX "Flat_societyId_idx" ON "Flat"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "Flat_societyId_flatNumber_key" ON "Flat"("societyId", "flatNumber");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE INDEX "User_societyId_role_idx" ON "User"("societyId", "role");

-- CreateIndex
CREATE INDEX "User_phone_idx" ON "User"("phone");

-- CreateIndex
CREATE INDEX "Entry_societyId_status_checkInTime_idx" ON "Entry"("societyId", "status", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "Entry_flatId_checkInTime_idx" ON "Entry"("flatId", "checkInTime" DESC);

-- CreateIndex
CREATE INDEX "Entry_visitorPhone_idx" ON "Entry"("visitorPhone");

-- CreateIndex
CREATE INDEX "Entry_createdById_idx" ON "Entry"("createdById");

-- CreateIndex
CREATE INDEX "Entry_type_companyName_checkInTime_idx" ON "Entry"("type", "companyName", "checkInTime" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "PreApproval_qrToken_key" ON "PreApproval"("qrToken");

-- CreateIndex
CREATE INDEX "PreApproval_qrToken_idx" ON "PreApproval"("qrToken");

-- CreateIndex
CREATE INDEX "PreApproval_societyId_status_idx" ON "PreApproval"("societyId", "status");

-- CreateIndex
CREATE INDEX "PreApproval_flatId_validUntil_idx" ON "PreApproval"("flatId", "validUntil");

-- CreateIndex
CREATE INDEX "ExpectedDelivery_flatId_expectedDate_isUsed_idx" ON "ExpectedDelivery"("flatId", "expectedDate", "isUsed");

-- CreateIndex
CREATE INDEX "ExpectedDelivery_societyId_expectedDate_idx" ON "ExpectedDelivery"("societyId", "expectedDate");

-- CreateIndex
CREATE INDEX "DeliveryAutoApproveRule_flatId_isActive_idx" ON "DeliveryAutoApproveRule"("flatId", "isActive");

-- CreateIndex
CREATE INDEX "DeliveryAutoApproveRule_societyId_idx" ON "DeliveryAutoApproveRule"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "Maid_qrToken_key" ON "Maid"("qrToken");

-- CreateIndex
CREATE INDEX "Maid_qrToken_idx" ON "Maid"("qrToken");

-- CreateIndex
CREATE INDEX "Maid_societyId_flatId_idx" ON "Maid"("societyId", "flatId");

-- CreateIndex
CREATE INDEX "Vehicle_userId_idx" ON "Vehicle"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_societyId_vehicleNumber_key" ON "Vehicle"("societyId", "vehicleNumber");

-- CreateIndex
CREATE INDEX "VisitorFrequency_societyId_isFrequent_idx" ON "VisitorFrequency"("societyId", "isFrequent");

-- CreateIndex
CREATE UNIQUE INDEX "VisitorFrequency_societyId_flatId_visitorPhone_key" ON "VisitorFrequency"("societyId", "flatId", "visitorPhone");

-- CreateIndex
CREATE INDEX "PaymentReminder_societyId_isPaid_dueDate_idx" ON "PaymentReminder"("societyId", "isPaid", "dueDate");

-- AddForeignKey
ALTER TABLE "GatePoint" ADD CONSTRAINT "GatePoint_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Flat" ADD CONSTRAINT "Flat_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_gatePointId_fkey" FOREIGN KEY ("gatePointId") REFERENCES "GatePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_preApprovalId_fkey" FOREIGN KEY ("preApprovalId") REFERENCES "PreApproval"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_maidId_fkey" FOREIGN KEY ("maidId") REFERENCES "Maid"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApproval" ADD CONSTRAINT "PreApproval_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApproval" ADD CONSTRAINT "PreApproval_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PreApproval" ADD CONSTRAINT "PreApproval_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedDelivery" ADD CONSTRAINT "ExpectedDelivery_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedDelivery" ADD CONSTRAINT "ExpectedDelivery_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpectedDelivery" ADD CONSTRAINT "ExpectedDelivery_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAutoApproveRule" ADD CONSTRAINT "DeliveryAutoApproveRule_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAutoApproveRule" ADD CONSTRAINT "DeliveryAutoApproveRule_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryAutoApproveRule" ADD CONSTRAINT "DeliveryAutoApproveRule_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maid" ADD CONSTRAINT "Maid_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Maid" ADD CONSTRAINT "Maid_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorFrequency" ADD CONSTRAINT "VisitorFrequency_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitorFrequency" ADD CONSTRAINT "VisitorFrequency_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentReminder" ADD CONSTRAINT "PaymentReminder_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
