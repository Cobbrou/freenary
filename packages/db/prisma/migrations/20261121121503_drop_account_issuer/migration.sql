/*
  Warnings:

  - You are about to drop the column `issuer` on the `account` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[providerId,accountId]` on the table `account` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "account_issuer_accountId_uidx";

-- AlterTable
ALTER TABLE "account" DROP COLUMN "issuer";

-- CreateIndex
CREATE UNIQUE INDEX "account_providerId_accountId_key" ON "account"("providerId", "accountId");
