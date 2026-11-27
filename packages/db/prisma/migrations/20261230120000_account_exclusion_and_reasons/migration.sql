-- AlterEnum
ALTER TYPE "TransactionExclusion" ADD VALUE 'ACCOUNT';

-- AlterTable
ALTER TABLE "bank_account" ADD COLUMN     "excluded" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "exclusionReason" TEXT,
ADD COLUMN     "holderNameKeys" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "excluded_merchant" ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "transaction" ADD COLUMN     "exclusionReason" TEXT;

-- AlterTable
ALTER TABLE "sync_run" ADD COLUMN     "transfersStale" BOOLEAN NOT NULL DEFAULT false;
