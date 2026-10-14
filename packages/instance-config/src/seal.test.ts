import { describe, expect, test } from "bun:test";

import { Result } from "effect";

import { seal, unseal } from "./seal";

const SECRET = "a-secret-that-is-at-least-32-characters";
const OTHER_SECRET = "another-secret-of-at-least-32-characters";

describe("seal", () => {
  test("opens a value it sealed", () => {
    const sealed = seal(SECRET, "SMTP_HOST", "smtp.example.com");

    expect(Result.getOrThrow(unseal(SECRET, "SMTP_HOST", sealed))).toBe(
      "smtp.example.com"
    );
  });

  test("hides the plaintext", () => {
    const sealed = seal(SECRET, "SMTP_HOST", "smtp.example.com");

    expect(sealed).not.toContain("smtp.example.com");
  });

  test("gives a different ciphertext each time", () => {
    const first = seal(SECRET, "SMTP_HOST", "smtp.example.com");
    const second = seal(SECRET, "SMTP_HOST", "smtp.example.com");

    expect(first).not.toBe(second);
  });

  test("refuses a value sealed under another secret", () => {
    const sealed = seal(OTHER_SECRET, "SMTP_HOST", "smtp.example.com");

    expect(Result.isFailure(unseal(SECRET, "SMTP_HOST", sealed))).toBe(true);
  });

  test("refuses a value moved to another key", () => {
    const sealed = seal(SECRET, "SMTP_PASSWORD", "hunter2");

    expect(Result.isFailure(unseal(SECRET, "SMTP_USER", sealed))).toBe(true);
  });

  test("refuses a tampered ciphertext", () => {
    const sealed = seal(SECRET, "SMTP_HOST", "smtp.example.com");
    const tampered = `${sealed.slice(0, -2)}${sealed.endsWith("aa") ? "bb" : "aa"}`;

    expect(Result.isFailure(unseal(SECRET, "SMTP_HOST", tampered))).toBe(true);
  });

  test("refuses a value that is not sealed at all", () => {
    expect(Result.isFailure(unseal(SECRET, "SMTP_HOST", "plain"))).toBe(true);
  });

  test("carries a multi-line PEM through unchanged", () => {
    const pem =
      "-----BEGIN PRIVATE KEY-----\nMIIEvQ==\n-----END PRIVATE KEY-----";

    const sealed = seal(SECRET, "ENABLE_BANKING_PRIVATE_KEY", pem);

    expect(
      Result.getOrThrow(unseal(SECRET, "ENABLE_BANKING_PRIVATE_KEY", sealed))
    ).toBe(pem);
  });
});
