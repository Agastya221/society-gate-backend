-- CreateTable
CREATE TABLE "GuardDuty" (
    "id" TEXT NOT NULL,
    "guardId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "gatePointId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startLatitude" DOUBLE PRECISION,
    "startLongitude" DOUBLE PRECISION,
    "endedAt" TIMESTAMP(3),
    "endedBy" TEXT,

    CONSTRAINT "GuardDuty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuardDuty_guardId_endedAt_idx" ON "GuardDuty"("guardId", "endedAt");

-- CreateIndex
CREATE INDEX "GuardDuty_societyId_startedAt_idx" ON "GuardDuty"("societyId", "startedAt" DESC);

-- AddForeignKey
ALTER TABLE "GuardDuty" ADD CONSTRAINT "GuardDuty_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDuty" ADD CONSTRAINT "GuardDuty_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuardDuty" ADD CONSTRAINT "GuardDuty_gatePointId_fkey" FOREIGN KEY ("gatePointId") REFERENCES "GatePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
