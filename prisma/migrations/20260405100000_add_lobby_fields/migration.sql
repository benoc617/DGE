-- AlterTable
ALTER TABLE "GameSession" ADD COLUMN "galaxyName" TEXT,
ADD COLUMN "createdBy" TEXT,
ADD COLUMN "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "inviteCode" TEXT,
ADD COLUMN "maxPlayers" INTEGER NOT NULL DEFAULT 8;

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_galaxyName_key" ON "GameSession"("galaxyName");

-- CreateIndex
CREATE UNIQUE INDEX "GameSession_inviteCode_key" ON "GameSession"("inviteCode");
