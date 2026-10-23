import { describe, expect, test } from "bun:test";

import type {
  HeldValue,
  Integration,
} from "@freenary/instance-config/integrations";
import {
  findIntegration,
  findVariant,
  recogniseVariant,
} from "@freenary/instance-config/integrations";
import { Option } from "effect";

import type { OwnedByEnvironment } from "./merge";
import {
  candidateOf,
  conflictingPresetsOf,
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

const heldFrom =
  (values: Readonly<Record<string, string>>): HeldValue =>
  (key) =>
    values[key];

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
      {},
      heldFrom({ BANKING_PROVIDER: "powens" }),
      powensFields
    );

    expect(found?.id).toBe("powens");
  });

  test("finds the provider the environment names", () => {
    const found = environmentVariantOf(
      banking,
      {},
      heldFrom({ BANKING_PROVIDER: "powens" }),
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
      { BANKING_PROVIDER: "enable-banking" },
      heldFrom({ BANKING_PROVIDER: "powens" }),
      powensFields
    );

    expect(found).toBeNull();
  });

  test("ignores a provider with a required field left to the app", () => {
    const found = environmentVariantOf(
      banking,
      {},
      heldFrom({ BANKING_PROVIDER: "powens" }),
      ownedKeys("POWENS_DOMAIN")
    );

    expect(found).toBeNull();
  });

  test("finds nothing when no provider is in force", () => {
    const found = environmentVariantOf(
      email,
      {},
      heldFrom({}),
      ownedKeys("EMAIL_FROM")
    );

    expect(found).toBeNull();
  });
});

describe("a classifier with presets", () => {
  const categorisation: Integration = Option.getOrThrow(
    findIntegration("categorisation")
  );

  const jev = variantOf(categorisation, "jev");
  const subqSnap = variantOf(categorisation, "subq-snap");
  const von = variantOf(categorisation, "von");
  const classifierOff = variantOf(categorisation, "disabled");

  const JEV_FORM = {
    TRANSACTION_CLASSIFIER_API_KEY: "ts-key",
    TRANSACTION_CLASSIFIER_MODEL: "jev-latest",
  };

  test("writes the protocol, the fixed endpoint and the chosen variant", () => {
    const candidate = candidateOf(
      categorisation,
      jev,
      JEV_FORM,
      {},
      nothingOwned
    );

    expect(candidate).toMatchObject({
      TRANSACTION_CLASSIFIER: "system-one",
      TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
      "variant:categorisation": "jev",
    });
  });

  test("remembers a self-hosted model the values cannot tell apart", () => {
    const candidate = candidateOf(
      categorisation,
      von,
      {
        TRANSACTION_CLASSIFIER_MODEL: "von-latest",
        TRANSACTION_CLASSIFIER_URL: "http://von:8000/v1/systemone",
      },
      {},
      nothingOwned
    );

    expect(
      writesOf(categorisation, candidate, nothingOwned).get(
        "variant:categorisation"
      )
    ).toBe("von");
  });

  test("keeps no stored key when the operator moves to another vendor", () => {
    const candidate = candidateOf(
      categorisation,
      subqSnap,
      { TRANSACTION_CLASSIFIER_MODEL: "subq-snap-1.1" },
      { ...JEV_FORM, "variant:categorisation": "jev" },
      nothingOwned,
      false
    );

    expect(candidate.TRANSACTION_CLASSIFIER_API_KEY).toBeUndefined();
    expect(missingKeysOf(subqSnap, candidate, nothingOwned)).toEqual([
      "TRANSACTION_CLASSIFIER_API_KEY",
    ]);
  });

  test("keeps a SubQ Snap instance saved with the preview model", () => {
    const stored = {
      TRANSACTION_CLASSIFIER: "system-one",
      TRANSACTION_CLASSIFIER_API_KEY: "subq-key",
      TRANSACTION_CLASSIFIER_MODEL: "subq-snap-preview",
      TRANSACTION_CLASSIFIER_URL: "https://api.subq.ai/v1/systemone",
      "variant:categorisation": "subq-snap",
    };

    const recognised = recogniseVariant(
      categorisation,
      heldFrom(stored),
      stored["variant:categorisation"]
    );

    const writes = writesOf(
      categorisation,
      candidateOf(
        categorisation,
        subqSnap,
        { TRANSACTION_CLASSIFIER_MODEL: stored.TRANSACTION_CLASSIFIER_MODEL },
        stored,
        nothingOwned
      ),
      nothingOwned
    );

    expect(Option.getOrUndefined(recognised)?.id).toBe("subq-snap");
    expect(writes.get("TRANSACTION_CLASSIFIER_MODEL")).toBe(
      "subq-snap-preview"
    );

    expect(writes.get("TRANSACTION_CLASSIFIER_API_KEY")).toBe("subq-key");
  });

  test("drops a stored key when the endpoint of the same variant moves", () => {
    const stored = {
      TRANSACTION_CLASSIFIER: "system-one",
      TRANSACTION_CLASSIFIER_API_KEY: "von-key",
      TRANSACTION_CLASSIFIER_MODEL: "von-latest",
      TRANSACTION_CLASSIFIER_URL: "http://von:8000/v1/systemone",
      "variant:categorisation": "von",
    };

    const moved = candidateOf(
      categorisation,
      von,
      {
        TRANSACTION_CLASSIFIER_MODEL: "von-latest",
        TRANSACTION_CLASSIFIER_URL:
          "https://elsewhere.example.com/v1/systemone",
      },
      stored,
      nothingOwned
    );

    const kept = candidateOf(
      categorisation,
      von,
      {
        TRANSACTION_CLASSIFIER_MODEL: "von-1.3.0",
        TRANSACTION_CLASSIFIER_URL: "http://von:8000/v1/systemone",
      },
      stored,
      nothingOwned
    );

    expect(moved.TRANSACTION_CLASSIFIER_API_KEY).toBeUndefined();
    expect(kept.TRANSACTION_CLASSIFIER_API_KEY).toBe("von-key");
  });

  test("clears the endpoint and the remembered choice when switched off", () => {
    const writes = writesOf(
      categorisation,
      candidateOf(
        categorisation,
        classifierOff,
        {},
        {
          ...JEV_FORM,
          TRANSACTION_CLASSIFIER: "system-one",
          TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
          "variant:categorisation": "jev",
        },
        nothingOwned
      ),
      nothingOwned
    );

    expect(writes.get("TRANSACTION_CLASSIFIER")).toBeNull();
    expect(writes.get("TRANSACTION_CLASSIFIER_URL")).toBeNull();
    expect(writes.get("variant:categorisation")).toBeNull();
  });

  test("refuses a vendor whose endpoint the environment sets elsewhere", () => {
    const conflicts = conflictingPresetsOf(
      categorisation,
      jev,
      heldFrom({
        TRANSACTION_CLASSIFIER_URL: "http://decider:8000/v1/systemone",
      }),
      ownedKeys("TRANSACTION_CLASSIFIER_URL")
    );

    expect(conflicts).toEqual(["TRANSACTION_CLASSIFIER_URL"]);
  });

  test("refuses to switch off a classifier the environment names", () => {
    const conflicts = conflictingPresetsOf(
      categorisation,
      classifierOff,
      heldFrom({ TRANSACTION_CLASSIFIER: "llm" }),
      ownedKeys("TRANSACTION_CLASSIFIER")
    );

    expect(conflicts).toEqual(["TRANSACTION_CLASSIFIER"]);
  });

  test("finds the vendor the environment configures in full", () => {
    const environment: Record<string, string> = {
      TRANSACTION_CLASSIFIER: "system-one",
      TRANSACTION_CLASSIFIER_API_KEY: "ts-key",
      TRANSACTION_CLASSIFIER_MODEL: "jev-latest",
      TRANSACTION_CLASSIFIER_URL: "https://api.typesafe.ai/v1/systemone",
    };

    const found = environmentVariantOf(
      categorisation,
      {},
      heldFrom(environment),
      (key) => environment[key] !== undefined
    );

    expect(found?.id).toBe("jev");
  });
});
