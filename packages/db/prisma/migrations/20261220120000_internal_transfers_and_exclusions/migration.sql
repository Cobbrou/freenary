-- CreateEnum
CREATE TYPE "TransactionExclusion" AS ENUM ('TRANSACTION', 'MERCHANT');

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "exclusion" "TransactionExclusion";

-- CreateTable
CREATE TABLE "excluded_merchant" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "merchantKey" TEXT NOT NULL,
    "merchantName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "excluded_merchant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "own_counterparty" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "isOwn" BOOLEAN NOT NULL,
    "source" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "own_counterparty_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "excluded_merchant_userId_idx" ON "excluded_merchant"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "excluded_merchant_userId_merchantKey_key" ON "excluded_merchant"("userId", "merchantKey");

-- CreateIndex
CREATE INDEX "own_counterparty_userId_idx" ON "own_counterparty"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "own_counterparty_userId_kind_key_key" ON "own_counterparty"("userId", "kind", "key");

-- AddForeignKey
ALTER TABLE "excluded_merchant" ADD CONSTRAINT "excluded_merchant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "own_counterparty" ADD CONSTRAINT "own_counterparty_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- A transfer between the member's own accounts is a category again. Give it to
-- the legs the pipeline paired without one, so they show under Transfers.
UPDATE "transaction"
SET "resolvedCategory" = 'internal-transfer',
    "resolutionStage" = 'internal-transfer'
WHERE "isInternalTransfer" = true
  AND "categoryOverride" = false
  AND "resolvedCategory" IS NULL;
