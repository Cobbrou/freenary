import { describe, expect, it } from "bun:test";

import { fieldProblem } from "./field-rules";

describe("fieldProblem", () => {
  it("rejects a Powens domain that starts with a scheme", () => {
    expect(
      fieldProblem("POWENS_DOMAIN", "https://acme-sandbox.biapi.pro")
    ).toBe("domain-has-scheme");

    expect(fieldProblem("POWENS_DOMAIN", "HTTP://x")).toBe("domain-has-scheme");
    expect(fieldProblem("POWENS_DOMAIN", "  https://acme-sandbox")).toBe(
      "domain-has-scheme"
    );
  });

  it("accepts a Powens domain name, short or full", () => {
    expect(fieldProblem("POWENS_DOMAIN", "acme-sandbox")).toBeNull();
    expect(fieldProblem("POWENS_DOMAIN", "acme-sandbox.biapi.pro")).toBeNull();
  });

  it("leaves a field with no rule alone", () => {
    expect(fieldProblem("SMTP_HOST", "https://smtp.example.com")).toBeNull();
  });
});
