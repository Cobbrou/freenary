export interface LabelEvent {
  readonly event: string;
  readonly label?: { readonly name: string } | undefined;
  readonly actor?: { readonly login: string } | null | undefined;
}

export const lastActor = (
  events: readonly LabelEvent[],
  eventName: "labeled" | "unlabeled",
  labelName: string
): string | undefined =>
  events.findLast(
    (event) => event.event === eventName && event.label?.name === labelName
  )?.actor?.login;

export const labelsRemovedByOthers = (
  events: readonly LabelEvent[],
  currentLabels: readonly string[],
  workflowActor: string
): string[] => {
  const removed = new Set(
    events.flatMap((event) =>
      event.event === "unlabeled" && event.label ? [event.label.name] : []
    )
  );

  return [...removed].filter(
    (name) =>
      !currentLabels.includes(name) &&
      lastActor(events, "unlabeled", name) !== workflowActor
  );
};
