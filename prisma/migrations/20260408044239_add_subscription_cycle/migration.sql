-- Add SubscriptionCycle enum and Society.subscriptionCycle column
-- Safe to run on existing databases: uses IF NOT EXISTS and a non-null default.

DO $$ BEGIN
  CREATE TYPE "SubscriptionCycle" AS ENUM ('MONTHLY', 'QUARTERLY', 'ANNUALLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Society"
  ADD COLUMN IF NOT EXISTS "subscriptionCycle" "SubscriptionCycle" NOT NULL DEFAULT 'MONTHLY';
