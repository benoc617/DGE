-- CreateEnum
CREATE TYPE "TurnMode" AS ENUM ('sequential', 'simultaneous');

-- CreateEnum
CREATE TYPE "SlotPhase" AS ENUM ('collecting', 'resolving');

-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN     "actionsPerDay" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "dayNumber" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "resolvingPlayerId" TEXT,
ADD COLUMN     "slotIndex" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "slotPhase" "SlotPhase" NOT NULL DEFAULT 'collecting',
ADD COLUMN     "slotStartedAt" TIMESTAMP(3),
ADD COLUMN     "turnMode" "TurnMode" NOT NULL DEFAULT 'sequential';

-- AlterTable
ALTER TABLE "SystemSettings" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "PendingIntent" (
    "id" TEXT NOT NULL,
    "gameSessionId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "dayNumber" INTEGER NOT NULL,
    "slotIndex" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PendingIntent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PendingIntent_gameSessionId_dayNumber_slotIndex_idx" ON "PendingIntent"("gameSessionId", "dayNumber", "slotIndex");

-- CreateIndex
CREATE UNIQUE INDEX "PendingIntent_gameSessionId_playerId_dayNumber_slotIndex_key" ON "PendingIntent"("gameSessionId", "playerId", "dayNumber", "slotIndex");

-- AddForeignKey
ALTER TABLE "PendingIntent" ADD CONSTRAINT "PendingIntent_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PendingIntent" ADD CONSTRAINT "PendingIntent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;
