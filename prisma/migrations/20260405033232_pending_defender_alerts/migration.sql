-- AlterTable
ALTER TABLE "Empire" ADD COLUMN     "pendingDefenderAlerts" TEXT[] DEFAULT ARRAY[]::TEXT[];
