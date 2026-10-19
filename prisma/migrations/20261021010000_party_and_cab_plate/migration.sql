-- AlterTable
ALTER TABLE "GuestInvite" ADD COLUMN     "guestCount" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "PreApprovedMeta" ADD COLUMN     "vehicleNumber" TEXT;
