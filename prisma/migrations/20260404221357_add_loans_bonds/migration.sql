-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "principal" INTEGER NOT NULL,
    "balance" INTEGER NOT NULL,
    "interestRate" INTEGER NOT NULL DEFAULT 50,
    "turnsRemaining" INTEGER NOT NULL DEFAULT 20,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bond" (
    "id" TEXT NOT NULL,
    "empireId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "interestRate" INTEGER NOT NULL DEFAULT 10,
    "turnsRemaining" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bond_pkey" PRIMARY KEY ("id")
);
