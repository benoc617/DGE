-- Add turnOrder to Player (position in the session's turn sequence)
ALTER TABLE "Player" ADD COLUMN "turnOrder" INTEGER NOT NULL DEFAULT 0;

-- Add currentTurnIndex to GameSession (whose turn it is right now)
ALTER TABLE "GameSession" ADD COLUMN "currentTurnIndex" INTEGER NOT NULL DEFAULT 0;
