-- CreateEnum
CREATE TYPE "BudgetMonthAnchor" AS ENUM ('DAY_OF_MONTH', 'LAST_DAY', 'LAST_WORKING_DAY');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "budgetMonthAnchor" "BudgetMonthAnchor" NOT NULL DEFAULT 'LAST_WORKING_DAY',
ADD COLUMN     "budgetMonthHolidayCountry" TEXT,
ADD COLUMN     "budgetMonthStartDay" INTEGER NOT NULL DEFAULT 1;
