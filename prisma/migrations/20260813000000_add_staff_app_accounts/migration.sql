CREATE TABLE "StaffAccount" (
    "id" TEXT NOT NULL,
    "domesticStaffId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "refreshToken" TEXT,
    "fcmToken" TEXT,
    "deviceType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLogin" TIMESTAMP(3),
    "lastTokenRefresh" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StaffAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffAccount_domesticStaffId_key" ON "StaffAccount"("domesticStaffId");
CREATE UNIQUE INDEX "StaffAccount_phone_key" ON "StaffAccount"("phone");
CREATE INDEX "StaffAccount_phone_idx" ON "StaffAccount"("phone");
CREATE INDEX "StaffAccount_refreshToken_idx" ON "StaffAccount"("refreshToken");
ALTER TABLE "StaffAccount" ADD CONSTRAINT "StaffAccount_domesticStaffId_fkey" FOREIGN KEY ("domesticStaffId") REFERENCES "DomesticStaff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
