import { createHmac, timingSafeEqual } from "node:crypto";

import { z } from "zod";

import type { ProviderInstitution } from "../providers/types";

export interface BankConnectionStateInput {
  readonly institution: ProviderInstitution;
  readonly original?: string;
  readonly providerId: string;
  readonly returnTo: BankConnectionReturnTarget;
  readonly secret: string;
  readonly userId: string;
}

export const BANK_CONNECTION_RETURN_TARGETS = [
  "onboarding",
  "settings",
] as const;

const bankConnectionStateSchema = z.object({
  hmac: z.string(),
  institution: z.object({
    country: z.string(),
    id: z.string(),
    name: z.string(),
  }),
  original: z.string().optional(),
  providerId: z.string(),
  returnTo: z.enum(BANK_CONNECTION_RETURN_TARGETS),
});

export type BankConnectionState = z.infer<typeof bankConnectionStateSchema>;

export type BankConnectionReturnTarget =
  (typeof BANK_CONNECTION_RETURN_TARGETS)[number];

const computeHmac = (payload: string, userId: string, secret: string): string =>
  createHmac("sha256", secret).update(`${userId}:${payload}`).digest("hex");

export const encodeBankConnectionState = ({
  institution,
  original,
  providerId,
  returnTo,
  secret,
  userId,
}: BankConnectionStateInput): string => {
  const payload = {
    institution: {
      country: institution.country,
      id: institution.id,
      name: institution.name,
    },
    original,
    providerId,
    returnTo,
  };

  const hmac = computeHmac(JSON.stringify(payload), userId, secret);

  return JSON.stringify({ ...payload, hmac });
};

export const parseBankConnectionState = (state: string): BankConnectionState =>
  bankConnectionStateSchema.parse(JSON.parse(state));

export const findInstitution = (
  institutions: ProviderInstitution[],
  institutionId: string,
  country: string
): ProviderInstitution | undefined =>
  institutions.find(
    (institution) =>
      institution.id === institutionId && institution.country === country
  );

export const verifyBankConnectionState = (
  state: BankConnectionState,
  userId: string,
  secret: string
): boolean => {
  const { hmac, ...payload } = state;
  const expected = computeHmac(JSON.stringify(payload), userId, secret);

  if (hmac.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(Buffer.from(hmac), Buffer.from(expected));
};
