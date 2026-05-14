CREATE TYPE "PaymentProvider" AS ENUM ('CASHFREE');

CREATE TYPE "PaymentTransactionStatus" AS ENUM (
    'CREATED',
    'ACTIVE',
    'SUCCESS',
    'FAILED',
    'USER_DROPPED',
    'EXPIRED',
    'CANCELLED'
);

CREATE TABLE "PaymentTransaction" (
    "id" TEXT NOT NULL,
    "provider" "PaymentProvider" NOT NULL DEFAULT 'CASHFREE',
    "status" "PaymentTransactionStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "cashfreeOrderId" TEXT NOT NULL,
    "cashfreeCfOrderId" TEXT,
    "cashfreePaymentId" TEXT,
    "paymentSessionId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "webhookEventType" TEXT,
    "webhookReceivedAt" TIMESTAMP(3),
    "rawResponse" JSONB,
    "rawWebhook" JSONB,
    "invoiceId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymentTransaction_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentTransaction_cashfreeOrderId_key" ON "PaymentTransaction"("cashfreeOrderId");
CREATE UNIQUE INDEX "PaymentTransaction_cashfreePaymentId_key" ON "PaymentTransaction"("cashfreePaymentId");
CREATE UNIQUE INDEX "PaymentTransaction_idempotencyKey_key" ON "PaymentTransaction"("idempotencyKey");
CREATE INDEX "PaymentTransaction_invoiceId_status_idx" ON "PaymentTransaction"("invoiceId", "status");
CREATE INDEX "PaymentTransaction_provider_status_idx" ON "PaymentTransaction"("provider", "status");

ALTER TABLE "PaymentTransaction"
ADD CONSTRAINT "PaymentTransaction_invoiceId_fkey"
FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
