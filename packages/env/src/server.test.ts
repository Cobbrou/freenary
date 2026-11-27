import { afterAll, beforeAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const server = new URL("server.ts", import.meta.url).href;

const startInChildOutsideRepo = (env: Record<string, string>) =>
  Bun.spawnSync(
    [process.execPath, "-e", `await import(${JSON.stringify(server)})`],
    {
      cwd: tmpdir(),
      env: { PATH: process.env.PATH ?? "", ...env },
    }
  );

describe("server env validation", () => {
  let invalidStart: ReturnType<typeof startInChildOutsideRepo>;
  let skippedStart: ReturnType<typeof startInChildOutsideRepo>;

  beforeAll(() => {
    invalidStart = startInChildOutsideRepo({ BETTER_AUTH_SECRET: "short" });
    skippedStart = startInChildOutsideRepo({
      BETTER_AUTH_SECRET: "short",
      SKIP_ENV_VALIDATION: "1",
    });
  });

  it("names the failing variable, its error and its description, then exits", () => {
    const output = invalidStart.stderr.toString();

    expect(invalidStart.exitCode).toBe(1);
    expect(output).toContain("- BETTER_AUTH_SECRET: ");
    expect(output).toContain("32");
    expect(output).toContain("Signs session cookies");
  });

  it("skips validation under SKIP_ENV_VALIDATION", () => {
    expect(skippedStart.exitCode).toBe(0);
  });
});

describe("server env from files", () => {
  const folder = mkdtempSync(path.join(tmpdir(), "env-server-"));
  const secretFile = path.join(folder, "auth");
  let fileStart: ReturnType<typeof startInChildOutsideRepo>;
  let conflictStart: ReturnType<typeof startInChildOutsideRepo>;

  beforeAll(() => {
    writeFileSync(secretFile, `${"s".repeat(32)}\n`);

    fileStart = startInChildOutsideRepo({
      BETTER_AUTH_SECRET_FILE: secretFile,
    });

    conflictStart = startInChildOutsideRepo({
      BETTER_AUTH_SECRET: "s".repeat(32),
      BETTER_AUTH_SECRET_FILE: secretFile,
    });
  });

  afterAll(() => {
    rmSync(folder, { force: true, recursive: true });
  });

  it("starts with BETTER_AUTH_SECRET read from BETTER_AUTH_SECRET_FILE", () => {
    expect(fileStart.stderr.toString()).not.toContain("BETTER_AUTH_SECRET");
    expect(fileStart.exitCode).toBe(0);
  });

  it("stops when BETTER_AUTH_SECRET and BETTER_AUTH_SECRET_FILE are both set", () => {
    expect(conflictStart.exitCode).toBe(1);
    expect(conflictStart.stderr.toString()).toContain(
      "- BETTER_AUTH_SECRET_FILE: BETTER_AUTH_SECRET is set too."
    );
  });
});
