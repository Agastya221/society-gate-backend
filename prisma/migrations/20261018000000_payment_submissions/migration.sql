-- CreateEnum
CREATE TYPE "PaymentSubmissionStatus" AS ENUM ('SUBMITTED', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "PaymentSubmission" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "societyId" TEXT NOT NULL,
    "flatId" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "utr" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'UPI',
    "status" "PaymentSubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "rejectionReason" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

CONSTRAINT "PaymentSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentSubmission_societyId_status_idx" ON "PaymentSubmission"("societyId", "status");

-- CreateIndex
CREATE INDEX "PaymentSubmission_invoiceId_status_idx" ON "PaymentSubmission"("invoiceId", "status");

-- CreateIndex
CREATE INDEX "PaymentSubmission_submittedById_idx" ON "PaymentSubmission"("submittedById");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentSubmission_societyId_utr_key" ON "PaymentSubmission"("societyId", "utr");

-- AddForeignKey
ALTER TABLE "PaymentSubmission" ADD CONSTRAINT "PaymentSubmission_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
