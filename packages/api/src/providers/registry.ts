import { settings } from "@freenary/instance-config";

import { enableBankingProvider } from "./enable-banking";
import { powensProvider } from "./powens";
import type { BankingProvider } from "./types";

const providers = {
  [enableBankingProvider.id]: enableBankingProvider,
  [powensProvider.id]: powensProvider,
} as const satisfies Record<string, BankingProvider>;

export const getProvider = (id: string): BankingProvider => {
  const provider = providers[id];

  if (!provider) {
    throw new Error(`Unknown banking provider: ${id}`);
  }

  return provider;
};

export const getDefaultProvider = (): BankingProvider =>
  getProvider(settings.BANKING_PROVIDER);
