import { Data, Effect, Schema } from "effect";

import type { IssueFieldEvent } from "./history";

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

const IssueTypeSchema = Schema.Struct({ name: Schema.String });

const IssueFieldValueSchema = Schema.Struct({
  issue_field_name: Schema.optional(Schema.NullOr(Schema.String)),
  single_select_option: Schema.optional(
    Schema.NullOr(Schema.Struct({ name: Schema.String }))
  ),
});

export const IssueSchema = Schema.Struct({
  body: Schema.optional(Schema.NullOr(Schema.String)),
  issue_field_values: Schema.optional(
    Schema.NullOr(Schema.Array(IssueFieldValueSchema))
  ),
  labels: Schema.Array(LabelSchema),
  number: Schema.Number,
  pull_request: Schema.optional(Schema.Unknown),
  state: Schema.optional(Schema.String),
  title: Schema.String,
  type: Schema.optional(Schema.NullOr(IssueTypeSchema)),
  user: Schema.optional(Schema.NullOr(UserSchema)),
});

export type Issue = typeof IssueSchema.Type;

export const fieldEntriesOf = (issue: Issue) =>
  (issue.issue_field_values ?? []).map((entry) => ({
    name: entry.issue_field_name ?? undefined,
    value: entry.single_select_option?.name,
  }));

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

export const setIssueType = (
  client: GitHubClient,
  number: number,
  issueType: string
) =>
  request(
    client,
    "set issue type",
    repoPath(client, `/issues/${number}`),
    IssueSchema,
    { body: { type: issueType }, method: "PATCH" }
  );

const IssueTypeEventSchema = Schema.Struct({
  actor: Schema.optional(Schema.NullOr(UserSchema)),
  event: Schema.optional(Schema.String),
  issue_type: Schema.optional(Schema.NullOr(IssueTypeSchema)),
  prev_issue_type: Schema.optional(Schema.NullOr(IssueTypeSchema)),
});

export const listIssueTypeEvents = Effect.fnUntraced(
  function* listIssueTypeEvents(client: GitHubClient, number: number) {
    const events: (typeof IssueTypeEventSchema.Type)[] = [];

    for (let page = 1; page <= MAX_EVENT_PAGES; page += 1) {
      const batch = yield* request(
        client,
        "list issue timeline",
        repoPath(
          client,
          `/issues/${number}/timeline?per_page=${PAGE_SIZE}&page=${page}`
        ),
        Schema.Array(IssueTypeEventSchema),
        {}
      );

      events.push(...batch);

      if (batch.length < PAGE_SIZE) {
        return events;
      }
    }
  }
);

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

const GraphQLErrorsSchema = Schema.optional(
  Schema.Array(Schema.Struct({ message: Schema.String }))
);

interface GraphQLEnvelope<Data> {
  readonly data?: Data | null | undefined;
  readonly errors?: readonly { readonly message: string }[] | undefined;
}

const graphql = Effect.fnUntraced(function* graphql<Data>(
  client: GitHubClient,
  operation: string,
  query: string,
  variables: Readonly<Record<string, string | number | null>>,
  schema: Schema.ConstraintDecoder<GraphQLEnvelope<Data>>
) {
  const response: GraphQLEnvelope<Data> = yield* request(
    client,
    operation,
    "/graphql",
    schema,
    { body: { query, variables }, method: "POST" }
  );

  if (response.errors && response.errors.length > 0) {
    return yield* new GitHubRequestFailed({
      operation,
      reason: {
        body: response.errors.map((error) => error.message).join("; "),
        kind: "rejected",
        status: 200,
      },
    });
  }

  if (response.data === undefined || response.data === null) {
    return yield* new GitHubRequestFailed({
      operation,
      reason: { detail: "no data in the response", kind: "undecodable" },
    });
  }

  return response.data;
});

const ownerAndName = (client: GitHubClient) => {
  const [owner = "", name = ""] = client.repository.split("/");

  return { name, owner };
};

const IssueFieldsQuery = `query ($owner: String!, $name: String!) {
  repository(owner: $owner, name: $name) {
    issueFields(first: 100) {
      nodes { ... on IssueFieldCommon { fullDatabaseId name } }
    }
  }
}`;

const IssueFieldsSchema = Schema.Struct({
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        repository: Schema.Struct({
          issueFields: Schema.Struct({
            nodes: Schema.Array(
              Schema.NullOr(
                Schema.Struct({
                  fullDatabaseId: Schema.optional(Schema.NullOr(Schema.String)),
                  name: Schema.optional(Schema.String),
                })
              )
            ),
          }),
        }),
      })
    )
  ),
  errors: GraphQLErrorsSchema,
});

export interface IssueField {
  readonly id: number;
  readonly name: string;
}

export const listIssueFields = Effect.fnUntraced(function* listIssueFields(
  client: GitHubClient
) {
  const fields = yield* graphql(
    client,
    "list issue fields",
    IssueFieldsQuery,
    ownerAndName(client),
    IssueFieldsSchema
  );

  return fields.repository.issueFields.nodes.flatMap((node): IssueField[] =>
    node?.name && node.fullDatabaseId
      ? [{ id: Number(node.fullDatabaseId), name: node.name }]
      : []
  );
});

const IssueFieldEventsQuery = `query ($owner: String!, $name: String!, $number: Int!, $after: String) {
  repository(owner: $owner, name: $name) {
    issue(number: $number) {
      timelineItems(
        first: 100
        after: $after
        itemTypes: [ISSUE_FIELD_ADDED_EVENT, ISSUE_FIELD_CHANGED_EVENT, ISSUE_FIELD_REMOVED_EVENT]
      ) {
        pageInfo { hasNextPage endCursor }
        nodes {
          __typename
          ... on IssueFieldAddedEvent {
            actor { __typename login }
            issueField { ... on IssueFieldCommon { name } }
            value
          }
          ... on IssueFieldChangedEvent {
            actor { __typename login }
            issueField { ... on IssueFieldCommon { name } }
            newValue
            previousValue
          }
          ... on IssueFieldRemovedEvent {
            actor { __typename login }
            issueField { ... on IssueFieldCommon { name } }
            options { name }
          }
        }
      }
    }
  }
}`;

const TimelineActorSchema = Schema.optional(
  Schema.NullOr(
    Schema.Struct({ __typename: Schema.String, login: Schema.String })
  )
);

const TimelineFieldSchema = Schema.optional(
  Schema.NullOr(Schema.Struct({ name: Schema.optional(Schema.String) }))
);

const OptionalText = Schema.optional(Schema.NullOr(Schema.String));

const FieldEventNodeSchema = Schema.Struct({
  __typename: Schema.String,
  actor: TimelineActorSchema,
  issueField: TimelineFieldSchema,
  newValue: OptionalText,
  options: Schema.optional(
    Schema.NullOr(Schema.Array(Schema.Struct({ name: Schema.String })))
  ),
  previousValue: OptionalText,
  value: OptionalText,
});

type FieldEventNode = typeof FieldEventNodeSchema.Type;

const IssueFieldEventsSchema = Schema.Struct({
  data: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        repository: Schema.Struct({
          issue: Schema.NullOr(
            Schema.Struct({
              timelineItems: Schema.Struct({
                nodes: Schema.Array(Schema.NullOr(FieldEventNodeSchema)),
                pageInfo: Schema.Struct({
                  endCursor: Schema.optional(Schema.NullOr(Schema.String)),
                  hasNextPage: Schema.Boolean,
                }),
              }),
            })
          ),
        }),
      })
    )
  ),
  errors: GraphQLErrorsSchema,
});

const restLogin = (actor: FieldEventNode["actor"]): string | undefined => {
  if (!actor) {
    return undefined;
  }

  return actor.__typename === "Bot" && !actor.login.endsWith("[bot]")
    ? `${actor.login}[bot]`
    : actor.login;
};

const FIELD_EVENT_KINDS: Readonly<Record<string, IssueFieldEvent["kind"]>> = {
  IssueFieldAddedEvent: "added",
  IssueFieldChangedEvent: "changed",
  IssueFieldRemovedEvent: "removed",
};

const toFieldEvent = (node: FieldEventNode): IssueFieldEvent[] => {
  const kind = FIELD_EVENT_KINDS[node.__typename];

  if (kind === undefined) {
    return [];
  }

  const removed = kind === "removed";

  return [
    {
      actor: restLogin(node.actor),
      field: node.issueField?.name,
      kind,
      previous: removed
        ? node.options?.[0]?.name
        : (node.previousValue ?? undefined),
      value: removed ? undefined : (node.newValue ?? node.value ?? undefined),
    },
  ];
};

export const listIssueFieldEvents = Effect.fnUntraced(
  function* listIssueFieldEvents(client: GitHubClient, number: number) {
    const events: IssueFieldEvent[] = [];
    let after: string | null = null;

    for (let page = 1; page <= MAX_EVENT_PAGES; page += 1) {
      const history: (typeof IssueFieldEventsSchema.Type)["data"] & object =
        yield* graphql(
          client,
          "list issue field events",
          IssueFieldEventsQuery,
          { ...ownerAndName(client), after, number },
          IssueFieldEventsSchema
        );

      const timeline = history.repository.issue?.timelineItems;

      if (!timeline) {
        return events;
      }

      events.push(
        ...timeline.nodes.flatMap((node) => (node ? toFieldEvent(node) : []))
      );

      if (!timeline.pageInfo.hasNextPage || !timeline.pageInfo.endCursor) {
        return events;
      }

      after = timeline.pageInfo.endCursor;
    }

    return events;
  }
);

export const setIssueFieldValues = (
  client: GitHubClient,
  number: number,
  values: readonly { readonly field_id: number; readonly value: string }[]
) =>
  request(
    client,
    "set issue field values",
    repoPath(client, `/issues/${number}/issue-field-values`),
    Schema.Array(IssueFieldValueSchema),
    { body: { issue_field_values: values }, method: "POST" }
  );

export const clearIssueFieldValue = (
  client: GitHubClient,
  number: number,
  fieldId: number
) =>
  request(
    client,
    "clear issue field value",
    repoPath(client, `/issues/${number}/issue-field-values/${fieldId}`),
    Schema.Null,
    { method: "DELETE" }
  ).pipe(
    Effect.catchTag("GitHubRequestFailed", (failure) =>
      failure.reason.kind === "rejected" && failure.reason.status === NOT_FOUND
        ? Effect.logWarning(`field ${fieldId} was already empty on #${number}`)
        : Effect.fail(failure)
    )
  );
