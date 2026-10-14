import { probeEmailSettings } from "@freenary/email/probe";
import { emailSettingsOf } from "@freenary/email/registry";
import type { ServerSettings } from "@freenary/instance-config/candidate";
import { IntegrationProbeFailed } from "@freenary/instance-config/probe";
import { Effect, Option } from "effect";

import { probeEnableBankingCredentials } from "../providers/enable-banking/probe";
import { probePowensCredentials } from "../providers/powens/probe";

export type IntegrationProbe = (
  candidate: ServerSettings
) => Effect.Effect<void, IntegrationProbeFailed>;

const absent = (
  integrationId: string,
  variantId: string,
  key: string
): Effect.Effect<never, IntegrationProbeFailed> =>
  Effect.fail(
    new IntegrationProbeFailed({
      integrationId,
      reason: { detail: key, kind: "invalid" },
      variantId,
    })
  );

const probePowens: IntegrationProbe = (candidate) => {
  const { POWENS_CLIENT_ID, POWENS_CLIENT_SECRET, POWENS_DOMAIN } = candidate;

  if (
    POWENS_DOMAIN === undefined ||
    POWENS_CLIENT_ID === undefined ||
    POWENS_CLIENT_SECRET === undefined
  ) {
    return absent("banking", "powens", "POWENS_DOMAIN");
  }

  return probePowensCredentials({
    clientId: POWENS_CLIENT_ID,
    clientSecret: POWENS_CLIENT_SECRET,
    domain: POWENS_DOMAIN,
  });
};

const probeEnableBanking: IntegrationProbe = (candidate) => {
  const { ENABLE_BANKING_APP_ID, ENABLE_BANKING_PRIVATE_KEY } = candidate;

  if (
    ENABLE_BANKING_APP_ID === undefined ||
    ENABLE_BANKING_PRIVATE_KEY === undefined
  ) {
    return absent("banking", "enable-banking", "ENABLE_BANKING_APP_ID");
  }

  return probeEnableBankingCredentials({
    appId: ENABLE_BANKING_APP_ID,
    privateKey: ENABLE_BANKING_PRIVATE_KEY,
  });
};

const probeEmail: IntegrationProbe = (candidate) =>
  probeEmailSettings(emailSettingsOf(candidate));

const nothingToProbe: IntegrationProbe = () => Effect.void;

const probes: Record<string, IntegrationProbe> = {
  "banking:disabled": nothingToProbe,
  "banking:enable-banking": probeEnableBanking,
  "banking:powens": probePowens,
  "email:disabled": nothingToProbe,
  "email:resend": probeEmail,
  "email:smtp": probeEmail,
};

export const findProbe = (
  integrationId: string,
  variantId: string
): Option.Option<IntegrationProbe> =>
  Option.fromNullishOr(probes[`${integrationId}:${variantId}`]);
