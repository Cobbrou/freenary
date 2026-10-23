export const FINISH_STEP = "finish";

interface SetupStanding {
  id: string;
  shownInSetup: boolean;
}

export const setupIntegrationsOf = <Integration extends SetupStanding>(
  integrations: readonly Integration[]
): Integration[] =>
  integrations.filter((integration) => integration.shownInSetup);

export const setupStepsOf = (
  integrations: readonly SetupStanding[]
): string[] => [
  ...setupIntegrationsOf(integrations).map((integration) => integration.id),
  FINISH_STEP,
];
