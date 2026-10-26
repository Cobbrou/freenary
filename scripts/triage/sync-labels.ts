#!/usr/bin/env bun
import { Effect } from "effect";

import { createLabel, listRepositoryLabels, updateLabel } from "./github";
import type { GitHubClient } from "./github";
import { LABELS } from "./taxonomy";

const syncLabels = Effect.fnUntraced(function* syncLabels(
  client: GitHubClient
) {
  const present = new Set(
    (yield* listRepositoryLabels(client)).map((label) => label.name)
  );

  for (const label of LABELS) {
    if (present.has(label.name)) {
      yield* updateLabel(client, label.name, label);
      console.log(`updated ${label.name}`);
    } else {
      yield* createLabel(client, label);
      console.log(`created ${label.name}`);
    }
  }
});

const repository = process.env.GITHUB_REPOSITORY ?? "";
const token = process.env.GITHUB_TOKEN ?? "";

if (!repository || !token) {
  console.error(
    "usage: GITHUB_REPOSITORY=owner/name GITHUB_TOKEN=… bun scripts/triage/sync-labels.ts"
  );

  process.exit(1);
}

await Effect.runPromise(
  syncLabels({ repository, token }).pipe(
    Effect.catchTag("GitHubRequestFailed", (failure) =>
      Effect.sync(() => {
        console.error(
          `GitHub ${failure.operation} failed: ${JSON.stringify(failure.reason)}`
        );

        process.exitCode = 1;
      })
    )
  )
);
