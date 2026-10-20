import { redirect } from "@tanstack/react-router";
import { Data, Effect, Option } from "effect";

import { client } from "@/shared/api";
import { authClient } from "@/shared/auth";

type CallbackDestination = "onboarding" | "settings";

class BankCodeExchangeFailed extends Data.TaggedError(
  "BankCodeExchangeFailed"
)<{
  readonly providerId: string;
  readonly cause: unknown;
}> {}

const parseCallbackDestination = Option.liftThrowable(
  (state: string): CallbackDestination => {
    // SAFETY: the state is unverified, and is only trusted far enough to compare one field against two of our own page names
    const parsed = JSON.parse(state) as { returnTo?: unknown };

    return parsed.returnTo === "settings" ? "settings" : "onboarding";
  }
);

const callbackDestination = (state: string): CallbackDestination =>
  Option.getOrElse(
    parseCallbackDestination(state),
    () => "onboarding" as const
  );

const exchangeCallbackCode = (
  providerId: string,
  params: Record<string, string>,
  state: string
) =>
  Effect.tryPromise({
    catch: (cause) => new BankCodeExchangeFailed({ cause, providerId }),
    try: () => client.bankConnection.exchangeCode({ params, providerId }),
  }).pipe(
    Effect.map((exchanged) => ({
      accounts: exchanged.accounts,
      ok: true as const,
      returnTo: exchanged.returnTo,
    })),
    Effect.catchTag("BankCodeExchangeFailed", () =>
      Effect.succeed({
        ok: false as const,
        reason: "failed" as const,
        returnTo: callbackDestination(state),
      })
    )
  );

export const exchangeCallback = async ({
  params,
  search,
}: {
  params: { provider: string };
  search: Record<string, string>;
}) => {
  const session = await authClient.getSession();

  if (!session.data) {
    throw redirect({ to: "/login" });
  }

  const { error, state } = search;

  if (error) {
    return {
      exchangeResult: {
        ok: false as const,
        reason: "declined" as const,
        returnTo: state ? callbackDestination(state) : "onboarding",
      },
    };
  }

  if (!state) {
    return {
      exchangeResult: {
        ok: false as const,
        reason: "incomplete" as const,
        returnTo: "onboarding" as const,
      },
    };
  }

  return {
    exchangeResult: await Effect.runPromise(
      exchangeCallbackCode(params.provider, search, state)
    ),
  };
};
