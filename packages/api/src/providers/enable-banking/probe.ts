import type { ProbeFailureReason } from "@freenary/instance-config/probe";
import {
  IntegrationProbeFailed,
  probeDeadline,
} from "@freenary/instance-config/probe";
import { Effect } from "effect";

import type { EnableBankingCredentials } from "./client";
import {
  ENABLE_BANKING_ORIGIN,
  LITERAL_NEWLINE_ESCAPE,
  createJwt,
} from "./client";

const failure = (reason: ProbeFailureReason): IntegrationProbeFailed =>
  new IntegrationProbeFailed({
    integrationId: "banking",
    reason,
    variantId: "enable-banking",
  });

const signed = (credentials: EnableBankingCredentials) =>
  Effect.try({
    catch: (cause) => failure({ detail: String(cause), kind: "invalid" }),
    try: () =>
      createJwt(
        credentials.appId,
        credentials.privateKey.replaceAll(LITERAL_NEWLINE_ESCAPE, "\n")
      ),
  });

export const probeEnableBankingCredentials = Effect.fn("enableBanking.probe")(
  function* probeEnableBankingCredentials(
    credentials: EnableBankingCredentials
  ) {
    const token = yield* signed(credentials);

    const response = yield* Effect.tryPromise({
      catch: (cause) => failure({ detail: String(cause), kind: "unreachable" }),
      try: (signal) =>
        fetch(`${ENABLE_BANKING_ORIGIN}/application`, {
          headers: { Authorization: `Bearer ${token}` },
          signal: probeDeadline(signal),
        }),
    });

    if (response.ok) {
      return;
    }

    const body = yield* Effect.tryPromise({
      catch: (cause) => failure({ detail: String(cause), kind: "unreachable" }),
      try: () => response.text(),
    });

    return yield* failure({
      detail: body,
      kind: "rejected",
      status: response.status,
    });
  }
);
