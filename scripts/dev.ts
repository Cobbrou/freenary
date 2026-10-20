import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

import { Option } from "effect";

import { deriveDevIdentity } from "./dev-identity";

const DEV_COMPOSE_FILE = "docker-compose.dev.yml";
const MAIL_COMPOSE_FILE = "docker-compose.mail.yml";
const PROXY_COMPOSE_FILE = "docker-compose.proxy.yml";
const PROXY_NETWORK = "devproxy";
const PROXY_SUBNET = "172.30.0.0/16";
const PROXY_HOST_PORT = "80";
const MAIL_FLAG = "--mail";
const WORKTREE_ENV_FILE = ".env";
const DETACHED_HEAD_REF = "HEAD";
const RESET_VERB = "reset";
const SPAWN_FAILURE_EXIT_CODE = 1;

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

const dockerLines = (args: string[]): string[] | null => {
  const listed = spawnSync("docker", args, { encoding: "utf-8" });

  return listed.status === 0
    ? listed.stdout.split("\n").filter((line) => line.trim().length > 0)
    : null;
};

const runningOnPort = (extraFilters: string[]): string[] =>
  dockerLines([
    "ps",
    "--filter",
    `publish=${PROXY_HOST_PORT}`,
    "--filter",
    "status=running",
    ...extraFilters,
    "--format",
    "{{.Names}}",
  ]) ?? [];

const ensureProxyNetwork = (): boolean => {
  const exists = dockerLines(["network", "inspect", PROXY_NETWORK]) !== null;

  if (exists) {
    return true;
  }

  process.stdout.write(
    `[freenary dev] creating network ${PROXY_NETWORK} (${PROXY_SUBNET})\n`
  );

  const createdOnSharedSubnet =
    dockerLines([
      "network",
      "create",
      "--subnet",
      PROXY_SUBNET,
      PROXY_NETWORK,
    ]) !== null;

  return (
    createdOnSharedSubnet ||
    dockerLines(["network", "create", PROXY_NETWORK]) !== null
  );
};

const ensureProxy = (env: typeof process.env): number => {
  if (!ensureProxyNetwork()) {
    process.stderr.write(
      `[freenary dev] could not create the ${PROXY_NETWORK} network. Is Docker running?\n`
    );

    return SPAWN_FAILURE_EXIT_CODE;
  }

  const [sharedProxy] = runningOnPort(["--filter", `network=${PROXY_NETWORK}`]);

  if (sharedProxy) {
    process.stdout.write(`  proxy   ${sharedProxy} (shared)\n`);

    return 0;
  }

  const [portHolder] = runningOnPort([]);

  if (portHolder) {
    process.stderr.write(
      `[freenary dev] container ${portHolder} holds port ${PROXY_HOST_PORT} and is not on the ${PROXY_NETWORK} network, so it cannot route this stack. Stop it, or attach it with: docker network connect ${PROXY_NETWORK} ${portHolder}\n`
    );

    return SPAWN_FAILURE_EXIT_CODE;
  }

  process.stdout.write(`  proxy   starting ${PROXY_COMPOSE_FILE}\n`);

  return compose(["-f", PROXY_COMPOSE_FILE, "up", "-d"], env);
};

const main = (): number => {
  const argv = process.argv.slice(2);
  const withMail = argv.includes(MAIL_FLAG);
  const rest = argv.filter((argument) => argument !== MAIL_FLAG);
  const identity = deriveDevIdentity({
    branch: readBranch(),
    dir: path.basename(process.cwd()),
    slugOverride: readEnvOverride("FREENARY_SLUG"),
  });

  const env = {
    ...process.env,
    AUTH_COOKIE_DOMAIN:
      readEnvOverride("AUTH_COOKIE_DOMAIN") ?? identity.cookieDomain,
    DOCS_HOST: identity.docsHost,
    FREENARY_SLUG: identity.slug,
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
  ];

  process.stdout.write(
    `[freenary dev] worktree "${identity.slug}"\n  web     ${identity.corsOrigin}\n  server  ${identity.betterAuthUrl}\n  docs    ${identity.docsUrl}\n${withMail ? `  mail    ${identity.mailUrl}\n` : ""}  project ${identity.composeProjectName}\n`
  );

  const startsTheStack = STARTING_VERBS[rest[0] ?? ""] === true;
  const proxyStatus = startsTheStack ? ensureProxy(env) : 0;

  if (proxyStatus !== 0) {
    return proxyStatus;
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
