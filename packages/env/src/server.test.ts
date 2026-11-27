import { beforeAll, describe, expect, it } from "bun:test";
import { tmpdir } from "node:os";

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
