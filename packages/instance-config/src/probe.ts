import { Data, Match } from "effect";

export const PROBE_TIMEOUT_MS = 10_000;

export const probeDeadline = (signal: AbortSignal): AbortSignal =>
  AbortSignal.any([signal, AbortSignal.timeout(PROBE_TIMEOUT_MS)]);

export type ProbeFailureReason =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly detail: string;
    }
  | { readonly kind: "invalid"; readonly detail: string };

export class IntegrationProbeFailed extends Data.TaggedError(
  "IntegrationProbeFailed"
)<{
  readonly integrationId: string;
  readonly variantId: string;
  readonly reason: ProbeFailureReason;
}> {
  override get message(): string {
    const subject = `${this.integrationId} (${this.variantId})`;

    return Match.value(this.reason).pipe(
      Match.discriminatorsExhaustive("kind")({
        invalid: ({ detail }) =>
          `${subject} was given a value this instance cannot use: ${detail}`,
        rejected: ({ detail, status }) =>
          `${subject} refused the credentials: ${status} ${detail}`,
        unreachable: ({ detail }) =>
          `${subject} could not be reached: ${detail}`,
      })
    );
  }
}
