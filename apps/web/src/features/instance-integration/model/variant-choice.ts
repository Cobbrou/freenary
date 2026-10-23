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
): Variant[] => {
  const skipListed = offersSkip(integration);

  return integration.variants.filter(
    (variant) => skipListed || variant.id !== SKIP_VARIANT
  );
};
