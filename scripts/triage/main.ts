#!/usr/bin/env bun
import { appendFile, readFile, writeFile } from "node:fs/promises";

import { Data, Effect } from "effect";

import { planCommentAction, renderGapComment } from "./comment";
import {
  addLabels,
  clearIssueFieldValue,
  createComment,
  deleteComment,
  fieldEntriesOf,
  getIssue,
  getPullRequest,
  listComments,
  listCheckRuns,
  listIssueFieldEvents,
  listIssueFields,
  listIssueTypeEvents,
  listLabelEvents,
  listOpenIssues,
  listPullRequestFiles,
  removeLabel,
  setIssueFieldValues,
  setIssueType,
  updateComment,
  WORKFLOW_ACTOR,
} from "./github";
import type { Comment, GitHubClient, Issue } from "./github";
import {
  fieldValuesRemovedByOthers,
  issueTypesRemovedByOthers,
  labelsRemovedByOthers,
  lastActor,
  lastFieldActor,
} from "./history";
import { planLabels, resolveType } from "./plan";
import type { Plan } from "./plan";
import { buildQuestions } from "./questions";
import type { SubjectKind } from "./questions";
import {
  checkGaps,
  checklistFor,
  checklistQuestions,
  docsExpected,
  stillToDefineGaps,
  templateGaps,
} from "./readiness";
import type { Gap } from "./readiness";
import { decide } from "./subq";
import type { Answers, DecisionState } from "./subq";
import {
  DOCUMENTATION_LABEL,
  FIELD_KEYS,
  fieldValuesOf,
  GOOD_FIRST_ISSUE_LABEL,
  isLevel,
  ISSUE_FIELDS,
  ISSUE_TYPES,
  typeOfIssue,
  typesOfIssueType,
} from "./taxonomy";
import type { FieldKey, FieldValues, Level, TypeKey } from "./taxonomy";

const MAX_BODY_CHARACTERS = 8000;
const MAX_REPLY_CHARACTERS = 4000;
const MAX_LISTED_FILES = 200;
const MAX_DUPLICATE_CANDIDATES = 40;
const PULL_REQUEST_TEMPLATE = ".github/pull_request_template.md";
const RECORD_FILE = "triage-record.json";
const SUBJECT_KINDS: readonly SubjectKind[] = ["issue", "pull-request"];

class TriageMisconfigured extends Data.TaggedError("TriageMisconfigured")<{
  readonly detail: string;
}> {}

interface Arguments {
  readonly kind: SubjectKind;
  readonly number: number;
  readonly repository: string;
}

const isSubjectKind = (value: string | undefined): value is SubjectKind =>
  SUBJECT_KINDS.some((kind) => kind === value);

const readArguments = Effect.fnUntraced(function* readArguments() {
  const [kind, rawNumber] = process.argv.slice(2);
  const number = Number(rawNumber);
  const repository = process.env.GITHUB_REPOSITORY ?? "";

  if (!isSubjectKind(kind) || !Number.isInteger(number) || !repository) {
    return yield* new TriageMisconfigured({
      detail:
        "usage: GITHUB_REPOSITORY=owner/name bun scripts/triage/main.ts <issue|pull-request> <number>",
    });
  }

  return { kind, number, repository } satisfies Arguments;
});

const requireEnv = (
  name: "GITHUB_TOKEN" | "SUBQ_API_KEY",
  value: string | undefined
) =>
  value
    ? Effect.succeed(value)
    : Effect.fail(new TriageMisconfigured({ detail: `${name} is not set` }));

const writeSummary = (lines: readonly string[]) =>
  Effect.promise(async () => {
    const summaryFile = process.env.GITHUB_STEP_SUMMARY;
    const text = `${lines.join("\n")}\n`;

    if (summaryFile) {
      await appendFile(summaryFile, text);
    }

    console.log(text);
  });

const readTemplate = Effect.tryPromise({
  catch: (cause) =>
    new TriageMisconfigured({
      detail: `cannot read ${PULL_REQUEST_TEMPLATE}: ${String(cause)}`,
    }),
  try: () => readFile(PULL_REQUEST_TEMPLATE, "utf-8"),
});

const syncGapComment = Effect.fnUntraced(function* syncGapComment(
  client: GitHubClient,
  number: number,
  comments: readonly Comment[],
  body: string | undefined
) {
  const action = planCommentAction({ author: WORKFLOW_ACTOR, body, comments });

  if (action.kind === "create") {
    yield* createComment(client, number, action.body);
  } else if (action.kind === "update") {
    yield* updateComment(client, action.id, action.body);
  } else if (action.kind === "delete") {
    yield* deleteComment(client, action.id);
  }
});

interface TriageRecord {
  readonly kind: SubjectKind;
  readonly number: number;
  readonly recordedAt: string;
  readonly answers: Answers;
  readonly existingLabels: readonly string[];
  readonly existingType: TypeKey | undefined;
  readonly existingFields: FieldValues;
  readonly type: TypeKey | undefined;
  readonly fields: FieldValues;
  readonly cleared: readonly FieldKey[];
  readonly labels: readonly string[];
  readonly removed: readonly string[];
  readonly status: string;
  readonly gaps: readonly Gap[];
  readonly notes: readonly string[];
}

const writeRecord = (record: TriageRecord) =>
  Effect.tryPromise({
    catch: (cause) =>
      new TriageMisconfigured({
        detail: `cannot write ${RECORD_FILE}: ${String(cause)}`,
      }),
    try: () => writeFile(RECORD_FILE, JSON.stringify(record, null, 2)),
  });

const commentBodyFor = (
  kind: SubjectKind,
  plan: Plan,
  maintainerSetPriority: boolean
): string | undefined =>
  plan.status === "blocked" ||
  (maintainerSetPriority && !plan.stillToDefineOpen)
    ? undefined
    : renderGapComment(kind, plan.gaps);

const readOwnership = Effect.fnUntraced(function* readOwnership(
  client: GitHubClient,
  number: number,
  existingLabels: readonly string[]
) {
  const events = yield* listLabelEvents(client, number);

  const ownedByWorkflow = (label: string): boolean =>
    events !== undefined &&
    existingLabels.includes(label) &&
    lastActor(events, "labeled", label) === WORKFLOW_ACTOR;

  return {
    refusedLabels: events
      ? labelsRemovedByOthers(events, existingLabels, WORKFLOW_ACTOR)
      : [],
    workflowGoodFirstIssue: ownedByWorkflow(GOOD_FIRST_ISSUE_LABEL),
  };
});

interface FieldState {
  readonly existingFields: FieldValues;
  readonly refusedFields: Partial<Record<FieldKey, Level[]>>;
  readonly workflowPriority: boolean;
}

const NO_FIELDS: FieldState = {
  existingFields: {},
  refusedFields: {},
  workflowPriority: false,
};

const readFields = Effect.fnUntraced(function* readFields(
  client: GitHubClient,
  kind: SubjectKind,
  subject: Issue
) {
  if (kind === "pull-request") {
    return NO_FIELDS;
  }

  const existingFields = fieldValuesOf(fieldEntriesOf(subject));
  const events = yield* listIssueFieldEvents(client, subject.number);

  const refusedFields: Partial<Record<FieldKey, Level[]>> = {};

  for (const key of FIELD_KEYS) {
    refusedFields[key] = fieldValuesRemovedByOthers(
      events,
      ISSUE_FIELDS[key],
      existingFields[key],
      WORKFLOW_ACTOR
    ).filter(isLevel);
  }

  const state: FieldState = {
    existingFields,
    refusedFields,
    workflowPriority:
      existingFields.priority !== undefined &&
      lastFieldActor(events, ISSUE_FIELDS.priority) === WORKFLOW_ACTOR,
  };

  return state;
});

const applyFields = Effect.fnUntraced(function* applyFields(
  client: GitHubClient,
  number: number,
  plan: Plan
) {
  const keys = FIELD_KEYS.filter(
    (key) => plan.fields[key] !== undefined || plan.cleared.includes(key)
  );

  if (keys.length === 0) {
    return [];
  }

  const defined = yield* listIssueFields(client);
  const idOf = (key: FieldKey): number | undefined =>
    defined.find((field) => field.name === ISSUE_FIELDS[key])?.id;

  const missing = keys.filter((key) => idOf(key) === undefined);

  for (const key of missing) {
    yield* Effect.sync(() =>
      console.log(
        `::warning::The repository owner has no ${ISSUE_FIELDS[key]} issue field, so triage left it unset.`
      )
    );
  }

  const values = FIELD_KEYS.flatMap((key) => {
    const id = idOf(key);
    const value = plan.fields[key];

    return id !== undefined && value !== undefined
      ? [{ field_id: id, value }]
      : [];
  });

  if (values.length > 0) {
    yield* setIssueFieldValues(client, number, values);
  }

  for (const key of plan.cleared) {
    const id = idOf(key);

    if (id !== undefined) {
      yield* clearIssueFieldValue(client, number, id);
    }
  }

  return [
    ...FIELD_KEYS.flatMap((key) => {
      const value = plan.fields[key];

      return value !== undefined && idOf(key) !== undefined
        ? [`${ISSUE_FIELDS[key]}: ${value}`]
        : [];
    }),
    ...plan.cleared.flatMap((key) =>
      idOf(key) === undefined ? [] : [`${ISSUE_FIELDS[key]}: cleared`]
    ),
    ...missing.map((key) => `${ISSUE_FIELDS[key]}: no such issue field`),
  ];
});

const readTypes = Effect.fnUntraced(function* readTypes(
  client: GitHubClient,
  kind: SubjectKind,
  subject: Issue
) {
  const labels = subject.labels.map((label) => label.name);

  if (kind === "pull-request") {
    return { existingType: undefined, refusedTypes: [] };
  }

  const currentType = subject.type?.name;
  const events = yield* listIssueTypeEvents(client, subject.number);

  return {
    existingType: typeOfIssue(currentType, labels),
    refusedTypes: (events
      ? issueTypesRemovedByOthers(events, currentType, WORKFLOW_ACTOR)
      : []
    ).flatMap(typesOfIssueType),
  };
});

const typeLabelsFor = (
  type: TypeKey | undefined,
  existingLabels: readonly string[],
  refusedLabels: readonly string[]
): string[] =>
  type === "documentation" &&
  !existingLabels.includes(DOCUMENTATION_LABEL) &&
  !refusedLabels.includes(DOCUMENTATION_LABEL)
    ? [DOCUMENTATION_LABEL]
    : [];

const applyType = Effect.fnUntraced(function* applyType(
  client: GitHubClient,
  kind: SubjectKind,
  number: number,
  type: TypeKey | undefined
) {
  if (kind === "issue" && type !== undefined) {
    yield* setIssueType(client, number, ISSUE_TYPES[type]);

    return [`Issue type: ${ISSUE_TYPES[type]}`];
  }

  return [];
});

const triage = Effect.fnUntraced(function* triage() {
  const { kind, number, repository } = yield* readArguments();
  const token = yield* requireEnv("GITHUB_TOKEN", process.env.GITHUB_TOKEN);
  const apiKey = yield* requireEnv("SUBQ_API_KEY", process.env.SUBQ_API_KEY);
  const client: GitHubClient = { repository, token };

  const subject = yield* getIssue(client, number);
  const pull =
    kind === "pull-request" ? yield* getPullRequest(client, number) : undefined;

  if (subject.state === "closed") {
    yield* writeSummary([`Skipped closed ${kind} #${number}.`]);

    return;
  }

  if (pull?.draft) {
    yield* writeSummary([`Skipped draft pull request #${number}.`]);

    return;
  }

  const files =
    kind === "pull-request" ? yield* listPullRequestFiles(client, number) : [];

  const candidates =
    kind === "issue"
      ? (yield* listOpenIssues(client))
          .filter(
            (issue) =>
              issue.pull_request === undefined && issue.number !== number
          )
          .slice(0, MAX_DUPLICATE_CANDIDATES)
          .map((issue) => ({ number: issue.number, title: issue.title }))
      : [];

  const existingLabels = subject.labels.map((label) => label.name);
  const ownership = yield* readOwnership(client, number, existingLabels);
  const types = yield* readTypes(client, kind, subject);
  const fieldState = yield* readFields(client, kind, subject);

  const body = subject.body ?? "";
  const comments = yield* listComments(client, number);
  const authorLogin = subject.user?.login;
  const authorReplies = comments
    .flatMap((comment) =>
      authorLogin !== undefined && comment.user?.login === authorLogin
        ? [comment.body ?? ""]
        : []
    )
    .join("\n\n")
    .slice(-MAX_REPLY_CHARACTERS);

  const state: DecisionState = {
    author_replies: authorReplies,
    body: body.slice(0, MAX_BODY_CHARACTERS),
    changed_files: files.slice(0, MAX_LISTED_FILES),
    existing_labels: existingLabels,
    kind,
    title: subject.title,
  };

  const classification = yield* decide(
    apiKey,
    state,
    buildQuestions(kind, candidates)
  );

  const checklist =
    kind === "issue"
      ? checklistFor(
          resolveType(classification, types.existingType, types.refusedTypes)
        )
      : undefined;

  const checklistAnswers = checklist
    ? yield* decide(apiKey, state, checklistQuestions(checklist))
    : {};

  const ruleGaps: Gap[] = pull
    ? [
        ...templateGaps(yield* readTemplate, body),
        ...checkGaps(yield* listCheckRuns(client, pull.head.sha)),
      ]
    : stillToDefineGaps(body);

  const answers = { ...classification, ...checklistAnswers };

  const plan = planLabels({
    answers,
    checklist,
    docsExpected: docsExpected(files),
    duplicateCandidates: candidates.map((candidate) => candidate.number),
    existingFields: fieldState.existingFields,
    existingLabels,
    existingType: types.existingType,
    kind,
    refusedFields: fieldState.refusedFields,
    refusedLabels: ownership.refusedLabels,
    refusedTypes: types.refusedTypes,
    ruleGaps,
    workflowGoodFirstIssue: ownership.workflowGoodFirstIssue,
    workflowPriority: fieldState.workflowPriority,
  });

  for (const label of plan.removed) {
    yield* removeLabel(client, number, label);
  }

  const typeSummary = yield* applyType(client, kind, number, plan.type);
  const fieldSummary = yield* applyFields(client, number, plan);

  const added = [
    ...typeLabelsFor(plan.type, existingLabels, ownership.refusedLabels),
    ...plan.labels,
  ];

  if (added.length > 0) {
    yield* addLabels(client, number, added);
  }

  yield* syncGapComment(
    client,
    number,
    comments,
    commentBodyFor(
      kind,
      plan,
      fieldState.existingFields.priority !== undefined &&
        !fieldState.workflowPriority
    )
  );

  yield* writeRecord({
    answers,
    cleared: plan.cleared,
    existingFields: fieldState.existingFields,
    existingLabels,
    existingType: types.existingType,
    fields: plan.fields,
    gaps: plan.gaps,
    kind,
    labels: added,
    notes: plan.notes,
    number,
    recordedAt: new Date().toISOString(),
    removed: plan.removed,
    status: plan.status,
    type: plan.type,
  });

  yield* writeSummary([
    `### Triage of ${kind} #${number}`,
    "",
    ...typeSummary,
    ...fieldSummary,
    `Added: ${added.join(", ") || "nothing"}`,
    `Removed: ${plan.removed.join(", ") || "nothing"}`,
    ...(plan.duplicateOf === undefined
      ? []
      : [`Possible duplicate of #${plan.duplicateOf}`]),
    "",
    ...plan.gaps.map((gap) => `- gap (${gap.owner}): ${gap.text}`),
    ...plan.notes.map((note) => `- ${note}`),
  ]);
});

const exitWith = (message: string) =>
  Effect.sync(() => {
    console.error(message);
    process.exitCode = 1;
  });

await Effect.runPromise(
  triage().pipe(
    Effect.catchTags({
      GitHubRequestFailed: (failure) =>
        exitWith(
          `GitHub ${failure.operation} failed: ${JSON.stringify(failure.reason)}`
        ),
      SubqRequestFailed: (failure) =>
        exitWith(`SubQ decision failed: ${JSON.stringify(failure.reason)}`),
      TriageMisconfigured: (failure) => exitWith(failure.detail),
    })
  )
);
