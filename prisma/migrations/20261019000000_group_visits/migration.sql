-- AlterTable
ALTER TABLE "Entry" ADD COLUMN     "peopleCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "peopleLeft" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "EntryRequest" ADD COLUMN     "approvedCount" INTEGER,
ADD COLUMN     "peopleCount" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "vehicleNumber" TEXT;

-- AlterTable
ALTER TABLE "PreApprovedEntry" ADD COLUMN     "guestCount" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "TrustedVisitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedVisitor_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TrustedVisitor_societyId_idx" ON "TrustedVisitor"("societyId");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedVisitor_flatId_phone_key" ON "TrustedVisitor"("flatId", "phone");


-- AddForeignKey
ALTER TABLE "TrustedVisitor" ADD CONSTRAINT "TrustedVisitor_flatId_fkey" FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedVisitor" ADD CONSTRAINT "TrustedVisitor_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrustedVisitor" ADD CONSTRAINT "TrustedVisitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
