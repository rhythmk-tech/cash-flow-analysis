-- AlterTable
ALTER TABLE "LineItem" ADD COLUMN     "endDate" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "monthlySummaryMonths" INTEGER NOT NULL DEFAULT 12;
