-- CreateEnum
CREATE TYPE "TreatyType" AS ENUM ('NEUTRALITY', 'FREE_TRADE', 'MINOR_ALLIANCE', 'TOTAL_DEFENSE', 'ARMED_DEFENSE_PACT', 'CRUISER_PROTECTION');

-- CreateEnum
CREATE TYPE "TreatyStatus" AS ENUM ('PENDING', 'ACTIVE', 'EXPIRED', 'BROKEN');

-- CreateTable
CREATE TABLE "Treaty" (
    "id" TEXT NOT NULL,
    "fromEmpireId" TEXT NOT NULL,
    "toEmpireId" TEXT NOT NULL,
    "type" "TreatyType" NOT NULL,
    "status" "TreatyStatus" NOT NULL DEFAULT 'PENDING',
    "turnsRemaining" INTEGER NOT NULL DEFAULT 20,
    "isBinding" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Treaty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Coalition" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "leaderId" TEXT NOT NULL,
    "memberIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "maxMembers" INTEGER NOT NULL DEFAULT 5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Coalition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coalition_name_key" ON "Coalition"("name");
