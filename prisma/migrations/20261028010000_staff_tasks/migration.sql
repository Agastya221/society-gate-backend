-- Tasks for staff: a guard or the admin gives a job (clean the lobby...) to a staff member of the staff app.
CREATE TYPE "StaffTaskStatus" AS ENUM ('ASSIGNED', 'ACCEPTED', 'DONE', 'CANCELLED');

CREATE TABLE "StaffTask" (
    "id" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "note" TEXT,
    "blockId" TEXT,
    "location" TEXT,
    "status" "StaffTaskStatus" NOT NULL DEFAULT 'ASSIGNED',
    "acceptedAt" TIMESTAMP(3),
    "doneAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "remindedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTask_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffTask_societyId_status_createdAt_idx" ON "StaffTask"("societyId", "status", "createdAt" DESC);
CREATE INDEX "StaffTask_domesticStaffId_status_idx" ON "StaffTask"("domesticStaffId", "status");

ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "Block"("id") ON DELETE SET NULL ON UPDATE CASCADE;
