import type { ProbeFailureReason } from "@freenary/instance-config/probe";
import {
  IntegrationProbeFailed,
  probeDeadline,
} from "@freenary/instance-config/probe";
import { Effect, Result, Schema } from "effect";

import type { PowensCredentials } from "./client";
import { POWENS_API_PATH, PowensUserSchema, powensHost } from "./client";

const failure = (reason: ProbeFailureReason): IntegrationProbeFailed =>
  new IntegrationProbeFailed({
    integrationId: "banking",
    reason,
    variantId: "powens",
  });

const unreachable = (cause: unknown): IntegrationProbeFailed =>
  failure({ detail: String(cause), kind: "unreachable" });

const releaseThrowawayUser = Effect.fn("powens.probeRelease")(
  function* releaseThrowawayUser(origin: string, token: string) {
    const released = yield* Effect.result(
      Effect.tryPromise({
        catch: unreachable,
        try: (signal) =>
          fetch(`${origin}/users/me`, {
            headers: { Authorization: `Bearer ${token}` },
            method: "DELETE",
            signal: probeDeadline(signal),
          }),
      })
    );

    yield* Result.match(released, {
      onFailure: (cause) =>
        Effect.logWarning(
          `The Powens check could not release the user it created: ${cause.message}`
        ),
      onSuccess: (response) =>
        response.ok
          ? Effect.void
          : Effect.logWarning(
              `Powens refused to release the user the check created: ${response.status}. Delete it in the console.`
            ),
    });
  }
);

export const probePowensCredentials = Effect.fn("powens.probe")(
  function* probePowensCredentials(credentials: PowensCredentials) {
    const origin = `https://${powensHost(credentials.domain)}${POWENS_API_PATH}`;

    const response = yield* Effect.tryPromise({
      catch: unreachable,
      try: (signal) =>
        fetch(`${origin}/auth/init`, {
          body: JSON.stringify({
            client_id: credentials.clientId,
            client_secret: credentials.clientSecret,
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: probeDeadline(signal),
        }),
    });

    if (!response.ok) {
      const body = yield* Effect.tryPromise({
        catch: unreachable,
        try: () => response.text(),
      });

      return yield* failure({
        detail: body,
        kind: "rejected",
        status: response.status,
      });
    }

    const payload = yield* Effect.tryPromise({
      catch: unreachable,
      try: () => response.json(),
    });

    const created = yield* Schema.decodeUnknownEffect(PowensUserSchema)(
      payload
    ).pipe(
      Effect.mapError((cause: Schema.SchemaError) =>
        failure({ detail: cause.message, kind: "invalid" })
      )
    );

    yield* releaseThrowawayUser(origin, created.auth_token);
  }
);
