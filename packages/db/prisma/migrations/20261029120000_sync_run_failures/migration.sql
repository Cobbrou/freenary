-- What went wrong in a finished sync, read by budget.getSyncOutcome.
ALTER TABLE "sync_run" ADD COLUMN "failures" JSONB;
