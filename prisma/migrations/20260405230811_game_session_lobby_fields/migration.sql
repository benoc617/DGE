-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "waitingForHuman" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "turnStartedAt" DROP NOT NULL,
ALTER COLUMN "turnStartedAt" DROP DEFAULT;
