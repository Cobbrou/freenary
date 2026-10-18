#!/usr/bin/env bun
import { appendFile } from "node:fs/promises";

import { Data, Effect } from "effect";

import { areasForPaths } from "./areas";
import {
  addLabels,
  getIssue,
  isDraftPullRequest,
  listOpenIssues,
  listPullRequestFiles,
} from "./github";
import type { GitHubClient } from "./github";
import { planLabels } from "./plan";
import { buildQuestions } from "./questions";
import type { SubjectKind } from "./questions";
import { decide } from "./subq";
import type { DecisionState } from "./subq";

const MAX_BODY_CHARACTERS = 8000;
const MAX_LISTED_FILES = 200;
const MAX_DUPLICATE_CANDIDATES = 40;
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

const triage = Effect.fnUntraced(function* triage() {
  const { kind, number, repository } = yield* readArguments();
  const token = yield* requireEnv("GITHUB_TOKEN", process.env.GITHUB_TOKEN);
  const apiKey = yield* requireEnv("SUBQ_API_KEY", process.env.SUBQ_API_KEY);
  const client: GitHubClient = { repository, token };

  const subject = yield* getIssue(client, number);
  const files =
    kind === "pull-request" ? yield* listPullRequestFiles(client, number) : [];

  const draft =
    kind === "pull-request" ? yield* isDraftPullRequest(client, number) : false;

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

  const state: DecisionState = {
    body: (subject.body ?? "").slice(0, MAX_BODY_CHARACTERS),
    changed_files: files.slice(0, MAX_LISTED_FILES),
    draft,
    existing_labels: existingLabels,
    kind,
    title: subject.title,
  };

  const answers = yield* decide(
    apiKey,
    state,
    buildQuestions(kind, candidates)
  );

  const plan = planLabels({
    answers,
    areasFromPaths: areasForPaths(files),
    existingLabels,
  });

  if (plan.labels.length > 0) {
    yield* addLabels(client, number, plan.labels);
  }

  yield* writeSummary([
    `### Triage of ${kind} #${number}`,
    "",
    `Added: ${plan.labels.join(", ") || "nothing"}`,
    ...(plan.duplicateOf === undefined
      ? []
      : [`Possible duplicate of #${plan.duplicateOf}`]),
    "",
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
