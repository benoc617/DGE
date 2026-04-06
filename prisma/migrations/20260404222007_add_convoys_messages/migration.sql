-- CreateEnum
CREATE TYPE "ConvoyType" AS ENUM ('TRADE', 'MILITARY', 'COLONIZATION');

-- CreateTable
CREATE TABLE "Convoy" (
    "id" TEXT NOT NULL,
    "fromEmpireId" TEXT NOT NULL,
    "toEmpireId" TEXT,
    "type" "ConvoyType" NOT NULL,
    "contents" JSONB NOT NULL DEFAULT '{}',
    "turnsRemaining" INTEGER NOT NULL DEFAULT 5,
    "sectorFrom" INTEGER NOT NULL,
    "sectorTo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Convoy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL,
    "fromPlayerId" TEXT NOT NULL,
    "toPlayerId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);
