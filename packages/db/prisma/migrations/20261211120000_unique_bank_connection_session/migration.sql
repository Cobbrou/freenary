-- A replayed bank callback used to create the same connection again, with its own accounts
-- and transactions. The oldest copy stays; the later ones go, and their rows cascade.
DELETE FROM "bank_connection" AS copy
USING "bank_connection" AS kept
WHERE copy."userId" = kept."userId"
  AND copy."provider" = kept."provider"
  AND copy."providerSessionId" = kept."providerSessionId"
  AND (kept."createdAt", kept."id") < (copy."createdAt", copy."id");

-- AlterTable
ALTER TABLE "bank_connection" ADD COLUMN     "exchangeNonce" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "bank_connection_userId_provider_providerSessionId_key" ON "bank_connection"("userId", "provider", "providerSessionId");
