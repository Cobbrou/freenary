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

export interface IssueTypeEvent {
  readonly event?: string | undefined;
  readonly actor?: { readonly login: string } | null | undefined;
  readonly prev_issue_type?: { readonly name: string } | null | undefined;
}

const TYPE_REPLACING_EVENTS: ReadonlySet<string> = new Set([
  "issue_type_changed",
  "issue_type_removed",
]);

export const issueTypesRemovedByOthers = (
  events: readonly IssueTypeEvent[],
  currentType: string | undefined,
  workflowActor: string
): string[] => [
  ...new Set(
    events.flatMap((event) => {
      const removed = event.prev_issue_type?.name;

      return TYPE_REPLACING_EVENTS.has(event.event ?? "") &&
        removed !== undefined &&
        removed !== currentType &&
        event.actor?.login !== workflowActor
        ? [removed]
        : [];
    })
  ),
];

export interface IssueFieldEvent {
  readonly kind: "added" | "changed" | "removed";
  readonly field: string | undefined;
  readonly actor: string | undefined;
  readonly value: string | undefined;
  readonly previous: string | undefined;
}

export const lastFieldActor = (
  events: readonly IssueFieldEvent[],
  field: string
): string | undefined =>
  events.findLast((event) => event.field === field)?.actor;

export const fieldValuesRemovedByOthers = (
  events: readonly IssueFieldEvent[],
  field: string,
  currentValue: string | undefined,
  workflowActor: string
): string[] => [
  ...new Set(
    events.flatMap((event) =>
      event.field === field &&
      event.kind !== "added" &&
      event.previous !== undefined &&
      event.previous !== currentValue &&
      event.actor !== workflowActor
        ? [event.previous]
        : []
    )
  ),
];
