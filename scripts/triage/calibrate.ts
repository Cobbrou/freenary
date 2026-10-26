#!/usr/bin/env bun
import { readFile } from "node:fs/promises";
import path from "node:path";

import { Glob } from "bun";
import { Data, Effect, Schema } from "effect";

import { blindSamples, measureAgreement, renderTable } from "./calibration";
import { getIssue, listLabelEvents, WORKFLOW_ACTOR } from "./github";
import type { GitHubClient } from "./github";
import { lastActor } from "./history";
import { AnswersSchema } from "./subq";
import { GROUP_PREFIXES } from "./taxonomy";

const RECORD_GLOB = "**/triage-record.json";
const FETCH_CONCURRENCY = 4;

const RecordSchema = Schema.Struct({
  answers: AnswersSchema,
  existingLabels: Schema.Array(Schema.String),
  kind: Schema.Literals(["issue", "pull-request"]),
  number: Schema.Number,
  recordedAt: Schema.String,
});

type TriageRecord = typeof RecordSchema.Type;

class CalibrationFailed extends Data.TaggedError("CalibrationFailed")<{
  readonly detail: string;
}> {}

const readRecord = Effect.fnUntraced(function* readRecord(file: string) {
  const text = yield* Effect.tryPromise({
    catch: (cause) =>
      new CalibrationFailed({ detail: `${file}: ${String(cause)}` }),
    try: () => readFile(file, "utf-8"),
  });

  return yield* Schema.decodeUnknownEffect(Schema.fromJsonString(RecordSchema))(
    text
  ).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new CalibrationFailed({ detail: `${file}: ${cause.message}` })
    )
  );
});

interface ItemRuns {
  readonly first: TriageRecord;
  readonly runs: readonly TriageRecord[];
}

const groupByItem = (records: readonly TriageRecord[]): ItemRuns[] => {
  const byItem = new Map<number, TriageRecord[]>();

  for (const record of records) {
    byItem.set(record.number, [...(byItem.get(record.number) ?? []), record]);
  }

  return [...byItem.values()].flatMap((runs) => {
    const [first] = runs;

    return first ? [{ first, runs }] : [];
  });
};

const reviewedLabels = Effect.fnUntraced(function* reviewedLabels(
  client: GitHubClient,
  record: TriageRecord
) {
  const issue = yield* getIssue(client, record.number);
  const labels = issue.labels.map((label) => label.name);
  const priority = labels.find((label) =>
    label.startsWith(GROUP_PREFIXES.priority)
  );

  const events = yield* listLabelEvents(client, record.number);

  if (!events) {
    return;
  }

  const prioritySetter = priority
    ? lastActor(events, "labeled", priority)
    : undefined;

  const closer = events.findLast((event) => event.event === "closed")?.actor
    ?.login;

  const closedByMaintainer =
    issue.state === "closed" &&
    closer !== undefined &&
    closer !== WORKFLOW_ACTOR &&
    closer !== issue.user?.login;

  const reviewed =
    closedByMaintainer ||
    (prioritySetter !== undefined &&
      prioritySetter !== WORKFLOW_ACTOR &&
      prioritySetter !== issue.user?.login);

  return reviewed ? { labels } : undefined;
});

const calibrate = Effect.fnUntraced(function* calibrate() {
  const [directory] = process.argv.slice(2);
  const repository = process.env.GITHUB_REPOSITORY ?? "";
  const token = process.env.GITHUB_TOKEN ?? "";

  if (!directory || !repository || !token) {
    return yield* new CalibrationFailed({
      detail:
        "usage: GITHUB_REPOSITORY=owner/name GITHUB_TOKEN=… bun scripts/triage/calibrate.ts <artifact directory>",
    });
  }

  const client: GitHubClient = { repository, token };
  const files = [...new Glob(RECORD_GLOB).scanSync(directory)].map((file) =>
    path.join(directory, file)
  );

  const runsByItem = groupByItem(
    yield* Effect.all(files.map((file) => readRecord(file)))
  );

  const reviewedItems = yield* Effect.forEach(
    runsByItem,
    ({ first, runs }) =>
      reviewedLabels(client, first).pipe(
        Effect.map((item) => (item ? [{ item, runs }] : []))
      ),
    { concurrency: FETCH_CONCURRENCY }
  );

  const reviewed = reviewedItems.flat();
  const samples = reviewed.flatMap(({ item, runs }) =>
    blindSamples(runs, item)
  );

  console.log(
    `${runsByItem.length} items triaged, ${reviewed.length} reviewed by a maintainer.\n`
  );

  console.log(renderTable(measureAgreement(samples)));
});

await Effect.runPromise(
  calibrate().pipe(
    Effect.catchTags({
      CalibrationFailed: (failure) =>
        Effect.sync(() => {
          console.error(failure.detail);
          process.exitCode = 1;
        }),
      GitHubRequestFailed: (failure) =>
        Effect.sync(() => {
          console.error(
            `GitHub ${failure.operation} failed: ${JSON.stringify(failure.reason)}`
          );

          process.exitCode = 1;
        }),
    })
  )
);
