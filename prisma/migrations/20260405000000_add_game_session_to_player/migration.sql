-- Drop the old unique constraint on name
DROP INDEX IF EXISTS "Player_name_key";

-- Add gameSessionId column
ALTER TABLE "Player" ADD COLUMN "gameSessionId" TEXT;

-- Add foreign key
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameSessionId_fkey" FOREIGN KEY ("gameSessionId") REFERENCES "GameSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add compound unique (name + gameSessionId)
CREATE UNIQUE INDEX "Player_name_gameSessionId_key" ON "Player"("name", "gameSessionId");
