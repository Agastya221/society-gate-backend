-- AlterTable
ALTER TABLE "User" ADD COLUMN     "guardShiftId" TEXT;

-- CreateTable
CREATE TABLE "GuardShift" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "graceMinutes" INTEGER NOT NULL DEFAULT 15,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuardShift_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardShift_societyId_idx" ON "GuardShift"("societyId");

-- AddForeignKey
ALTER TABLE "GuardShift" ADD CONSTRAINT "GuardShift_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_guardShiftId_fkey" FOREIGN KEY ("guardShiftId") REFERENCES "GuardShift"("id") ON DELETE SET NULL ON UPDATE CASCADE;
