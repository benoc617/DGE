-- Door game mode: remove slot/intent model; add round + per-empire turn counters.

-- AlterTable Empire
ALTER TABLE "Empire" ADD COLUMN "turnOpen" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Empire" ADD COLUMN "fullTurnsUsedThisRound" INTEGER NOT NULL DEFAULT 0;

-- AlterTable GameSession: new round timestamp, then drop slot columns
ALTER TABLE "GameSession" ADD COLUMN "roundStartedAt" TIMESTAMP(3);

UPDATE "GameSession" SET "roundStartedAt" = "slotStartedAt" WHERE "slotStartedAt" IS NOT NULL;

-- Drop pending intents
DROP TABLE IF EXISTS "PendingIntent";

ALTER TABLE "GameSession" DROP COLUMN "slotIndex";
ALTER TABLE "GameSession" DROP COLUMN "slotPhase";
ALTER TABLE "GameSession" DROP COLUMN "slotStartedAt";
ALTER TABLE "GameSession" DROP COLUMN "resolvingPlayerId";

DROP TYPE IF EXISTS "SlotPhase";
