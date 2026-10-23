import { Data, Effect, Schedule } from "effect";

import { client } from "@/shared/api";

const POLL_INTERVAL = "2 seconds";
const GIVE_UP_AFTER = "60 seconds";

class ServerNotApplied extends Data.TaggedError("ServerNotApplied")<{
  readonly cause: unknown;
}> {}

const describeAppliedServer = Effect.tryPromise({
  catch: (cause) => new ServerNotApplied({ cause }),
  try: () => client.instance.describe(),
}).pipe(
  Effect.flatMap((described) =>
    described.restartRequired
      ? Effect.fail(new ServerNotApplied({ cause: "restart pending" }))
      : Effect.void
  )
);

export const waitForAppliedServer = (): Promise<boolean> =>
  Effect.runPromise(
    describeAppliedServer.pipe(
      Effect.delay(POLL_INTERVAL),
      Effect.retry(Schedule.spaced(POLL_INTERVAL)),
      Effect.timeout(GIVE_UP_AFTER),
      Effect.match({ onFailure: () => false, onSuccess: () => true })
    )
  );
