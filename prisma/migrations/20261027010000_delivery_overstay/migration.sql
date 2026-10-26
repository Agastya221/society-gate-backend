-- Delivery watch: remember when guards were reminded about a long stay and when the flat was last poked.
ALTER TABLE "Entry" ADD COLUMN "overstayAlertedAt" TIMESTAMP(3),
                    ADD COLUMN "lastNudgeAt" TIMESTAMP(3);
