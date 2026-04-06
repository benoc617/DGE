-- Door-game simultaneous turn mode: TurnMode enum, per-session round fields,
-- per-empire turn tracking.

-- CreateEnum
CREATE TYPE "TurnMode" AS ENUM ('sequential', 'simultaneous');

-- AlterTable GameSession
ALTER TABLE "GameSession"
ADD COLUMN "turnMode" "TurnMode" NOT NULL DEFAULT 'sequential',
ADD COLUMN "actionsPerDay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "dayNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "roundStartedAt" TIMESTAMP(3);

-- AlterTable Empire
ALTER TABLE "Empire"
ADD COLUMN "turnOpen" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fullTurnsUsedThisRound" INTEGER NOT NULL DEFAULT 0;

-- AlterTable SystemSettings
ALTER TABLE "SystemSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;
