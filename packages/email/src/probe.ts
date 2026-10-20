import type { ProbeFailureReason } from "@freenary/instance-config/probe";
import {
  IntegrationProbeFailed,
  PROBE_TIMEOUT_MS,
  probeDeadline,
} from "@freenary/instance-config/probe";
import { Effect, Match } from "effect";
import { createTransport } from "nodemailer";

import type { EmailSettings } from "./registry";

const RESEND_DOMAINS_ENDPOINT = "https://api.resend.com/domains";
const IMPLICIT_TLS_PORT = 465;
const STARTTLS_PORT = 587;

const failure = (
  variantId: string,
  reason: ProbeFailureReason
): IntegrationProbeFailed =>
  new IntegrationProbeFailed({ integrationId: "email", reason, variantId });

const probeResend = Effect.fn("email.probeResend")(function* probeResend(
  apiKey: string
) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      failure("resend", { detail: String(cause), kind: "unreachable" }),
    try: (signal) =>
      fetch(RESEND_DOMAINS_ENDPOINT, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal: probeDeadline(signal),
      }),
  });

  if (response.ok) {
    return;
  }

  const body = yield* Effect.tryPromise({
    catch: (cause) =>
      failure("resend", { detail: String(cause), kind: "unreachable" }),
    try: () => response.text(),
  });

  return yield* failure("resend", {
    detail: body,
    kind: "rejected",
    status: response.status,
  });
});

const probeSmtp = Effect.fn("email.probeSmtp")(function* probeSmtp(
  settings: EmailSettings
) {
  const host = settings.smtpHost;

  if (host === undefined) {
    return yield* failure("smtp", {
      detail: "SMTP_HOST",
      kind: "invalid",
    });
  }

  const transport = yield* Effect.acquireRelease(
    Effect.sync(() =>
      createTransport({
        auth:
          settings.smtpUser === undefined
            ? undefined
            : { pass: settings.smtpPassword, user: settings.smtpUser },
        connectionTimeout: PROBE_TIMEOUT_MS,
        greetingTimeout: PROBE_TIMEOUT_MS,
        host,
        port:
          settings.smtpPort ??
          (settings.smtpSecure ? IMPLICIT_TLS_PORT : STARTTLS_PORT),
        secure: settings.smtpSecure,
      })
    ),
    (open) => Effect.sync(() => open.close())
  );

  yield* Effect.tryPromise({
    catch: (cause) =>
      failure("smtp", { detail: String(cause), kind: "unreachable" }),
    try: () => transport.verify(),
  });
});

export const probeEmailSettings = Effect.fn("email.probe")(
  function* probeEmailSettings(settings: EmailSettings) {
    if (settings.provider === undefined) {
      return;
    }

    yield* Match.value(settings.provider).pipe(
      Match.when("resend", () =>
        settings.resendApiKey === undefined
          ? Effect.fail(
              failure("resend", { detail: "RESEND_API_KEY", kind: "invalid" })
            )
          : probeResend(settings.resendApiKey)
      ),
      Match.when("smtp", () => Effect.scoped(probeSmtp(settings))),
      Match.exhaustive
    );
  }
);
