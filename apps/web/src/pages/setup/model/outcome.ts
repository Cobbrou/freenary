import { m } from "@/paraglide/messages.js";

import { fieldLabel } from "./labels";

export interface SaveOutcome {
  checked?: boolean;
  detail?: string;
  keys?: string[];
  outcome: string;
  reason?: string;
  status?: number | null;
}

const SUCCESS_OUTCOMES: ReadonlySet<string> = new Set([
  "saved",
  "verified",
  "nothing-to-save",
]);

export const isFailedOutcome = (outcome: SaveOutcome | undefined): boolean =>
  outcome !== undefined && !SUCCESS_OUTCOMES.has(outcome.outcome);

const fieldList = (keys: readonly string[] | undefined): string =>
  (keys ?? []).map(fieldLabel).join(", ");

const probeFailureMessage = (
  outcome: SaveOutcome,
  provider: string
): string => {
  if (outcome.reason === "rejected") {
    return m.setup_error_probe_rejected({ provider });
  }

  if (outcome.reason === "invalid") {
    return m.setup_error_invalid();
  }

  return m.setup_error_probe_unreachable({ provider });
};

export const outcomeMessage = (
  outcome: SaveOutcome,
  provider: string
): string => {
  if (outcome.outcome === "verified") {
    return m.setup_verified();
  }

  if (outcome.outcome === "saved" || outcome.outcome === "nothing-to-save") {
    return outcome.checked === true
      ? m.setup_verified()
      : m.setup_saved_unchecked();
  }

  if (outcome.outcome === "missing-fields") {
    return m.setup_error_missing_fields({ keys: fieldList(outcome.keys) });
  }

  if (outcome.outcome === "environment-owned") {
    return m.setup_error_environment_owned();
  }

  if (outcome.outcome === "invalid") {
    return m.setup_error_invalid();
  }

  return probeFailureMessage(outcome, provider);
};

export const outcomeDetail = (outcome: SaveOutcome): string | null => {
  if (outcome.detail === undefined || outcome.detail === "") {
    return null;
  }

  return outcome.status === null || outcome.status === undefined
    ? outcome.detail
    : `${outcome.status}: ${outcome.detail}`;
};
