-- CreateTable
CREATE TABLE "Research" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "accumulatedPoints" INTEGER NOT NULL DEFAULT 0,
    "unlockedTechIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Research_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Research_empireId_key" ON "Research"("empireId");

-- AddForeignKey
ALTER TABLE "Research" ADD CONSTRAINT "Research_empireId_fkey" FOREIGN KEY ("empireId") REFERENCES "Empire"("id") ON DELETE CASCADE ON UPDATE CASCADE;
