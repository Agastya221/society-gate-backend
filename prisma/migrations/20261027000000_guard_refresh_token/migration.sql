-- A guard who is also a resident has two apps, so the guard app gets its own refresh-token slot.
ALTER TABLE "User" ADD COLUMN "guardRefreshToken" TEXT;
