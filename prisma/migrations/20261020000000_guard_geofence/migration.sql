-- AlterTable
ALTER TABLE "GatePoint" ADD COLUMN     "latitude" DOUBLE PRECISION,
ADD COLUMN     "longitude" DOUBLE PRECISION,
ADD COLUMN     "radiusMeters" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "GeofenceViolation" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "distanceMeters" INTEGER,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "accuracy" DOUBLE PRECISION,
    "guardId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeofenceViolation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeofenceViolation_societyId_createdAt_idx" ON "GeofenceViolation"("societyId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "GeofenceViolation" ADD CONSTRAINT "GeofenceViolation_guardId_fkey" FOREIGN KEY ("guardId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeofenceViolation" ADD CONSTRAINT "GeofenceViolation_societyId_fkey" FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;
