-- CreateEnum
CREATE TYPE "InviteType" AS ENUM ('GUEST', 'DELIVERY_ONCE', 'DELIVERY_STANDING', 'CAB', 'SERVICE');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "invitePassId" TEXT;

-- CreateTable
CREATE TABLE "InvitePass" (
    "id" TEXT NOT NULL,
    "type" "InviteType" NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'ACTIVE',
    "visitorName" TEXT,
    "visitorPhone" TEXT,
    "companyName" TEXT,
    "companies" TEXT[],
    "vehicleNumber" TEXT,
    "purpose" TEXT,
    "visitorPhoto" TEXT,
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "allowedDays" TEXT[],
    "timeFrom" TEXT,
    "timeUntil" TEXT,
    "maxUses" INTEGER NOT NULL DEFAULT 1,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "qrToken" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvitePass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InvitePass_qrToken_key" ON "InvitePass"("qrToken");

-- CreateIndex
CREATE INDEX "InvitePass_flatId_status_validUntil_idx" ON "InvitePass"("flatId", "status", "validUntil");

-- CreateIndex
CREATE INDEX "InvitePass_societyId_status_idx" ON "InvitePass"("societyId", "status");

-- CreateIndex
CREATE INDEX "InvitePass_qrToken_idx" ON "InvitePass"("qrToken");

-- CreateIndex
CREATE INDEX "InvitePass_flatId_type_status_idx" ON "InvitePass"("flatId", "type", "status");

-- AddForeignKey
ALTER TABLE "Entry" ADD CONSTRAINT "Entry_invitePassId_fkey" FOREIGN KEY ("invitePassId") REFERENCES "InvitePass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitePass" ADD CONSTRAINT "InvitePass_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitePass" ADD CONSTRAINT "InvitePass_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvitePass" ADD CONSTRAINT "InvitePass_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
