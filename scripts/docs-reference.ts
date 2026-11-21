#!/usr/bin/env bun
import {
  API_KEY_HEADER,
  API_KEY_PREFIX,
  API_KEY_RATE_LIMIT,
  API_KEY_SESSION_PATH,
} from "@freenary/auth/api-key";
import { REAUTH_WINDOW_SECONDS } from "@freenary/auth/policy";
import type { OpenAPI } from "@orpc/openapi";
import { OpenAPIGenerator } from "@orpc/openapi";
import type {
  AnyMiddleware,
  AnyProcedure,
  AnyRouter,
  Context,
  Lazyable,
  MiddlewareResult,
} from "@orpc/server";
import { isLazy, isProcedure, ORPCError } from "@orpc/server";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { Effect } from "effect";
import { z } from "zod";

import {
  code,
  escapeCell,
  escapeProse,
  formatted,
  generatedPage,
  table,
} from "./docs-markdown";

const literalSchema = z.union([z.string(), z.number(), z.boolean(), z.null()]);

type Literal = z.infer<typeof literalSchema>;

interface JsonSchema {
  $ref?: string;
  const?: Literal;
  enum?: Literal[];
  format?: string;
  items?: JsonSchema;
  properties?: Record<string, JsonSchema>;
  required: string[];
  types: string[];
  variants?: JsonSchema[];
}

const jsonSchemaParser: z.ZodType<JsonSchema> = z.lazy(() =>
  z
    .object({
      $ref: z.string().optional(),
      anyOf: z.array(jsonSchemaParser).optional(),
      const: literalSchema.optional(),
      enum: z.array(literalSchema).optional(),
      format: z.string().optional(),
      items: jsonSchemaParser.optional(),
      oneOf: z.array(jsonSchemaParser).optional(),
      properties: z.record(z.string(), jsonSchemaParser).optional(),
      required: z.array(z.string()).default([]),
      type: z
        .union([z.string().transform((type) => [type]), z.array(z.string())])
        .default([]),
      "x-native-type": z.string().optional(),
    })
    .transform(
      ({
        anyOf,
        oneOf,
        type,
        "x-native-type": nativeType,
        format,
        ...rest
      }) => ({
        ...rest,
        format: nativeType ?? format,
        types: type,
        variants: anyOf ?? oneOf,
      })
    )
);

const operationParser = z.object({
  operationId: z.string().optional(),
  parameters: z
    .array(
      z.object({
        in: z.string(),
        name: z.string(),
        required: z.boolean().default(false),
        schema: jsonSchemaParser.optional(),
      })
    )
    .default([]),
  requestBody: z
    .object({
      content: z
        .record(z.string(), z.object({ schema: jsonSchemaParser.optional() }))
        .default({}),
      required: z.boolean().default(false),
    })
    .optional(),
});

type Operation = z.infer<typeof operationParser>;

const documentParser = z.object({
  paths: z
    .record(z.string(), z.record(z.string(), operationParser))
    .default({}),
});

interface Route {
  method: string;
  path: string;
  operation: Operation;
}

interface ProcedureEntry {
  path: string[];
  procedure: AnyProcedure;
}

interface Field {
  name: string;
  schema: JsonSchema | undefined;
  required: boolean;
}

type Access = "Public" | "Signed in" | "Operator";

type ProbeOutcome =
  | "reached-next"
  | "returned"
  | "unauthorized"
  | "read-user-id"
  | "failed";

const SHELL_SAFE = /^[\w@%+=:,./-]+$/u;

const shellWord = (word: string): string =>
  SHELL_SAFE.test(word) ? word : `'${word.replaceAll("'", "'\\''")}'`;

const codeList = (values: string[]): string => values.map(code).join(", ");

const execForm = z
  .array(z.string())
  .transform((words) => words.map(shellWord).join(" "));

const healthcheckTest = z.union([
  z.string(),
  z
    .array(z.string())
    .transform(([kind, ...rest]) =>
      kind === "CMD-SHELL" ? rest.join(" ") : JSON.stringify(rest)
    ),
]);

const buildParser = z.union([
  z.string().transform((context) => `build context ${code(context)}`),
  z
    .object({
      context: z.string().default("."),
      dockerfile: z.string().default("Dockerfile"),
    })
    .transform(
      ({ context, dockerfile }) =>
        `build ${code(dockerfile)} in context ${code(context)}`
    ),
]);

const portList = z
  .array(z.union([z.string(), z.number().transform(String)]))
  .transform(codeList);

const dependencyParser = z.union([
  z.array(z.string()).transform(codeList),
  z
    .record(
      z.string(),
      z.object({ condition: z.string().default("service_started") })
    )
    .transform((dependencies) =>
      Object.entries(dependencies)
        .map(([name, { condition }]) => `${code(name)} (${code(condition)})`)
        .join(", ")
    ),
]);

const environmentParser = z.union([
  z
    .array(z.string())
    .transform((entries) =>
      codeList(entries.map((entry) => entry.split("=")[0] ?? entry).toSorted())
    ),
  z
    .record(z.string(), literalSchema)
    .transform((environment) => codeList(Object.keys(environment).toSorted())),
]);

const envFileEntry = z.union([
  z.string().transform(code),
  z
    .object({ path: z.string(), required: z.boolean().default(true) })
    .transform(
      ({ path, required }) => `${code(path)}${required ? "" : " if it exists"}`
    ),
]);

const envFileParser = z.union([
  z.string().transform(code),
  z.array(envFileEntry).transform((entries) => entries.join(", ")),
]);

const volumeParser = z
  .array(
    z.union([
      z.string(),
      z
        .object({ source: z.string().default(""), target: z.string() })
        .transform(({ source, target }) => `${source}:${target}`),
    ])
  )
  .transform(codeList);

const serviceParser = z.object({
  build: buildParser.optional(),
  command: z.union([z.string(), execForm]).optional(),
  depends_on: dependencyParser.optional(),
  env_file: envFileParser.optional(),
  environment: environmentParser.optional(),
  expose: portList.optional(),
  healthcheck: z.object({ test: healthcheckTest.optional() }).optional(),
  image: z.string().optional(),
  ports: portList.optional(),
  restart: z.string().optional(),
  volumes: volumeParser.optional(),
});

type ComposeService = z.infer<typeof serviceParser>;

const composeFileParser = z.object({
  services: z.record(z.string(), serviceParser).default({}),
});

const manifestParser = z.object({
  scripts: z.record(z.string(), z.string()).default({}),
});

interface Output {
  file: string;
  render: () => Promise<string>;
}

interface Rendered {
  file: string;
  contents: string;
}

const GENERATOR_FILE = "scripts/docs-reference.ts";
const GENERATE_COMMAND = "bun run docs:generate";
const SERVER_ENTRY = "apps/server/src/index.ts";
const API_ACCESS_SOURCE = "packages/api/src/index.ts";
const OPENAPI_FILE = "docs/reference/openapi.json";
const API_PAGE = "docs/reference/api.md";
const COMMANDS_PAGE = "docs/reference/commands.md";
const COMPOSE_PAGE = "docs/reference/compose-files.md";
const OPENAPI_PREFIX = "/api-reference";
const RPC_PREFIX = "/rpc";
const TOP_LEVEL_GROUP = "Top-level procedures";
const ENUM_VALUES_SHOWN = 6;
const JSON_INDENT = 2;
const SUCCESS = 0;
const FAILURE = 1;

const COMPOSE_FILES = [
  "docker-compose.yml",
  "deploy/docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.mail.yml",
  "docker-compose.ai.yml",
];

const SERVER_FACTS: readonly [string, RegExp][] = [
  ["the Better Auth handler on /api/auth/*", /\.all\(\s*"\/api\/auth\/\*"/u],
  ["the RPC handler on /rpc*", /\.all\(\s*"\/rpc\*"/u],
  ["the RPC prefix", /prefix: "\/rpc"/u],
  ["the assistant chat on POST /ai/chat", /\.post\(\s*"\/ai\/chat"/u],
  ["the OpenAPI handler on /api-reference*", /\.all\(\s*"\/api-reference\*"/u],
  ["the OpenAPI prefix", /prefix: "\/api-reference"/u],
  ["the OpenAPI reference plugin", /new OpenAPIReferencePlugin\(/u],
  ["the Zod schema converter", /new ZodToJsonSchemaConverter\(\)/u],
  [
    "the CSRF plugin of the RPC handler",
    /new SimpleCsrfProtectionHandlerPlugin\(\)/u,
  ],
  [
    "the JSON-only POST rule of /api-reference",
    /!isJsonRequest\(context\.request\)/u,
  ],
  ["the MCP endpoint on /mcp", /\.all\(\s*"\/mcp"/u],
  [
    "the API key refusal on /rpc, /api-reference and /ai/chat",
    /refusedApiKeyResponse\(request\.headers\)/u,
  ],
  ["the mock bank consent page", /\.get\(MOCK_CONSENT_PATH/u],
  ["the health check on GET /", /\.get\("\/", \(\) => "OK"\)/u],
  ["the CORS origin", /origin: env\.CORS_ORIGIN/u],
];

const ENV_INTERPOLATION =
  /\$\{(?<name>[A-Z][A-Z0-9_]*)(?<operator>:?[?-])(?<value>[^}]*)\}/gu;

const HEADER_COMMENT = /^#(?: (?<text>.*))?$/u;
const TOP_LEVEL_NAME = /^name:/u;

const failures: string[] = [];

const fail = (message: string): void => {
  failures.push(message);
};

const PROBE_SENTINEL = new Error("docs-reference probe: the user id was read");

const probeSession = {
  user: {
    get id(): string {
      throw PROBE_SENTINEL;
    },
  },
};

const STORED_SETTINGS_WARNING = /The environment alone is in force\.$/u;

const withoutStoredSettingsWarning = async <Loaded>(
  load: () => Promise<Loaded>
): Promise<Loaded> => {
  const { warn } = console;

  console.warn = (message = "", ...rest: string[]) => {
    if (!STORED_SETTINGS_WARNING.test(message)) {
      warn(message, ...rest);
    }
  };

  const loaded = await load();

  console.warn = warn;

  return loaded;
};

const loadApi = async () => {
  process.env.SKIP_ENV_VALIDATION ??= "1";
  process.env.BETTER_AUTH_URL ??= "http://localhost:3000";
  process.env.CORS_ORIGIN ??= "http://localhost:3001";
  process.env.NODE_ENV = "development";

  const [routers, builders, consent] = await withoutStoredSettingsWarning(() =>
    Promise.all([
      import("@freenary/api/routers/index"),
      import("@freenary/api"),
      import("@freenary/api/providers/mock/consent"),
    ])
  );

  return { builders, consent, routers };
};

type Api = Awaited<ReturnType<typeof loadApi>>;

const proceduresOf = (
  node: Lazyable<AnyRouter>,
  path: string[] = []
): ProcedureEntry[] => {
  if (isProcedure(node)) {
    return [{ path, procedure: node }];
  }

  if (isLazy(node)) {
    fail(
      `${path.join(".")}: a lazy router, which ${GENERATOR_FILE} does not load. Teach proceduresOf to unlazy it.`
    );

    return [];
  }

  return Object.entries(node).flatMap(([key, child]) =>
    proceduresOf(child, [...path, key])
  );
};

const probeFailure = (
  readUserId: boolean,
  unauthorized: boolean
): ProbeOutcome => {
  if (readUserId) {
    return "read-user-id";
  }

  return unauthorized ? "unauthorized" : "failed";
};

const runMiddleware = (
  middleware: AnyMiddleware,
  procedure: AnyProcedure,
  context: Context
): Promise<ProbeOutcome> => {
  let reachedNext = false;

  const next = <U extends Context>(): MiddlewareResult<U, undefined> => {
    reachedNext = true;

    // SAFETY: the probe stops at next, and nothing reads the context it hands back.
    return { context: {} as U, output: undefined };
  };

  return Effect.runPromise(
    Effect.tryPromise({
      catch: (error) =>
        probeFailure(
          error === PROBE_SENTINEL,
          error instanceof ORPCError && error.code === "UNAUTHORIZED"
        ),
      try: async (): Promise<ProbeOutcome> => {
        await middleware(
          {
            context,
            errors: {},
            lastEventId: undefined,
            next,
            path: [],
            procedure,
          },
          undefined,
          (output) => ({ context: {}, output })
        );

        return reachedNext ? "reached-next" : "returned";
      },
    }).pipe(
      Effect.match({
        onFailure: (outcome) => outcome,
        onSuccess: (outcome) => outcome,
      })
    )
  );
};

const sameMiddlewares = (
  left: readonly AnyMiddleware[],
  right: readonly AnyMiddleware[]
): boolean =>
  left.length === right.length &&
  left.every((middleware, index) => middleware === right[index]);

const PROBED_ACCESS: Partial<Record<ProbeOutcome, Access>> = {
  "reached-next": "Signed in",
  "read-user-id": "Operator",
};

const probedAccess = async (
  procedure: AnyProcedure
): Promise<Access | undefined> => {
  const { middlewares } = procedure["~orpc"];
  const [only] = middlewares;

  if (middlewares.length !== 1 || only === undefined) {
    return undefined;
  }

  const anonymous = await runMiddleware(only, procedure, {});

  if (anonymous !== "unauthorized") {
    return undefined;
  }

  const signedIn = await runMiddleware(only, procedure, {
    session: probeSession,
  });

  return PROBED_ACCESS[signedIn];
};

const accessOf = async (
  api: Api,
  { path, procedure }: ProcedureEntry
): Promise<Access> => {
  const { middlewares } = procedure["~orpc"];
  const { operatorProcedure, protectedProcedure, publicProcedure } =
    api.builders;

  const known: [readonly AnyMiddleware[], Access][] = [
    [publicProcedure["~orpc"].middlewares, "Public"],
    [protectedProcedure["~orpc"].middlewares, "Signed in"],
    [operatorProcedure["~orpc"].middlewares, "Operator"],
  ];

  const matched = known.find(([builder]) =>
    sameMiddlewares(middlewares, builder)
  );

  const access = matched?.[1] ?? (await probedAccess(procedure));

  if (access === undefined) {
    fail(
      `${path.join(".")}: its middlewares match none of publicProcedure, protectedProcedure or operatorProcedure in ${API_ACCESS_SOURCE}. Teach accessOf in ${GENERATOR_FILE} the new access rule.`
    );

    return "Public";
  }

  return access;
};

const generateSpec = async (api: Api) => {
  const generator = new OpenAPIGenerator({
    schemaConverters: [new ZodToJsonSchemaConverter()],
  });

  return await generator.generate(api.routers.appRouter, {
    servers: [{ url: OPENAPI_PREFIX }],
  });
};

const literal = (value: Literal): string => code(JSON.stringify(value));

const formatLabel = (type: string, format: string | undefined): string =>
  format === undefined ? type : `${type} (${format})`;

const typeLabel = (schema: JsonSchema | undefined): string => {
  if (schema === undefined) {
    return "any";
  }

  if (schema.const !== undefined) {
    return literal(schema.const);
  }

  if (schema.enum !== undefined) {
    return schema.enum.length <= ENUM_VALUES_SHOWN
      ? schema.enum.map(literal).join(" or ")
      : `one of ${schema.enum.length} values`;
  }

  if (schema.variants !== undefined) {
    return [...new Set(schema.variants.map(typeLabel))].join(" or ");
  }

  if (schema.$ref !== undefined) {
    return code(schema.$ref);
  }

  return schema.types.length === 0
    ? "any"
    : schema.types
        .map((type) =>
          type === "array"
            ? `array of ${typeLabel(schema.items)}`
            : formatLabel(type, schema.format)
        )
        .join(" or ");
};

const fieldList = (fields: Field[]): string =>
  fields
    .map(
      ({ name, schema, required }) =>
        `${code(name)} ${typeLabel(schema)}${required ? ", required" : ""}`
    )
    .join("; ");

const inputCell = (operation: Operation): string => {
  const body = operation.requestBody?.content["application/json"]?.schema;
  const parameters = operation.parameters.map((parameter): Field => ({
    name: `${parameter.name} (${parameter.in})`,
    required: parameter.required,
    schema: parameter.schema,
  }));

  if (body !== undefined && body.properties === undefined) {
    return escapeCell(
      `${typeLabel(body)}${operation.requestBody?.required === true ? ", required" : ""}`
    );
  }

  const required = new Set(body?.required);
  const bodyFields = Object.entries(body?.properties ?? {}).map(
    ([name, schema]): Field => ({
      name,
      required: required.has(name),
      schema,
    })
  );

  const fields = [...parameters, ...bodyFields];

  return fields.length === 0 ? "none" : escapeCell(fieldList(fields));
};

const routesOf = (spec: OpenAPI.Document): Map<string, Route> => {
  const { paths } = documentParser.parse(spec);
  const routes = new Map<string, Route>();

  for (const [path, operations] of Object.entries(paths)) {
    for (const [method, operation] of Object.entries(operations)) {
      if (operation.operationId !== undefined) {
        routes.set(operation.operationId, {
          method: method.toUpperCase(),
          operation,
          path,
        });
      }
    }
  }

  return routes;
};

const auditServerEntry = async (): Promise<void> => {
  const source = await Bun.file(SERVER_ENTRY).text();

  for (const [fact, pattern] of SERVER_FACTS) {
    if (!pattern.test(source)) {
      fail(
        `${SERVER_ENTRY}: ${fact} is gone or changed, and ${API_PAGE} still states it. Update the endpoint table in ${GENERATOR_FILE}.`
      );
    }
  }
};

const endpointTable = (api: Api): string =>
  table(
    ["Path", "Method", "What it serves"],
    [
      [
        code(`${RPC_PREFIX}/*`),
        "any",
        `The oRPC RPC protocol the web app calls. A procedure ${code("a.b")} answers at ${code(`${RPC_PREFIX}/a/b`)}. The handler carries oRPC's simple CSRF protection plugin.`,
      ],
      [
        code(`${OPENAPI_PREFIX}/*`),
        "per procedure",
        `The same procedures over plain HTTP and JSON, at the routes in the tables below. A ${code("POST")} whose ${code("Content-Type")} is not ${code("application/json")} gets ${code("415 unsupported_media_type")}.`,
      ],
      [
        code(OPENAPI_PREFIX),
        code("GET"),
        "The interactive API reference, rendered by oRPC's OpenAPI reference plugin.",
      ],
      [
        code(`${OPENAPI_PREFIX}/spec.json`),
        code("GET"),
        `The OpenAPI document, built per request. Its ${code("servers")} entry is the origin of that request.`,
      ],
      [
        code("/api/auth/*"),
        `${code("GET")}, ${code("POST")}`,
        `Better Auth: sign-up, sign-in, sessions and the sign-in callbacks. Any other method gets ${code("405")}.`,
      ],
      [
        code("/ai/chat"),
        code("POST"),
        `The assistant chat. It needs a JSON body (${code("415 unsupported_media_type")} otherwise) and a session or an API key (${code("401 unauthorized")}), and answers ${code("503 unconfigured")} while no assistant model is set.`,
      ],
      [
        code("/mcp"),
        code("POST"),
        `The MCP server for AI agents, over Streamable HTTP without sessions; each answer is one JSON body. It needs an API key: ${code("401 unauthorized")} without one, even with a session cookie. A request whose ${code("Origin")} is not ${code("CORS_ORIGIN")} gets ${code("403 forbidden_origin")}, and another method gets ${code("405")}. [MCP server](mcp-server.md) lists its tools.`,
      ],
      [
        code(api.consent.MOCK_CONSENT_PATH),
        code("GET"),
        `The consent page of the ${code("mock")} bank provider. It answers ${code("404")} when ${code("NODE_ENV")} is ${code("production")}.`,
      ],
      [code("/"), code("GET"), `The health check. It answers ${code("OK")}.`],
    ]
  );

const ACCESS_LEGEND = [
  `${code("Public")}: no session needed.`,
  `${code("Signed in")}: a Better Auth session or an API key; without one the call fails with ${code("UNAUTHORIZED")} (401).`,
  `${code("Operator")}: a session of the operator account; without a session the call fails with ${code("UNAUTHORIZED")} (401), and with another account or with an API key with ${code("FORBIDDEN")} (403).`,
];

const MILLISECONDS_PER_SECOND = 1000;
const SECONDS_PER_MINUTE = 60;

const CREDENTIALS = [
  "## Credentials",
  "A call acts for one account. It proves which one with either credential:",
  [
    `- The Better Auth session cookie the web app receives at sign-in.`,
    `- An API key, which the account creates and revokes in **Settings → Security → API keys**. Send it as ${code("Authorization: Bearer <key>")} or in the ${code(API_KEY_HEADER)} header. A key starts with ${code(API_KEY_PREFIX)}, and the server keeps only its hash.`,
  ].join("\n"),
  `An API key acts as its account on ${code(`${RPC_PREFIX}/*`)}, ${code(`${OPENAPI_PREFIX}/*`)}, ${code("/ai/chat")} and ${code("/mcp")}, with these limits:`,
  [
    `- A key may make at most ${API_KEY_RATE_LIMIT.maxRequests} requests per ${API_KEY_RATE_LIMIT.timeWindowMs / MILLISECONDS_PER_SECOND} seconds. Past that, a call gets ${code("429 rate_limited")}.`,
    `- An unknown, revoked or expired key gets ${code("401 invalid_api_key")}.`,
    `- A key cannot call an ${code("Operator")} procedure.`,
    `- A key cannot call ${code("/api/auth/*")}, except ${code(`/api/auth${API_KEY_SESSION_PATH}`)}: Better Auth answers ${code("403")} with the code ${code("API_KEY_NOT_ALLOWED")}. Creating a key needs a session cookie from a sign-in less than ${REAUTH_WINDOW_SECONDS / SECONDS_PER_MINUTE} minutes old.`,
  ].join("\n"),
].join("\n\n");

const renderApiPage = async (
  api: Api,
  spec: OpenAPI.Document
): Promise<string> => {
  const routes = routesOf(spec);
  const procedures = proceduresOf(api.routers.appRouter);
  const accesses = await Promise.all(
    procedures.map((entry) => accessOf(api, entry))
  );

  const groups = new Map<string, string[][]>();

  for (const [index, entry] of procedures.entries()) {
    const name = entry.path.join(".");
    const route = routes.get(name);

    if (route === undefined) {
      fail(
        `${name}: no operation with this operationId in the OpenAPI document.`
      );
    }

    const group =
      entry.path.length > 1 ? (entry.path[0] ?? "") : TOP_LEVEL_GROUP;

    const rows = groups.get(group) ?? [];

    rows.push([
      code(name),
      route === undefined
        ? "none"
        : code(`${route.method} ${OPENAPI_PREFIX}${route.path}`),
      accesses[index] ?? "Public",
      route === undefined ? "none" : inputCell(route.operation),
    ]);

    groups.set(group, rows);
  }

  const sections = [...groups]
    .toSorted(
      ([left], [right]) =>
        Number(left === TOP_LEVEL_GROUP) - Number(right === TOP_LEVEL_GROUP)
    )
    .map(([group, rows]) =>
      [
        `## ${group}`,
        table(["Procedure", "HTTP route", "Access", "Input fields"], rows),
      ].join("\n\n")
    );

  return generatedPage({
    body: [
      `The API server answers on these paths. It allows cross-origin calls from ${code("CORS_ORIGIN")} alone, with credentials.`,
      endpointTable(api),
      CREDENTIALS,
      "## Procedures",
      `Each procedure below answers over both protocols. The HTTP route is the OpenAPI one; the input is the JSON body, and a field without ${code("required")} may be left out. [${code(OPENAPI_FILE)}](https://github.com/suiramdev/freenary/blob/dev/${OPENAPI_FILE}) holds the full schemas, the same document ${code(`${OPENAPI_PREFIX}/spec.json`)} serves.`,
      `The Access column comes from the middleware of each procedure in ${code(API_ACCESS_SOURCE)}:`,
      ACCESS_LEGEND.map((line) => `- ${line}`).join("\n"),
      ...sections,
    ].join("\n\n"),
    command: GENERATE_COMMAND,
    description: "Every API procedure, its HTTP route and its input.",
    source: `${code("appRouter")} in ${code("packages/api/src/routers/index.ts")} and ${code(SERVER_ENTRY)}`,
    title: "API",
  });
};

const renderCommandsPage = async (): Promise<string> => {
  const manifest = manifestParser.parse(await Bun.file("package.json").json());
  const rows = Object.entries(manifest.scripts).map(([name, command]) => [
    code(`bun run ${name}`),
    escapeCell(code(command)),
  ]);

  return generatedPage({
    body: [
      "Run each from the repository root.",
      table(["Command", "Runs"], rows),
    ].join("\n\n"),
    command: GENERATE_COMMAND,
    description: "Every script in the root package.json.",
    source: `the ${code("scripts")} of the root ${code("package.json")}`,
    title: "Commands",
  });
};

const headerComment = (file: string, contents: string): string => {
  const paragraphs: string[][] = [[]];

  for (const line of contents.split("\n")) {
    const comment = HEADER_COMMENT.exec(line);

    if (comment === null) {
      const started = paragraphs.flat().length > 0;
      const skippable = line.trim() === "" || TOP_LEVEL_NAME.test(line);

      if (started || !skippable) {
        break;
      }

      continue;
    }

    const text = comment.groups?.text?.trim() ?? "";

    if (text === "") {
      paragraphs.push([]);
    } else {
      paragraphs.at(-1)?.push(text);
    }
  }

  const prose = paragraphs.flatMap((lines) =>
    lines.length > 0 ? [escapeProse(lines.join(" "))] : []
  );

  if (prose.length === 0) {
    fail(
      `${file}: no header comment. Open the file with a comment that says what the stack is for; ${COMPOSE_PAGE} quotes it.`
    );
  }

  return prose.join("\n\n");
};

const publishedPorts = (
  service: ComposeService,
  extendsBase: boolean
): string | undefined => {
  if (service.ports !== undefined) {
    return service.ports;
  }

  return extendsBase ? undefined : "none";
};

const serviceLines = (service: ComposeService): string[] => {
  const extendsBase =
    service.image === undefined && service.build === undefined;

  const lines: [string, string | undefined][] = [
    [
      "Extends",
      extendsBase
        ? "the service of the same name in the file it is layered over"
        : undefined,
    ],
    ["Image", service.image === undefined ? undefined : code(service.image)],
    ["Build", service.build],
    [
      "Command",
      service.command === undefined ? undefined : code(service.command),
    ],
    ["Published ports", publishedPorts(service, extendsBase)],
    ["Exposed, not published", service.expose],
    ["Depends on", service.depends_on],
    [
      "Healthcheck",
      service.healthcheck?.test === undefined
        ? undefined
        : code(service.healthcheck.test),
    ],
    ["Volumes", service.volumes],
    ["Reads the env file", service.env_file],
    ["Environment it sets", service.environment],
    [
      "Restart",
      service.restart === undefined ? undefined : code(service.restart),
    ],
  ];

  return lines.flatMap(([label, value]) =>
    value === undefined ? [] : [`- ${label}: ${value}`]
  );
};

const interpolations = (contents: string) => {
  const required = new Map<string, Set<string>>();
  const defaults = new Map<string, Set<string>>();

  for (const match of contents.matchAll(ENV_INTERPOLATION)) {
    const { name, operator, value } = match.groups ?? {};

    if (name === undefined || operator === undefined) {
      continue;
    }

    const target = operator.endsWith("?") ? required : defaults;
    const values = target.get(name) ?? new Set<string>();

    values.add(value ?? "");
    target.set(name, values);
  }

  return { defaults, required };
};

const interpolationTable = (
  header: string[],
  entries: Map<string, Set<string>>,
  empty: string
): string =>
  table(
    header,
    [...entries]
      .toSorted(([left], [right]) => left.localeCompare(right))
      .flatMap(([name, values]) =>
        [...values].map((value) => [
          code(name),
          value === "" ? empty : escapeCell(code(value)),
        ])
      )
  );

const composeSection = (file: string, contents: string): string => {
  const parsed = composeFileParser.parse(Bun.YAML.parse(contents));
  const { defaults, required } = interpolations(contents);
  const services = Object.entries(parsed.services).map(([name, service]) =>
    [`### ${code(name)}`, serviceLines(service).join("\n")].join("\n\n")
  );

  return [
    `## ${code(file)}`,
    headerComment(file, contents),
    ...services,
    "### Required variables",
    required.size === 0
      ? "No variable is required."
      : [
          "Compose refuses to start while one of these is unset or empty, and prints the message.",
          interpolationTable(["Variable", "Message"], required, "none"),
        ].join("\n\n"),
    "### Defaults",
    defaults.size === 0
      ? "The file sets no default."
      : [
          "A variable that is unset or empty takes this value.",
          interpolationTable(["Variable", "Default"], defaults, "empty"),
        ].join("\n\n"),
  ].join("\n\n");
};

const renderComposePage = async (): Promise<string> => {
  const contents = await Promise.all(
    COMPOSE_FILES.map((file) => Bun.file(file).text())
  );

  return generatedPage({
    body: [
      "Each file, what it is for, and what every service runs. The variable tables list every interpolation in the file.",
      ...COMPOSE_FILES.map((file, index) =>
        composeSection(file, contents[index] ?? "")
      ),
    ].join("\n\n"),
    command: GENERATE_COMMAND,
    description:
      "The services, ports, volumes and required values of each Compose file.",
    source: codeList(COMPOSE_FILES),
    title: "Compose files",
  });
};

const isStale = async ({ file, contents }: Rendered): Promise<boolean> => {
  const target = Bun.file(file);
  const current = (await target.exists()) ? await target.text() : "";

  return current !== contents;
};

const DIFFERENCE_CONTEXT_LINES = 3;

const firstDifference = (committed: string, generated: string): string => {
  const before = committed.split("\n");
  const after = generated.split("\n");
  const line = after.findIndex((text, index) => text !== before[index]);
  const at = line === -1 ? Math.min(before.length, after.length) : line;
  const window = (lines: string[]) =>
    lines
      .slice(at, at + DIFFERENCE_CONTEXT_LINES)
      .map((text) => `\n    ${text}`)
      .join("");

  return `\n  first difference at line ${at + 1}\n  committed:${window(before)}\n  generated:${window(after)}`;
};

const main = async (): Promise<number> => {
  const checkOnly = process.argv.includes("--check");
  const api = await loadApi();
  const spec = await generateSpec(api);

  await auditServerEntry();

  const outputs: Output[] = [
    {
      file: OPENAPI_FILE,
      render: () => Promise.resolve(JSON.stringify(spec, null, JSON_INDENT)),
    },
    { file: API_PAGE, render: () => renderApiPage(api, spec) },
    { file: COMMANDS_PAGE, render: renderCommandsPage },
    { file: COMPOSE_PAGE, render: renderComposePage },
  ];

  const rendered = await Promise.all(
    outputs.map(async ({ file, render }): Promise<Rendered> => ({
      contents: await formatted(file, await render()),
      file,
    }))
  );

  const staleness = await Promise.all(rendered.map(isStale));
  const stale = rendered.filter((_output, index) => staleness[index]);

  if (checkOnly) {
    const committed = await Promise.all(
      stale.map(({ file }) => Bun.file(file).text())
    );

    for (const [index, { contents, file }] of stale.entries()) {
      fail(
        `${file}: stale. Run \`${GENERATE_COMMAND}\`.${firstDifference(committed[index] ?? "", contents)}`
      );
    }
  }

  for (const message of new Set(failures)) {
    process.stderr.write(`docs-reference: ${message}\n`);
  }

  if (failures.length > 0) {
    return FAILURE;
  }

  await Promise.all(
    stale.map(({ file, contents }) => Bun.write(file, contents))
  );

  process.stdout.write(
    stale.length > 0
      ? `docs-reference: wrote ${stale.map(({ file }) => file).join(", ")}\n`
      : `docs-reference: ${outputs.length} generated files current\n`
  );

  return SUCCESS;
};

process.exit(await main());
