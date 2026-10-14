import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { Data, Effect } from "effect";

import { client } from "@/shared/api";

export type InstanceSetup =
  | { kind: "needs-setup" }
  | { kind: "ready" }
  | { kind: "unknown" };

export const UNKNOWN_INSTANCE: InstanceSetup = { kind: "unknown" };

class InstanceRequestFailed extends Data.TaggedError("InstanceRequestFailed")<{
  readonly cause: unknown;
}> {}

const resolveInstance = (cookie: string | undefined) =>
  Effect.tryPromise({
    catch: (cause) => new InstanceRequestFailed({ cause }),
    try: () => client.instance.status(undefined, { context: { cookie } }),
  }).pipe(
    Effect.map((answer): InstanceSetup =>
      answer.completed ? { kind: "ready" } : { kind: "needs-setup" }
    ),
    Effect.catchTag("InstanceRequestFailed", () =>
      Effect.succeed(UNKNOWN_INSTANCE)
    )
  );

export const getInstanceSetup = createServerFn({ method: "GET" }).handler(
  (): Promise<InstanceSetup> =>
    Effect.runPromise(resolveInstance(getRequestHeader("cookie")))
);
