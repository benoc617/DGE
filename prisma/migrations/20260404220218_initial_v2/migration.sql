-- CreateEnum
CREATE TYPE "PlanetType" AS ENUM ('FOOD', 'ORE', 'TOURISM', 'PETROLEUM', 'URBAN', 'EDUCATION', 'GOVERNMENT', 'SUPPLY', 'RESEARCH', 'ANTI_POLLUTION');

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "aiPersona" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Empire" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "credits" INTEGER NOT NULL DEFAULT 15000,
    "food" INTEGER NOT NULL DEFAULT 1000,
    "ore" INTEGER NOT NULL DEFAULT 500,
    "fuel" INTEGER NOT NULL DEFAULT 200,
    "population" INTEGER NOT NULL DEFAULT 50000,
    "taxRate" INTEGER NOT NULL DEFAULT 30,
    "civilStatus" INTEGER NOT NULL DEFAULT 0,
    "foodSellRate" INTEGER NOT NULL DEFAULT 0,
    "oreSellRate" INTEGER NOT NULL DEFAULT 50,
    "petroleumSellRate" INTEGER NOT NULL DEFAULT 50,
    "netWorth" INTEGER NOT NULL DEFAULT 0,
    "turnsPlayed" INTEGER NOT NULL DEFAULT 0,
    "turnsLeft" INTEGER NOT NULL DEFAULT 100,
    "isProtected" BOOLEAN NOT NULL DEFAULT true,
    "protectionTurns" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Empire_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Planet" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sector" INTEGER NOT NULL,
    "type" "PlanetType" NOT NULL,
    "population" INTEGER NOT NULL DEFAULT 0,
    "longTermProduction" INTEGER NOT NULL DEFAULT 100,
    "shortTermProduction" INTEGER NOT NULL DEFAULT 100,
    "defenses" INTEGER NOT NULL DEFAULT 0,
    "isRadiated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Planet_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Army" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "soldiers" INTEGER NOT NULL DEFAULT 0,
    "generals" INTEGER NOT NULL DEFAULT 0,
    "fighters" INTEGER NOT NULL DEFAULT 0,
    "defenseStations" INTEGER NOT NULL DEFAULT 0,
    "lightCruisers" INTEGER NOT NULL DEFAULT 0,
    "heavyCruisers" INTEGER NOT NULL DEFAULT 0,
    "carriers" INTEGER NOT NULL DEFAULT 0,
    "covertAgents" INTEGER NOT NULL DEFAULT 0,
    "soldiersLevel" INTEGER NOT NULL DEFAULT 0,
    "fightersLevel" INTEGER NOT NULL DEFAULT 0,
    "stationsLevel" INTEGER NOT NULL DEFAULT 0,
    "lightCruisersLevel" INTEGER NOT NULL DEFAULT 0,
    "heavyCruisersLevel" INTEGER NOT NULL DEFAULT 0,
    "commandShipStrength" INTEGER NOT NULL DEFAULT 0,
    "effectiveness" INTEGER NOT NULL DEFAULT 100,
    "covertPoints" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Army_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplyRates" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "rateSoldier" INTEGER NOT NULL DEFAULT 40,
    "rateFighter" INTEGER NOT NULL DEFAULT 20,
    "rateStation" INTEGER NOT NULL DEFAULT 10,
    "rateHeavyCruiser" INTEGER NOT NULL DEFAULT 0,
    "rateCarrier" INTEGER NOT NULL DEFAULT 0,
    "rateGeneral" INTEGER NOT NULL DEFAULT 10,
    "rateCovert" INTEGER NOT NULL DEFAULT 10,
    "rateCredits" INTEGER NOT NULL DEFAULT 10,

    CONSTRAINT "SupplyRates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "foodSupply" INTEGER NOT NULL DEFAULT 500000,
    "foodRatio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "oreSupply" INTEGER NOT NULL DEFAULT 500000,
    "oreRatio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "petroSupply" INTEGER NOT NULL DEFAULT 500000,
    "petroRatio" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "coordinatorPool" INTEGER NOT NULL DEFAULT 0,
    "lotteryPool" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TurnLog" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TurnLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameEvent" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Player_name_key" ON "Player"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Empire_playerId_key" ON "Empire"("playerId");

-- CreateIndex
CREATE UNIQUE INDEX "Army_empireId_key" ON "Army"("empireId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplyRates_empireId_key" ON "SupplyRates"("empireId");

-- AddForeignKey
ALTER TABLE "Empire" ADD CONSTRAINT "Empire_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Planet" ADD CONSTRAINT "Planet_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Army" ADD CONSTRAINT "Army_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplyRates" ADD CONSTRAINT "SupplyRates_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TurnLog" ADD CONSTRAINT "TurnLog_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
