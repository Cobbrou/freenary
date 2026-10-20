import { useQuery } from "@tanstack/react-query";

import { orpc } from "@/shared/api";

import { bankLinkingOf } from "./bank-linking";
import type { BankLinking } from "./bank-linking";

export const useBankLinking = (): BankLinking => {
  const availability = useQuery(
    orpc.bankConnection.getProviderAvailability.queryOptions()
  );

  return bankLinkingOf({
    available: availability.data?.available,
    isError: availability.isError,
  });
};
