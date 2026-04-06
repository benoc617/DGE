-- CreateTable
CREATE TABLE "HighScore" (
    "id" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "netWorth" INTEGER NOT NULL,
    "population" INTEGER NOT NULL,
    "planets" INTEGER NOT NULL,
    "turnsPlayed" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,
    "totalPlayers" INTEGER NOT NULL,
    "finishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HighScore_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "playerNames" TEXT[],
    "totalTurns" INTEGER NOT NULL DEFAULT 100,
    "status" TEXT NOT NULL DEFAULT 'active',
    "winnerId" TEXT,
    "winnerName" TEXT,
    "finalScores" JSONB,
    "log" JSONB[] DEFAULT ARRAY[]::JSONB[],
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);
