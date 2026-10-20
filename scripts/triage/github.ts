import { Data, Effect, Schema } from "effect";

const API_ROOT = "https://api.github.com";
export const WORKFLOW_ACTOR = "github-actions[bot]";
const PAGE_SIZE = 100;
const MAX_FILE_PAGES = 30;
const NOT_FOUND = 404;
const NO_CONTENT = 204;
const MAX_COMMENT_PAGES = 10;

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

const UserSchema = Schema.Struct({ login: Schema.String });

export const IssueSchema = Schema.Struct({
  body: Schema.optional(Schema.NullOr(Schema.String)),
  labels: Schema.Array(LabelSchema),
  number: Schema.Number,
  pull_request: Schema.optional(Schema.Unknown),
  state: Schema.optional(Schema.String),
  title: Schema.String,
  user: Schema.optional(Schema.NullOr(UserSchema)),
});

export type Issue = typeof IssueSchema.Type;

const PullRequestSchema = Schema.Struct({
  draft: Schema.optional(Schema.Boolean),
  head: Schema.Struct({ sha: Schema.String }),
});

const CheckRunsSchema = Schema.Struct({
  check_runs: Schema.Array(
    Schema.Struct({
      conclusion: Schema.optional(Schema.NullOr(Schema.String)),
      id: Schema.Number,
      name: Schema.String,
      status: Schema.String,
    })
  ),
});

const CommentSchema = Schema.Struct({
  body: Schema.optional(Schema.NullOr(Schema.String)),
  id: Schema.Number,
  user: Schema.optional(Schema.NullOr(UserSchema)),
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

  if (response.status === NO_CONTENT) {
    return yield* Schema.decodeUnknownEffect(schema)(null).pipe(
      Effect.mapError(
        (cause: Schema.SchemaError) =>
          new GitHubRequestFailed({
            operation,
            reason: { detail: cause.message, kind: "undecodable" },
          })
      )
    );
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

export const getPullRequest = (client: GitHubClient, number: number) =>
  request(
    client,
    "get pull request",
    repoPath(client, `/pulls/${number}`),
    PullRequestSchema,
    {}
  );

export const listCheckRuns = (client: GitHubClient, sha: string) =>
  request(
    client,
    "list check runs",
    repoPath(client, `/commits/${sha}/check-runs?per_page=${PAGE_SIZE}`),
    CheckRunsSchema,
    {}
  ).pipe(Effect.map((listing) => listing.check_runs));

export type Comment = typeof CommentSchema.Type;

export const listComments = Effect.fnUntraced(function* listComments(
  client: GitHubClient,
  number: number
) {
  const comments: Comment[] = [];

  for (let page = 1; page <= MAX_COMMENT_PAGES; page += 1) {
    const batch = yield* request(
      client,
      "list comments",
      repoPath(
        client,
        `/issues/${number}/comments?per_page=${PAGE_SIZE}&page=${page}`
      ),
      Schema.Array(CommentSchema),
      {}
    );

    comments.push(...batch);

    if (batch.length < PAGE_SIZE) {
      break;
    }
  }

  return comments;
});

export const createComment = (
  client: GitHubClient,
  number: number,
  body: string
) =>
  request(
    client,
    "create comment",
    repoPath(client, `/issues/${number}/comments`),
    CommentSchema,
    { body: { body }, method: "POST" }
  );

export const updateComment = (
  client: GitHubClient,
  commentId: number,
  body: string
) =>
  request(
    client,
    "update comment",
    repoPath(client, `/issues/comments/${commentId}`),
    CommentSchema,
    { body: { body }, method: "PATCH" }
  );

export const deleteComment = (client: GitHubClient, commentId: number) =>
  request(
    client,
    "delete comment",
    repoPath(client, `/issues/comments/${commentId}`),
    Schema.Null,
    { method: "DELETE" }
  );

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

const LabelEventSchema = Schema.Struct({
  actor: Schema.optional(Schema.NullOr(UserSchema)),
  event: Schema.String,
  label: Schema.optional(Schema.Struct({ name: Schema.String })),
});

const MAX_EVENT_PAGES = 10;

export const listLabelEvents = Effect.fnUntraced(function* listLabelEvents(
  client: GitHubClient,
  number: number
) {
  const events: (typeof LabelEventSchema.Type)[] = [];

  for (let page = 1; page <= MAX_EVENT_PAGES; page += 1) {
    const batch = yield* request(
      client,
      "list issue events",
      repoPath(
        client,
        `/issues/${number}/events?per_page=${PAGE_SIZE}&page=${page}`
      ),
      Schema.Array(LabelEventSchema),
      {}
    );

    events.push(...batch);

    if (batch.length < PAGE_SIZE) {
      return events;
    }
  }
});

export const removeLabel = (
  client: GitHubClient,
  number: number,
  labelName: string
) =>
  request(
    client,
    "remove label",
    repoPath(
      client,
      `/issues/${number}/labels/${encodeURIComponent(labelName)}`
    ),
    Schema.Array(LabelSchema),
    { method: "DELETE" }
  ).pipe(
    Effect.catchTag("GitHubRequestFailed", (failure) =>
      failure.reason.kind === "rejected" && failure.reason.status === NOT_FOUND
        ? Effect.logWarning(
            `label ${labelName} was already gone from #${number}`
          )
        : Effect.fail(failure)
    )
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
