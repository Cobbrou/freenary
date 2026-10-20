import { settings } from "@freenary/instance-config";

import { enableBankingProvider } from "./enable-banking";
import { mockProvider } from "./mock";
import { powensProvider } from "./powens";
import type { BankingProvider } from "./types";

const developmentOnlyProviders: Record<string, BankingProvider> =
  settings.NODE_ENV === "production" ? {} : { [mockProvider.id]: mockProvider };

const providers: Record<string, BankingProvider> = {
  [enableBankingProvider.id]: enableBankingProvider,
  [powensProvider.id]: powensProvider,
  ...developmentOnlyProviders,
};

export const getProvider = (id: string): BankingProvider => {
  const provider = providers[id];

  if (!provider) {
    throw new Error(`Unknown banking provider: ${id}`);
  }

  return provider;
};

export const getDefaultProvider = (): BankingProvider =>
  getProvider(settings.BANKING_PROVIDER);
