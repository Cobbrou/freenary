const SKIP_VARIANT = "disabled";

interface ChoosableIntegration<Variant extends { id: string }> {
  requiredForSetup: boolean;
  variants: readonly Variant[];
}

export const offersSkip = <Variant extends { id: string }>(
  integration: ChoosableIntegration<Variant>
): boolean =>
  !integration.requiredForSetup &&
  integration.variants.some((variant) => variant.id === SKIP_VARIANT);

export const choosableVariants = <Variant extends { id: string }>(
  integration: ChoosableIntegration<Variant>
): Variant[] =>
  integration.variants.filter((variant) => variant.id !== SKIP_VARIANT);

interface ChosenIntegration<
  Variant extends { id: string },
> extends ChoosableIntegration<Variant> {
  selectedVariantId: string;
}

export const initialChoiceOf = <Variant extends { id: string }>(
  integration: ChosenIntegration<Variant>
): string =>
  integration.selectedVariantId === SKIP_VARIANT
    ? (choosableVariants(integration)[0]?.id ?? SKIP_VARIANT)
    : integration.selectedVariantId;

export const offersSkipButton = <Variant extends { id: string }>(
  integration: ChosenIntegration<Variant>,
  isSetup: boolean
): boolean =>
  offersSkip(integration) &&
  (isSetup || integration.selectedVariantId !== SKIP_VARIANT);
