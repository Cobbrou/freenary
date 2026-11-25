-- AlterTable
ALTER TABLE "user" ADD COLUMN     "reportingCurrency" TEXT;

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "exchangeFeeMinor" INTEGER,
ADD COLUMN     "originalAmount" INTEGER,
ADD COLUMN     "originalCurrency" TEXT;

-- CreateTable
CREATE TABLE "account_balance" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "balanceMinor" INTEGER NOT NULL,
    "balanceAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_balance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rate" (
    "currency" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ratePerEur" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "exchange_rate_pkey" PRIMARY KEY ("currency","date")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_balance_accountId_currency_key" ON "account_balance"("accountId", "currency");

-- AddForeignKey
ALTER TABLE "account_balance" ADD CONSTRAINT "account_balance_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "bank_account"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Backfill
INSERT INTO "account_balance" ("id", "accountId", "currency", "balanceMinor", "balanceAt", "updatedAt")
SELECT gen_random_uuid()::text, "id", "currency", "balanceMinor", "balanceAt", CURRENT_TIMESTAMP
FROM "bank_account"
WHERE "currency" IS NOT NULL AND "balanceMinor" IS NOT NULL;
