-- AlterTable
ALTER TABLE "budget_line" ALTER COLUMN "amount" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "bank_account" ALTER COLUMN "balanceMinor" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "account_balance" ALTER COLUMN "balanceMinor" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "holding" ALTER COLUMN "valuationMinor" SET DATA TYPE BIGINT,
ALTER COLUMN "unrealisedGainMinor" SET DATA TYPE BIGINT;

-- AlterTable
ALTER TABLE "transaction" ALTER COLUMN "amount" SET DATA TYPE BIGINT,
ALTER COLUMN "originalAmount" SET DATA TYPE BIGINT,
ALTER COLUMN "balanceAfterTransaction" SET DATA TYPE BIGINT,
ALTER COLUMN "exchangeFeeMinor" SET DATA TYPE BIGINT;

