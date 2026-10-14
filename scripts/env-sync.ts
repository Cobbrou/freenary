#!/usr/bin/env bun
import { serverEnvSchema } from "@freenary/env/schema";
import { clientEnvSchema } from "@freenary/env/schema-web";
import { Glob } from "bun";
import { z } from "zod";

type Kind = "compose" | "compose-dev" | "raw" | "client" | "inert";

type Placement = "required" | "commented" | "none";

type SchemaEntry = readonly [string, z.ZodType];

interface ExternalVariable {
  name: string;
  kind: Kind;
  readBy?: string;
  description: string;
  default?: string;
  onError?: string;
  example?: string;
  envFile?: Placement;
  envFileSection?: string;
}

interface Section {
  id: string;
  title: string;
  preamble: string[];
}

const ENV_EXAMPLE_FILE = ".env.example";
const GENERATOR_FILE = "scripts/env-sync.ts";

const CONFIGURATION_PAGE =
  "apps/fumadocs/content/docs/next/self-hosting/configuration.mdx";

const REPOSITORY_BLOB = "https://github.com/suiramdev/freenary/blob/main";

const COMPOSE_FILES = [
  "docker-compose.yml",
  "docker-compose.dev.yml",
  "docker-compose.mail.yml",
  "docker-compose.proxy.yml",
];

const SOURCE_GLOBS = [
  "apps/*/src/**/*.{ts,tsx}",
  "apps/*/scripts/**/*.ts",
  "apps/*/*.config.ts",
  "packages/*/src/**/*.ts",
  "packages/*/scripts/**/*.ts",
  "packages/*/*.config.ts",
  "scripts/**/*.ts",
];

const SOURCE_EXCLUDED = /\/(?:node_modules|dist|paraglide|routeTree\.gen)\//u;

const ENV_READ =
  /(?:process|Bun)\.env(?:\.(?<dot>[A-Z][A-Z0-9_]*)|\[["'](?<bracket>[A-Z][A-Z0-9_]*)["']\])/gu;

const COMPOSE_INTERPOLATION = /\$\{(?<name>[A-Z][A-Z0-9_]*)/gu;

const MARKER =
  /\{\/\* env-sync:start (?<id>[a-z-]+) \*\/\}[\s\S]*?\{\/\* env-sync:end \*\/\}/gu;

const TABLE_CELL_PIPE = /\|/gu;
const BLANK_RUN = /\n{3,}/gu;
const YAML_FILE = /\.ya?ml$/u;
const PLATFORM_PREFIX = "VERCEL_";

const SECTIONS: Section[] = [
  {
    id: "core",
    preamble: [
      "The two values below are development values. A real instance replaces both;",
      "`docker compose up` refuses to start with either one empty.",
      "  openssl rand -hex 16   # database password",
      "  openssl rand -hex 32   # BETTER_AUTH_SECRET, 32 characters or more",
    ],
    title: "Core and secrets",
  },
  {
    id: "origins",
    preamble: [
      "The origins a browser reaches. Both default to localhost outside production,",
      "which works on the machine that runs the stack and nowhere else. Set both for",
      "any other host, with `https://` once TLS sits in front.",
    ],
    title: "Public origins and cookies",
  },
  { id: "database", preamble: [], title: "Database" },
  {
    id: "email",
    preamble: [
      "Email delivery — one-time codes, address confirmation and password reset.",
      "With no provider Freenary hides those flows instead of offering them.",
      "For development, `bun run dev:mail` starts a Mailpit inbox and needs no",
      "mail account.",
    ],
    title: "Email",
  },
  {
    id: "sign-in",
    preamble: [
      "Sign-in providers — each optional and inert while unset, so a deployment that",
      "configures none of them shows none of the buttons.",
      "Google: https://console.cloud.google.com/apis/credentials",
      "  Redirect URI: $BETTER_AUTH_URL/api/auth/callback/google",
      "Apple: https://developer.apple.com/account/resources/identifiers",
      "  Redirect URI: $BETTER_AUTH_URL/api/auth/callback/apple",
      "Any OpenID Connect provider (Authentik, Keycloak, Zitadel, Entra, …).",
      "  Redirect URI: $BETTER_AUTH_URL/api/auth/callback/oidc",
    ],
    title: "Sign-in",
  },
  {
    id: "bank",
    preamble: [
      "Bank provider — leave every value unset to skip the bank-connection step.",
      "Powens: create a domain and a client application at https://console.powens.com,",
      "whitelist https://<web origin>/callback/powens as a redirect URL of that client.",
      "Enable Banking: register an app at https://enablebanking.com and download the",
      "private key .pem file. It needs BANKING_PROVIDER=enable-banking.",
    ],
    title: "Bank providers",
  },
  {
    id: "assistant",
    preamble: [
      "AI assistant — optional. Any OpenAI-compatible chat-completions endpoint: a",
      "gateway (OpenRouter, Groq), OpenAI itself, or a local runtime (Ollama, vLLM).",
      "Set, it is the default in the model picker on Home; the picker always also",
      "offers models that run in the reader's own browser (WebGPU).",
    ],
    title: "Assistant",
  },
  {
    id: "categorisation",
    preamble: [
      "Transaction classifier — optional. It sends a normalised descriptor, merchant",
      "and payment facts (never an amount, date, IBAN or account) to the endpoint of",
      "TRANSACTION_CLASSIFIER, and to the TRANSACTION_CLASSIFIER_FALLBACK endpoint",
      "when that answer is weak. Answers are cached per merchant and per model, so a",
      "merchant is asked about once. Each slot names a protocol and its own URL:",
      "`system-one` (TypeSafe Jev, Mapika/decider-2b, Laya), `llm` (any",
      "OpenAI-compatible endpoint, local or a gateway) or `zero-shot` (Hugging Face).",
      "A URL on your own hardware keeps the descriptors on it, which is the",
      "recommendation, not a requirement.",
      "DICTIONARY_PUBLIC_KEY is the Ed25519 public key PEM from: bun run generate:key",
    ],
    title: "Categorisation",
  },
];

const EXTERNAL: ExternalVariable[] = [
  {
    default: "none",
    description:
      "The database password. It fills both the container password and the `DATABASE_URL` of `migrate` and `server`.",
    envFile: "required",
    envFileSection: "core",
    example: "password",
    kind: "compose",
    name: "POSTGRES_PASSWORD",
    onError: "Compose refuses an unset or empty value.",
  },
  {
    default: "`latest`",
    description: "The tag of both published images.",
    envFile: "required",
    envFileSection: "images",
    example: "latest",
    kind: "compose",
    name: "FREENARY_VERSION",
    onError:
      "An unset value falls back to `latest`, the newest release. A value that names no tag fails the pull with `not found`. The tags are `X.Y.Z`, `X.Y`, `X`, `latest`, `main`, `dev` and `sha-<7 characters>`.",
  },
  {
    default: "`3000`",
    description: "The host port of the API server.",
    envFile: "commented",
    envFileSection: "images",
    example: "3000",
    kind: "compose",
    name: "SERVER_PORT",
  },
  {
    default: "`3001`",
    description: "The host port of the web app.",
    envFile: "commented",
    envFileSection: "images",
    example: "3001",
    kind: "compose",
    name: "WEB_PORT",
  },
  {
    default: "`5432`",
    description:
      "The host port of PostgreSQL. Compose publishes `127.0.0.1:<POSTGRES_PORT>:5432`, so the loopback interface alone gets it.",
    envFile: "commented",
    envFileSection: "images",
    example: "5432",
    kind: "compose",
    name: "POSTGRES_PORT",
  },
  {
    default: "the git branch, else the directory name, else `dev`",
    description:
      "Names the Compose project and every hostname of one worktree stack. It reaches Compose through the `-p` flag.",
    envFile: "none",
    kind: "compose-dev",
    name: "FREENARY_SLUG",
  },
  {
    default: "`server.<slug>.freenary.localhost`",
    description: "The API server hostname. It fills `BETTER_AUTH_URL`.",
    envFile: "commented",
    envFileSection: "development",
    example: "server.freenary.localhost",
    kind: "compose-dev",
    name: "SERVER_HOST",
  },
  {
    default: "`web.<slug>.freenary.localhost`",
    description: "The web app hostname. It fills `CORS_ORIGIN`.",
    envFile: "commented",
    envFileSection: "development",
    example: "web.freenary.localhost",
    kind: "compose-dev",
    name: "WEB_HOST",
  },
  {
    default: "`docs.<slug>.freenary.localhost`",
    description: "The documentation hostname, in the Traefik route alone.",
    envFile: "commented",
    envFileSection: "development",
    example: "docs.freenary.localhost",
    kind: "compose-dev",
    name: "DOCS_HOST",
  },
  {
    default: "`mail.<slug>.freenary.localhost`",
    description:
      "The Mailpit inbox hostname, in the Traefik route alone. It applies to `bun run dev:mail`.",
    envFile: "commented",
    envFileSection: "development",
    example: "mail.freenary.localhost",
    kind: "compose-dev",
    name: "MAIL_HOST",
  },
  {
    default: "`4000`",
    description: "The documentation port inside its own container.",
    envFile: "none",
    kind: "compose-dev",
    name: "DOCS_PORT",
  },
  {
    description:
      "The address the web and documentation dev servers print in place of their container address. Compose sets it from `WEB_HOST` and `DOCS_HOST`.",
    envFile: "none",
    kind: "raw",
    name: "DEV_PUBLIC_URL",
    readBy: "the web and documentation dev servers",
  },
  {
    description:
      'The API origin the web app hands to the browser in the root document. Compose sets it from `BETTER_AUTH_URL`. A value that is not an absolute URL throws `PUBLIC_SERVER_URL must be an absolute URL such as https://api.example.com, got "…"`.',
    envFile: "none",
    kind: "raw",
    name: "PUBLIC_SERVER_URL",
    readBy: "the web app, per request",
  },
  {
    description:
      "The origin the web app itself calls while it renders a page. It wins over `PUBLIC_SERVER_URL` there. Compose sets `http://server:3000`.",
    envFile: "none",
    kind: "raw",
    name: "SERVER_URL",
    readBy: "the web app, on the server side",
  },
  {
    description:
      "Any non-empty value turns the whole server schema off. The image sets it in the builder stage alone.",
    envFile: "none",
    kind: "raw",
    name: "SKIP_ENV_VALIDATION",
    readBy: "the API server",
  },
  {
    description:
      "Which repository the merchant data release comes from. The default is `suiramdev/freenary`.",
    envFile: "none",
    kind: "raw",
    name: "GITHUB_REPOSITORY",
    readBy: "the server image build",
  },
  {
    description:
      "It lifts the GitHub API rate limit of that download. The build reads it as a BuildKit secret, so the value never enters a layer.",
    envFile: "none",
    kind: "raw",
    name: "GITHUB_TOKEN",
    readBy: "the server image build",
  },
  {
    description:
      "The OpenRouter key behind the `Ask AI` panel of the documentation site. That app carries no workspace dependency, so it declares no schema.",
    envFile: "none",
    kind: "raw",
    name: "OPENROUTER_API_KEY",
    readBy: "the documentation site",
  },
  {
    description:
      "The model that panel asks. The site carries its own default, so the value is optional.",
    envFile: "none",
    kind: "raw",
    name: "OPENROUTER_MODEL",
    readBy: "the documentation site",
  },
  {
    description:
      "The production compose file hard-codes the database name `freenary`. The development stack does read the variable.",
    envFile: "none",
    kind: "inert",
    name: "POSTGRES_DB",
  },
  {
    description:
      "The production compose file hard-codes the user `postgres`. The development stack does read the variable.",
    envFile: "none",
    kind: "inert",
    name: "POSTGRES_USER",
  },
];

const failures: string[] = [];

const fail = (message: string): void => {
  failures.push(message);
};

const schemaEntries: SchemaEntry[] = Object.entries(serverEnvSchema);
const clientEntries: SchemaEntry[] = Object.entries(clientEnvSchema);

const declared = new Set([
  ...schemaEntries.map(([name]) => name),
  ...clientEntries.map(([name]) => name),
  ...EXTERNAL.map((entry) => entry.name),
]);

const defaultOf = (schema: z.ZodType): string | undefined => {
  const declaredDefault = schema.meta()?.default;

  if (declaredDefault !== undefined) {
    return declaredDefault;
  }

  return schema instanceof z.ZodDefault
    ? `\`${String(schema.def.defaultValue)}\``
    : undefined;
};

const escapeCell = (value: string): string =>
  value.replace(TABLE_CELL_PIPE, "\\|");

const describedOrFail = ([name, schema]: SchemaEntry): string => {
  const { description } = schema;

  if (description === undefined || description.length === 0) {
    fail(
      `${name}: no .describe(). One sentence, which the generator prints in ${ENV_EXAMPLE_FILE} and in the configuration reference.`
    );

    return "";
  }

  return description;
};

const defaultCell = (schema: z.ZodType): string => {
  const value = defaultOf(schema);

  if (value === undefined) {
    return "unset";
  }

  return schema.meta()?.productionRequired === true
    ? `${value} outside production, required in production`
    : value;
};

const entriesOfSection = (id: string): SchemaEntry[] =>
  schemaEntries.filter(([, schema]) => schema.meta()?.section === id);

const externalOfKind = (kind: Kind): ExternalVariable[] =>
  EXTERNAL.filter((entry) => entry.kind === kind);

const table = (header: string[], rows: string[]): string =>
  [
    `| ${header.join(" | ")} |`,
    `| ${header.map(() => "---").join(" | ")} |`,
    ...rows,
  ].join("\n");

const schemaTable = (id: string): string =>
  table(
    ["Variable", "Default", "What it does", "Absent or wrong"],
    entriesOfSection(id).map((entry) => {
      const [name, schema] = entry;
      const onError = schema.meta()?.onError;

      if (onError === undefined) {
        fail(
          `${name}: no onError in .meta(); the reference needs that column.`
        );
      }

      return `| \`${name}\` | ${defaultCell(schema)} | ${escapeCell(describedOrFail(entry))} | ${escapeCell(onError ?? "")} |`;
    })
  );

const externalTable = (kind: Kind, header: string[]): string =>
  table(
    header,
    externalOfKind(kind).map((entry) => {
      const cells =
        kind === "raw"
          ? [entry.readBy ?? "", escapeCell(entry.description)]
          : [entry.default ?? "unset", escapeCell(entry.description)];

      return header.length === 4
        ? `| \`${entry.name}\` | ${cells.join(" | ")} | ${escapeCell(entry.onError ?? "—")} |`
        : `| \`${entry.name}\` | ${cells.join(" | ")} |`;
    })
  );

const BLOCKS = {
  assistant: () => schemaTable("assistant"),
  bank: () => schemaTable("bank"),
  categorisation: () => schemaTable("categorisation"),
  client: () =>
    table(
      ["Variable", "Default", "What it does"],
      clientEntries.map(
        ([name, schema]) =>
          `| \`${name}\` | ${defaultOf(schema) ?? "none"} | ${escapeCell(describedOrFail([name, schema]))} |`
      )
    ),
  compose: () =>
    externalTable("compose", [
      "Variable",
      "Default",
      "What it does",
      "Absent or wrong",
    ]),
  "compose-dev": () =>
    externalTable("compose-dev", ["Variable", "Default", "What it does"]),
  core: () => schemaTable("core"),
  count: () =>
    `The API server checks its environment once, at startup. The schema is [\`packages/env/src/schema.ts\`](${REPOSITORY_BLOB}/packages/env/src/schema.ts). It declares ${schemaEntries.length} variables with Zod, and \`packages/env/src/server.ts\` hands them to \`@t3-oss/env-core\`. The reference below, and \`${ENV_EXAMPLE_FILE}\`, are generated from that one file.`,
  database: () => schemaTable("database"),
  email: () => schemaTable("email"),
  inert: () =>
    table(
      ["Variable", "Why it does nothing"],
      externalOfKind("inert").map(
        (entry) => `| \`${entry.name}\` | ${escapeCell(entry.description)} |`
      )
    ),
  origins: () => schemaTable("origins"),
  raw: () => externalTable("raw", ["Variable", "Read by", "What it does"]),
  "sign-in": () => schemaTable("sign-in"),
} satisfies Record<string, () => string>;

const BLOCK_BY_ID = new Map<string, () => string>(Object.entries(BLOCKS));

const envFileEntry = (
  name: string,
  description: string,
  example: string,
  placement: Placement
): string[] => [
  `# ${description}`,
  `${placement === "required" ? "" : "# "}${name}=${example}`,
];

const externalEnvFileLines = (section: string): string[] =>
  EXTERNAL.filter(
    (entry) => entry.envFileSection === section && entry.envFile !== "none"
  ).flatMap((entry) =>
    envFileEntry(
      entry.name,
      entry.description,
      entry.example ?? "",
      entry.envFile ?? "commented"
    )
  );

const sectionEnvFileLines = (section: Section): string[] => {
  const lines: string[] = [
    `# --- ${section.title} ---`,
    ...section.preamble.map((line) => `# ${line}`),
    "",
    ...(section.id === "core" ? externalEnvFileLines("core") : []),
  ];

  for (const entry of entriesOfSection(section.id)) {
    const [name, schema] = entry;
    const meta = schema.meta();
    const placement = meta?.envFile ?? "commented";

    if (placement === "none") {
      continue;
    }

    if (meta?.example === undefined) {
      fail(`${name}: no example in .meta(); ${ENV_EXAMPLE_FILE} needs one.`);
    }

    lines.push(
      ...envFileEntry(
        name,
        describedOrFail(entry),
        meta?.example ?? "",
        placement
      )
    );
  }

  lines.push("");

  return lines;
};

const envExampleBody = (): string => {
  const lines = [
    `# Generated by \`bun run env:sync\` from packages/env/src/schema.ts. Do not edit.`,
    "#",
    "# Copy this file to `.env`. `docker-compose.yml` reads every line of it, and",
    "# the development stack reads it too, through an optional `env_file`.",
    "",
    ...SECTIONS.flatMap(sectionEnvFileLines),
    "# --- Images and host ports ---",
    "",
    ...externalEnvFileLines("images"),
    "",
    "# --- Development only ---",
    "",
    ...externalEnvFileLines("development"),
  ];

  return `${lines.join("\n").replaceAll(BLANK_RUN, "\n\n").trimEnd()}\n`;
};

const renderPage = (source: string): string =>
  source.replaceAll(MARKER, (match: string, id: string): string => {
    const block = BLOCK_BY_ID.get(id);

    if (block === undefined) {
      fail(`${CONFIGURATION_PAGE}: no generator for the block "${id}".`);

      return match;
    }

    return `{/* env-sync:start ${id} */}\n\n${block()}\n\n{/* env-sync:end */}`;
  });

const readSources = async (): Promise<Map<string, string>> => {
  const paths = new Set(COMPOSE_FILES);

  for (const pattern of SOURCE_GLOBS) {
    for (const file of new Glob(pattern).scanSync(".")) {
      if (!(SOURCE_EXCLUDED.test(`/${file}/`) || file === GENERATOR_FILE)) {
        paths.add(file);
      }
    }
  }

  const ordered = [...paths];
  const contents = await Promise.all(
    ordered.map((file) => Bun.file(file).text())
  );

  return new Map(ordered.map((file, index) => [file, contents[index] ?? ""]));
};

const auditSources = (sources: Map<string, string>): void => {
  for (const [file, contents] of sources) {
    const matches = YAML_FILE.test(file)
      ? contents.matchAll(COMPOSE_INTERPOLATION)
      : contents.matchAll(ENV_READ);

    for (const match of matches) {
      const name =
        match.groups?.dot ?? match.groups?.bracket ?? match.groups?.name;

      if (
        name !== undefined &&
        !(declared.has(name) || name.startsWith(PLATFORM_PREFIX))
      ) {
        fail(
          `${file}: reads ${name} from the environment, and nothing declares it. Add it to packages/env/src/schema.ts, or to EXTERNAL in ${GENERATOR_FILE} with the reason it stays raw.`
        );
      }
    }
  }

  for (const entry of EXTERNAL) {
    const mentioned = [...sources.values()].some((contents) =>
      contents.includes(entry.name)
    );

    if (entry.kind !== "inert" && !mentioned) {
      fail(
        `${entry.name}: declared in ${GENERATOR_FILE}, and no source or compose file uses it. Remove it, or mark it inert.`
      );
    }
  }
};

const sync = async (
  file: string,
  contents: string,
  checkOnly: boolean
): Promise<boolean> => {
  const current = await Bun.file(file).text();

  if (current === contents) {
    return false;
  }

  if (checkOnly) {
    fail(`${file}: stale. Run \`bun run env:sync\`.`);

    return false;
  }

  await Bun.write(file, contents);

  return true;
};

const main = async (): Promise<number> => {
  const checkOnly = process.argv.includes("--check");
  const page = await Bun.file(CONFIGURATION_PAGE).text();
  const nextPage = renderPage(page);
  const nextExample = envExampleBody();

  const sources = await readSources();

  auditSources(sources);

  const outcomes = await Promise.all([
    sync(ENV_EXAMPLE_FILE, nextExample, checkOnly).then((changed) =>
      changed ? ENV_EXAMPLE_FILE : null
    ),
    sync(CONFIGURATION_PAGE, nextPage, checkOnly).then((changed) =>
      changed ? CONFIGURATION_PAGE : null
    ),
  ]);

  const written = outcomes.filter((file) => file !== null);

  for (const message of new Set(failures)) {
    process.stderr.write(`env-sync: ${message}\n`);
  }

  if (failures.length > 0) {
    return 1;
  }

  process.stdout.write(
    written.length > 0
      ? `env-sync: wrote ${written.join(", ")}\n`
      : `env-sync: ${schemaEntries.length} declared variables, both artifacts current\n`
  );

  return 0;
};

process.exitCode = await main();
