CREATE TABLE IF NOT EXISTS "EntryRequestTarget" (
  "id" TEXT NOT NULL,
  "entryRequestId" TEXT NOT NULL,
  "flatId" TEXT NOT NULL,
  "societyId" TEXT NOT NULL,
  "entryId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EntryRequestTarget_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EntryRequestTarget_entryRequestId_flatId_key"
  ON "EntryRequestTarget"("entryRequestId", "flatId");

CREATE UNIQUE INDEX IF NOT EXISTS "EntryRequestTarget_entryId_key"
  ON "EntryRequestTarget"("entryId");

CREATE INDEX IF NOT EXISTS "EntryRequestTarget_entryRequestId_idx"
  ON "EntryRequestTarget"("entryRequestId");

CREATE INDEX IF NOT EXISTS "EntryRequestTarget_flatId_idx"
  ON "EntryRequestTarget"("flatId");

CREATE INDEX IF NOT EXISTS "EntryRequestTarget_societyId_flatId_idx"
  ON "EntryRequestTarget"("societyId", "flatId");

INSERT INTO "EntryRequestTarget" (
  "id",
  "entryRequestId",
  "flatId",
  "societyId",
  "entryId",
  "createdAt"
)
SELECT
  md5("id" || ':' || "flatId"),
  "id",
  "flatId",
  "societyId",
  "entryId",
  "createdAt"
FROM "EntryRequest"
ON CONFLICT DO NOTHING;

ALTER TABLE "EntryRequestTarget"
  ADD CONSTRAINT "EntryRequestTarget_entryRequestId_fkey"
  FOREIGN KEY ("entryRequestId") REFERENCES "EntryRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryRequestTarget"
  ADD CONSTRAINT "EntryRequestTarget_flatId_fkey"
  FOREIGN KEY ("flatId") REFERENCES "Flat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryRequestTarget"
  ADD CONSTRAINT "EntryRequestTarget_societyId_fkey"
  FOREIGN KEY ("societyId") REFERENCES "Society"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EntryRequestTarget"
  ADD CONSTRAINT "EntryRequestTarget_entryId_fkey"
  FOREIGN KEY ("entryId") REFERENCES "Entry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
