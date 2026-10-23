export const BANKING_INTEGRATION = "banking";

interface ProviderSwitch {
  chosenVariantId: string;
  connectionCount: number | undefined;
  currentVariantId: string;
  integrationId: string;
}

export const needsSwitchConfirmation = ({
  chosenVariantId,
  connectionCount,
  currentVariantId,
  integrationId,
}: ProviderSwitch): boolean =>
  integrationId === BANKING_INTEGRATION &&
  chosenVariantId !== currentVariantId &&
  (connectionCount === undefined || connectionCount > 0);
