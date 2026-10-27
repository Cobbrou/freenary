#!/usr/bin/env bun
import { appendFile, readFile, writeFile } from "node:fs/promises";

import { Data, Effect } from "effect";

import { planCommentAction, renderGapComment } from "./comment";
import {
  addLabels,
  createComment,
  deleteComment,
  getIssue,
  getPullRequest,
  listComments,
  listCheckRuns,
  listLabelEvents,
  listOpenIssues,
  listPullRequestFiles,
  removeLabel,
  updateComment,
  WORKFLOW_ACTOR,
} from "./github";
import type { Comment, GitHubClient } from "./github";
import { labelsRemovedByOthers, lastActor } from "./history";
import { planLabels, resolveTypeLabel } from "./plan";
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
import { GOOD_FIRST_ISSUE_LABEL, GROUP_PREFIXES } from "./taxonomy";

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
    workflowPriorities: existingLabels.filter(
      (label) =>
        label.startsWith(GROUP_PREFIXES.priority) && ownedByWorkflow(label)
    ),
  };
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
          resolveTypeLabel(
            classification,
            existingLabels,
            ownership.refusedLabels
          )
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
    existingLabels,
    kind,
    refusedLabels: ownership.refusedLabels,
    ruleGaps,
    workflowGoodFirstIssue: ownership.workflowGoodFirstIssue,
    workflowPriorities: ownership.workflowPriorities,
  });

  for (const label of plan.removed) {
    yield* removeLabel(client, number, label);
  }

  if (plan.labels.length > 0) {
    yield* addLabels(client, number, plan.labels);
  }

  yield* syncGapComment(
    client,
    number,
    comments,
    commentBodyFor(
      kind,
      plan,
      existingLabels.some(
        (label) =>
          label.startsWith(GROUP_PREFIXES.priority) &&
          !ownership.workflowPriorities.includes(label)
      )
    )
  );

  yield* writeRecord({
    answers,
    existingLabels,
    gaps: plan.gaps,
    kind,
    labels: plan.labels,
    notes: plan.notes,
    number,
    recordedAt: new Date().toISOString(),
    removed: plan.removed,
    status: plan.status,
  });

  yield* writeSummary([
    `### Triage of ${kind} #${number}`,
    "",
    `Added: ${plan.labels.join(", ") || "nothing"}`,
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
