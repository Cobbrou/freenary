/*
  Warnings:

  - You are about to drop the column `archivedAt` on the `conversation` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "conversation_userId_archivedAt_idx";

-- AlterTable
ALTER TABLE "conversation" DROP COLUMN "archivedAt",
ADD COLUMN     "title" TEXT;

-- CreateIndex
CREATE INDEX "conversation_userId_updatedAt_idx" ON "conversation"("userId", "updatedAt");
