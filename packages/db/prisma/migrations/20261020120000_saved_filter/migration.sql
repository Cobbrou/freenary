-- A named search of the Transactions list: its filter tokens and free text.
CREATE TABLE "saved_filter" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" CITEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "search" TEXT NOT NULL DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_filter_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "saved_filter_userId_name_key" ON "saved_filter"("userId", "name");

ALTER TABLE "saved_filter" ADD CONSTRAINT "saved_filter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
