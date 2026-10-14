import { describe, expect, test } from "bun:test";

import type { Integration } from "@freenary/instance-config/integrations";
import {
  findIntegration,
  findVariant,
} from "@freenary/instance-config/integrations";
import { Option } from "effect";

import type { OwnedByEnvironment } from "./merge";
import {
  candidateOf,
  environmentVariantOf,
  isWhollyOwnedByEnvironment,
  missingKeysOf,
  writesOf,
} from "./merge";

const email: Integration = Option.getOrThrow(findIntegration("email"));
const banking: Integration = Option.getOrThrow(findIntegration("banking"));

const variantOf = (integration: Integration, id: string) =>
  Option.getOrThrow(findVariant(integration, id));

const smtp = variantOf(email, "smtp");
const resend = variantOf(email, "resend");
const emailOff = variantOf(email, "disabled");
const powens = variantOf(banking, "powens");

const nothingOwned: OwnedByEnvironment = () => false;

const ownedKeys =
  (...keys: string[]): OwnedByEnvironment =>
  (key) =>
    keys.includes(key);

const SMTP_FORM = {
  EMAIL_FROM: "Freenary <no-reply@example.test>",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
};

describe("candidateOf", () => {
  test("writes the discriminant of the chosen variant", () => {
    const candidate = candidateOf(email, smtp, SMTP_FORM, {}, nothingOwned);

    expect(candidate.EMAIL_PROVIDER).toBe("smtp");
  });

  test("clears the discriminant for the disabled variant", () => {
    const candidate = candidateOf(
      email,
      emailOff,
      {},
      {
        EMAIL_FROM: "old@example.test",
        EMAIL_PROVIDER: "smtp",
      },
      nothingOwned
    );

    expect(candidate.EMAIL_PROVIDER).toBeUndefined();
  });

  test("keeps a stored secret when its field is left empty", () => {
    const candidate = candidateOf(
      email,
      smtp,
      { ...SMTP_FORM, SMTP_PASSWORD: "" },
      { SMTP_PASSWORD: "kept-secret" },
      nothingOwned
    );

    expect(candidate.SMTP_PASSWORD).toBe("kept-secret");
  });

  test("replaces a stored secret when its field is filled in", () => {
    const candidate = candidateOf(
      email,
      smtp,
      { ...SMTP_FORM, SMTP_PASSWORD: "new-secret" },
      { SMTP_PASSWORD: "kept-secret" },
      nothingOwned
    );

    expect(candidate.SMTP_PASSWORD).toBe("new-secret");
  });

  test("drops a non-secret field that is left empty", () => {
    const candidate = candidateOf(
      email,
      smtp,
      { ...SMTP_FORM, SMTP_USER: "" },
      { SMTP_USER: "old-user" },
      nothingOwned
    );

    expect(candidate.SMTP_USER).toBeUndefined();
  });

  test("drops the secrets of the variant the operator moved away from", () => {
    const candidate = candidateOf(
      email,
      resend,
      {
        EMAIL_FROM: "a@example.test",
        RESEND_API_KEY: "re_key",
      },
      { SMTP_HOST: "smtp.example.com", SMTP_PASSWORD: "kept-secret" },
      nothingOwned
    );

    expect(candidate.SMTP_PASSWORD).toBeUndefined();
  });

  test("leaves the settings of another integration alone", () => {
    const candidate = candidateOf(
      email,
      smtp,
      SMTP_FORM,
      { POWENS_CLIENT_SECRET: "powens-secret" },
      nothingOwned
    );

    expect(candidate.POWENS_CLIENT_SECRET).toBe("powens-secret");
  });

  test("trims a value the operator pasted with spaces", () => {
    const candidate = candidateOf(
      banking,
      powens,
      {
        POWENS_CLIENT_ID: " 1234 ",
        POWENS_CLIENT_SECRET: "secret",
        POWENS_DOMAIN: "acme-sandbox",
      },
      {},
      nothingOwned
    );

    expect(candidate.POWENS_CLIENT_ID).toBe("1234");
  });
});

describe("writesOf", () => {
  test("deletes every key of the integration the candidate does not hold", () => {
    const writes = writesOf(
      email,
      { EMAIL_FROM: "a@example.test" },
      nothingOwned
    );

    expect(writes.get("SMTP_PASSWORD")).toBeNull();
  });

  test("touches no key outside the integration", () => {
    const writes = writesOf(email, { POWENS_DOMAIN: "acme" }, nothingOwned);

    expect(writes.has("POWENS_DOMAIN")).toBe(false);
  });

  test("never writes a key the environment owns", () => {
    const writes = writesOf(
      email,
      { EMAIL_FROM: "a@example.test", RESEND_API_KEY: "re_key" },
      ownedKeys("EMAIL_FROM")
    );

    expect(writes.has("EMAIL_FROM")).toBe(false);
    expect(writes.get("RESEND_API_KEY")).toBe("re_key");
  });
});

describe("environment ownership", () => {
  test("keeps a value the environment owns out of the candidate", () => {
    const candidate = candidateOf(
      email,
      resend,
      { EMAIL_FROM: "…", RESEND_API_KEY: "re_key" },
      {},
      ownedKeys("EMAIL_FROM")
    );

    expect(candidate.EMAIL_FROM).toBeUndefined();
    expect(candidate.RESEND_API_KEY).toBe("re_key");
  });

  test("leaves the discriminant to the environment that sets it", () => {
    const candidate = candidateOf(
      banking,
      powens,
      {},
      {},
      ownedKeys("BANKING_PROVIDER")
    );

    expect(candidate.BANKING_PROVIDER).toBeUndefined();
  });

  test("counts a required field the environment sets as filled", () => {
    const missing = missingKeysOf(
      powens,
      { POWENS_CLIENT_SECRET: "secret" },
      ownedKeys("POWENS_DOMAIN", "POWENS_CLIENT_ID")
    );

    expect(missing).toEqual([]);
  });

  test("reports a required field that nothing fills", () => {
    const missing = missingKeysOf(resend, {}, ownedKeys("EMAIL_FROM"));

    expect(missing).toEqual(["RESEND_API_KEY"]);
  });

  test("sees a variant the environment sets in full", () => {
    const owned = ownedKeys(
      "BANKING_PROVIDER",
      "POWENS_DOMAIN",
      "POWENS_CLIENT_ID",
      "POWENS_CLIENT_SECRET"
    );

    expect(isWhollyOwnedByEnvironment(banking, powens, owned)).toBe(true);
  });

  test("sees a variant with one field left to the screen", () => {
    const owned = ownedKeys("BANKING_PROVIDER", "POWENS_DOMAIN");

    expect(isWhollyOwnedByEnvironment(banking, powens, owned)).toBe(false);
  });
});

describe("environmentVariantOf", () => {
  const powensFields = ownedKeys(
    "POWENS_DOMAIN",
    "POWENS_CLIENT_ID",
    "POWENS_CLIENT_SECRET"
  );

  test("finds the default provider when the environment holds its fields", () => {
    const found = environmentVariantOf(
      banking,
      undefined,
      "powens",
      powensFields
    );

    expect(found?.id).toBe("powens");
  });

  test("finds the provider the environment names", () => {
    const found = environmentVariantOf(
      banking,
      undefined,
      "powens",
      ownedKeys(
        "BANKING_PROVIDER",
        "POWENS_DOMAIN",
        "POWENS_CLIENT_ID",
        "POWENS_CLIENT_SECRET"
      )
    );

    expect(found?.id).toBe("powens");
  });

  test("defers to a provider saved in the app", () => {
    const found = environmentVariantOf(
      banking,
      "enable-banking",
      "powens",
      powensFields
    );

    expect(found).toBeNull();
  });

  test("ignores a provider with a required field left to the app", () => {
    const found = environmentVariantOf(
      banking,
      undefined,
      "powens",
      ownedKeys("POWENS_DOMAIN")
    );

    expect(found).toBeNull();
  });

  test("finds nothing when no provider is in force", () => {
    const found = environmentVariantOf(
      email,
      undefined,
      undefined,
      ownedKeys("EMAIL_FROM")
    );

    expect(found).toBeNull();
  });
});
