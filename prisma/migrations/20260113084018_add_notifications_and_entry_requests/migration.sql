-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ONBOARDING_STATUS', 'ENTRY_REQUEST', 'DELIVERY_REQUEST', 'EMERGENCY_ALERT', 'SYSTEM');

-- CreateEnum
CREATE TYPE "EntryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "ProviderTag" AS ENUM ('BLINKIT', 'SWIGGY', 'ZOMATO', 'AMAZON', 'FLIPKART', 'BIGBASKET', 'DUNZO', 'OTHER');

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" JSONB,
    "userId" TEXT NOT NULL,
    "societyId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "referenceId" TEXT,
    "referenceType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntryRequest" (
    "id" TEXT NOT NULL,
    "type" "EntryType" NOT NULL,
    "status" "EntryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "visitorName" TEXT,
    "visitorPhone" TEXT,
    "providerTag" "ProviderTag",
    "photoKey" TEXT,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "entryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EntryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_createdAt_idx" ON "Notification"("userId", "isRead", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notification_societyId_createdAt_idx" ON "Notification"("societyId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "EntryRequest_entryId_key" ON "EntryRequest"("entryId");

-- CreateIndex
CREATE INDEX "EntryRequest_flatId_status_createdAt_idx" ON "EntryRequest"("flatId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "EntryRequest_guardId_status_idx" ON "EntryRequest"("guardId", "status");

-- CreateIndex
CREATE INDEX "EntryRequest_societyId_status_idx" ON "EntryRequest"("societyId", "status");

-- CreateIndex
CREATE INDEX "EntryRequest_status_expiresAt_idx" ON "EntryRequest"("status", "expiresAt");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntryRequest" ADD CONSTRAINT "EntryRequest_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
