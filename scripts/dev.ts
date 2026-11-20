import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Option } from "effect";

import { deriveDevIdentity } from "./dev-identity";
import type { DevScheme } from "./dev-identity";

const DEV_COMPOSE_FILE = "docker-compose.dev.yml";
const MAIL_COMPOSE_FILE = "docker-compose.mail.yml";
const MAIL_FLAG = "--mail";
const AI_COMPOSE_FILE = "docker-compose.ai.yml";
const AI_FLAG = "--ai";
const WORKTREE_ENV_FILE = ".env";
const DETACHED_HEAD_REF = "HEAD";
const RESET_VERB = "reset";
const SPAWN_FAILURE_EXIT_CODE = 1;
const KIRI_ENGINE = "Kiri";
const PLATFORM_WITH_KIRI_HTTPS = "darwin";

const SCHEMES: Partial<Record<string, DevScheme>> = {
  http: "http",
  https: "https",
};

const STARTING_VERBS: Partial<Record<string, true>> = {
  [RESET_VERB]: true,
  restart: true,
  run: true,
  start: true,
  up: true,
};

const QUOTE_EDGES = /^["']|["']$/gu;

const readWorktreeEnvFile = Option.liftThrowable((file: string): string =>
  readFileSync(file, "utf-8")
);

const readBranch = (): string | null => {
  const revParse = spawnSync("git", ["rev-parse", "--abbrev-ref", "HEAD"], {
    encoding: "utf-8",
  });

  const ref = revParse.status === 0 ? revParse.stdout.trim() : "";
  const isDetachedHead = ref === DETACHED_HEAD_REF;

  return ref && !isDetachedHead ? ref : null;
};

const readEnvOverride = (key: string): string | null => {
  const shellOverrideWins = process.env[key]?.trim();

  if (shellOverrideWins) {
    return shellOverrideWins;
  }

  const assignment = new RegExp(`^\\s*${key}\\s*=\\s*(?<value>.+?)\\s*$`, "mu");

  return Option.getOrNull(
    readWorktreeEnvFile(WORKTREE_ENV_FILE).pipe(
      Option.flatMapNullishOr(
        (contents) => contents.match(assignment)?.groups?.value
      ),
      Option.map((value) => value.replace(QUOTE_EDGES, "")),
      Option.filter((value) => value.length > 0)
    )
  );
};

const compose = (args: string[], env: typeof process.env): number => {
  const composed = spawnSync("docker", ["compose", ...args], {
    env,
    stdio: "inherit",
  });

  if (composed.error) {
    process.stderr.write(`${composed.error.message}\n`);
  }

  return composed.status ?? SPAWN_FAILURE_EXIT_CODE;
};

const readDockerEngine = (): string | null => {
  const dockerInfo = spawnSync(
    "docker",
    ["info", "--format", "{{.OperatingSystem}}"],
    { encoding: "utf-8" }
  );

  return dockerInfo.status === 0 ? dockerInfo.stdout.trim() : null;
};

const warnUnlessKiri = (): void => {
  const engine = readDockerEngine();

  if (engine === null || engine === KIRI_ENGINE) {
    return;
  }

  process.stderr.write(
    `[freenary dev] Docker runs on ${engine}, not Kiri, so nothing routes these hostnames. Run \`docker context use kiri\`, or route them yourself and set FREENARY_DEV_DOMAIN.\n`
  );
};

const resolveScheme = (): DevScheme | null => {
  const requested = readEnvOverride("FREENARY_DEV_SCHEME");

  if (requested === null) {
    return process.platform === PLATFORM_WITH_KIRI_HTTPS ? "https" : "http";
  }

  return SCHEMES[requested.toLowerCase()] ?? null;
};

const main = (): number => {
  const argv = process.argv.slice(2);
  const withMail = argv.includes(MAIL_FLAG);
  const withAi = argv.includes(AI_FLAG);
  const rest = argv.filter(
    (argument) => argument !== MAIL_FLAG && argument !== AI_FLAG
  );

  const scheme = resolveScheme();

  if (scheme === null) {
    process.stderr.write(
      "[freenary dev] FREENARY_DEV_SCHEME must be http or https.\n"
    );

    return SPAWN_FAILURE_EXIT_CODE;
  }

  const domainOverride = readEnvOverride("FREENARY_DEV_DOMAIN");
  const identity = deriveDevIdentity({
    branch: readBranch(),
    dir: path.basename(process.cwd()),
    domain: domainOverride,
    scheme,
    slugOverride: readEnvOverride("FREENARY_SLUG"),
  });

  const env = {
    ...process.env,
    AUTH_COOKIE_DOMAIN:
      readEnvOverride("AUTH_COOKIE_DOMAIN") ?? identity.cookieDomain,
    DOCS_HOST: identity.docsHost,
    FREENARY_DEV_SCHEME: identity.scheme,
    MAIL_HOST: identity.mailHost,
    SERVER_HOST: identity.serverHost,
    WEB_HOST: identity.webHost,
  };

  const base = [
    "-p",
    identity.composeProjectName,
    "-f",
    DEV_COMPOSE_FILE,
    ...(withMail ? ["-f", MAIL_COMPOSE_FILE] : []),
    ...(withAi ? ["-f", AI_COMPOSE_FILE] : []),
  ];

  process.stdout.write(
    `[freenary dev] worktree "${identity.slug}"\n  web     ${identity.corsOrigin}\n  server  ${identity.betterAuthUrl}\n  docs    ${identity.docsUrl}\n${withMail ? `  mail    ${identity.mailUrl}\n` : ""}${withAi ? `  ai      scripted model, rules in .docker/ai-rules.yaml\n` : ""}  project ${identity.composeProjectName}\n`
  );

  const startsTheStack = STARTING_VERBS[rest[0] ?? ""] === true;

  if (startsTheStack && domainOverride === null) {
    warnUnlessKiri();
  }

  if (rest[0] === RESET_VERB) {
    const downWithVolumes = compose([...base, "down", "-v"], env);

    return downWithVolumes === 0
      ? compose([...base, "up", "--build", "--watch"], env)
      : downWithVolumes;
  }

  return compose([...base, ...rest], env);
};

process.exitCode = main();
