import { describe, expect, it } from "bun:test";

import { z } from "zod";

import { serverEnvSchema } from "./schema";

const timeout = serverEnvSchema.TRANSACTION_CLASSIFIER_TIMEOUT_MS;

describe("TRANSACTION_CLASSIFIER_TIMEOUT_MS", () => {
  it("waits 10 seconds when unset", () => {
    expect(
      z.object({ TRANSACTION_CLASSIFIER_TIMEOUT_MS: timeout }).parse({})
    ).toEqual({ TRANSACTION_CLASSIFIER_TIMEOUT_MS: 10_000 });
  });

  it("reads a longer limit for a slow local model", () => {
    expect(timeout.parse("30000")).toBe(30_000);
  });

  it("accepts the bounds of its range", () => {
    expect(timeout.parse("1000")).toBe(1000);
    expect(timeout.parse("120000")).toBe(120_000);
  });

  it("refuses a value outside 1000 to 120000, or not a whole number", () => {
    for (const refused of ["999", "120001", "1500.5", "ten"]) {
      expect(timeout.safeParse(refused).success).toBe(false);
    }
  });
});

const DEVELOPMENT_AUTH_SECRET = "dev_secret_change_me_at_least_32chars";

const outputOf = ({ stdout, stderr }: Bun.SyncSubprocess<"pipe", "pipe">) =>
  `${stdout.toString().trim()}${stderr.toString().trim()}`;

const parseSecretUnder = (nodeEnv: string, secret: string) =>
  outputOf(
    Bun.spawnSync(
      [
        process.execPath,
        "-e",
        `const { serverEnvSchema } = await import("./schema.ts");
       const result = serverEnvSchema.BETTER_AUTH_SECRET.safeParse(${JSON.stringify(secret)});
       console.log(result.success ? "accepted" : result.error.issues[0].message);`,
      ],
      { cwd: import.meta.dir, env: { ...process.env, NODE_ENV: nodeEnv } }
    )
  );

describe("BETTER_AUTH_SECRET", () => {
  it("refuses the development secret in production", () => {
    expect(parseSecretUnder("production", DEVELOPMENT_AUTH_SECRET)).toContain(
      "the development secret is public and is refused in production"
    );
  });

  it("accepts a generated secret in production", () => {
    expect(parseSecretUnder("production", "a".repeat(64))).toBe("accepted");
  });

  it("keeps the development secret outside production", () => {
    expect(parseSecretUnder("development", DEVELOPMENT_AUTH_SECRET)).toBe(
      "accepted"
    );
  });
});
