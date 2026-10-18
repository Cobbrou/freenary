import { Data, Effect, Schema } from "effect";

const API_ROOT = "https://api.github.com";
const PAGE_SIZE = 100;
const MAX_FILE_PAGES = 30;

type GitHubFailure =
  | { readonly kind: "unreachable"; readonly detail: string }
  | {
      readonly kind: "rejected";
      readonly status: number;
      readonly body: string;
    }
  | { readonly kind: "undecodable"; readonly detail: string };

export class GitHubRequestFailed extends Data.TaggedError(
  "GitHubRequestFailed"
)<{
  readonly operation: string;
  readonly reason: GitHubFailure;
}> {}

const LabelSchema = Schema.Struct({ name: Schema.String });

export const IssueSchema = Schema.Struct({
  body: Schema.optional(Schema.NullOr(Schema.String)),
  labels: Schema.Array(LabelSchema),
  number: Schema.Number,
  pull_request: Schema.optional(Schema.Unknown),
  title: Schema.String,
});

export type Issue = typeof IssueSchema.Type;

const PullRequestSchema = Schema.Struct({
  draft: Schema.optional(Schema.Boolean),
});

const PullRequestFileSchema = Schema.Struct({ filename: Schema.String });

export const RepositoryLabelSchema = Schema.Struct({
  color: Schema.String,
  description: Schema.optional(Schema.NullOr(Schema.String)),
  name: Schema.String,
});

export interface GitHubClient {
  readonly repository: string;
  readonly token: string;
}

interface Call {
  readonly method?: string;
  readonly body?: unknown;
}

const request = Effect.fnUntraced(function* request<
  S extends Schema.ConstraintDecoder<unknown>,
>(
  client: GitHubClient,
  operation: string,
  path: string,
  schema: S,
  call: Call
) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new GitHubRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "unreachable" },
      }),
    try: (signal) =>
      fetch(`${API_ROOT}${path}`, {
        body: call.body === undefined ? undefined : JSON.stringify(call.body),
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${client.token}`,
          "User-Agent": "freenary-triage",
          "X-GitHub-Api-Version": "2022-11-28",
        },
        method: call.method ?? "GET",
        signal,
      }),
  });

  if (!response.ok) {
    const body = yield* Effect.tryPromise({
      catch: (cause) =>
        new GitHubRequestFailed({
          operation,
          reason: { detail: String(cause), kind: "unreachable" },
        }),
      try: () => response.text(),
    });

    return yield* new GitHubRequestFailed({
      operation,
      reason: { body, kind: "rejected", status: response.status },
    });
  }

  const payload = yield* Effect.tryPromise({
    catch: (cause) =>
      new GitHubRequestFailed({
        operation,
        reason: { detail: String(cause), kind: "undecodable" },
      }),
    try: () => response.json(),
  });

  return yield* Schema.decodeUnknownEffect(schema)(payload).pipe(
    Effect.mapError(
      (cause: Schema.SchemaError) =>
        new GitHubRequestFailed({
          operation,
          reason: { detail: cause.message, kind: "undecodable" },
        })
    )
  );
});

const repoPath = (client: GitHubClient, path: string): string =>
  `/repos/${client.repository}${path}`;

export const getIssue = (client: GitHubClient, number: number) =>
  request(
    client,
    "get issue",
    repoPath(client, `/issues/${number}`),
    IssueSchema,
    {}
  );

export const isDraftPullRequest = (client: GitHubClient, number: number) =>
  request(
    client,
    "get pull request",
    repoPath(client, `/pulls/${number}`),
    PullRequestSchema,
    {}
  ).pipe(Effect.map((pull) => pull.draft === true));

const listFilesPage = (client: GitHubClient, number: number, page: number) =>
  request(
    client,
    "list pull request files",
    repoPath(
      client,
      `/pulls/${number}/files?per_page=${PAGE_SIZE}&page=${page}`
    ),
    Schema.Array(PullRequestFileSchema),
    {}
  );

export const listPullRequestFiles = Effect.fnUntraced(
  function* listPullRequestFiles(client: GitHubClient, number: number) {
    const files: string[] = [];

    for (let page = 1; page <= MAX_FILE_PAGES; page += 1) {
      const batch = yield* listFilesPage(client, number, page);

      files.push(...batch.map((file) => file.filename));

      if (batch.length < PAGE_SIZE) {
        break;
      }
    }

    return files;
  }
);

export const listOpenIssues = (client: GitHubClient) =>
  request(
    client,
    "list open issues",
    repoPath(
      client,
      `/issues?state=open&sort=created&direction=desc&per_page=${PAGE_SIZE}`
    ),
    Schema.Array(IssueSchema),
    {}
  );

export const addLabels = (
  client: GitHubClient,
  number: number,
  labels: readonly string[]
) =>
  request(
    client,
    "add labels",
    repoPath(client, `/issues/${number}/labels`),
    Schema.Array(LabelSchema),
    { body: { labels }, method: "POST" }
  );

const MAX_LABEL_PAGES = 10;

export const listRepositoryLabels = Effect.fnUntraced(
  function* listRepositoryLabels(client: GitHubClient) {
    const labels: (typeof RepositoryLabelSchema.Type)[] = [];

    for (let page = 1; page <= MAX_LABEL_PAGES; page += 1) {
      const batch = yield* request(
        client,
        "list labels",
        repoPath(client, `/labels?per_page=${PAGE_SIZE}&page=${page}`),
        Schema.Array(RepositoryLabelSchema),
        {}
      );

      labels.push(...batch);

      if (batch.length < PAGE_SIZE) {
        break;
      }
    }

    return labels;
  }
);

export const updateLabel = (
  client: GitHubClient,
  currentName: string,
  label: typeof RepositoryLabelSchema.Type
) =>
  request(
    client,
    "update label",
    repoPath(client, `/labels/${encodeURIComponent(currentName)}`),
    RepositoryLabelSchema,
    {
      body: {
        color: label.color,
        description: label.description,
        new_name: label.name,
      },
      method: "PATCH",
    }
  );

export const createLabel = (
  client: GitHubClient,
  label: typeof RepositoryLabelSchema.Type
) =>
  request(
    client,
    "create label",
    repoPath(client, "/labels"),
    RepositoryLabelSchema,
    { body: label, method: "POST" }
  );
