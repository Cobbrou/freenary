import { Effect } from "effect";

import { client } from "@/shared/api";

export const SYNC_POLL_INTERVAL_MS = 1500;

interface SyncAccountsInput {
  connectionId?: string;
  force?: boolean;
}

const awaitSyncOutcome = (startedAt: Date) =>
  Effect.promise(() => client.budget.getSyncOutcome({ startedAt })).pipe(
    Effect.delay(SYNC_POLL_INTERVAL_MS),
    Effect.repeat({ until: (outcome) => outcome !== null })
  );

export const syncAccountsToEnd = async (input: SyncAccountsInput) => {
  const { startedAt } = await client.budget.syncAccounts(input);

  if (startedAt === null) {
    return { categorised: 0, failures: [], started: false, success: true };
  }

  const outcome = await Effect.runPromise(awaitSyncOutcome(startedAt));

  if (outcome === null) {
    throw new Error("The sync outcome never arrived");
  }

  return { ...outcome, started: true };
};
