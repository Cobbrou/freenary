import { describe, expect, it } from "bun:test";

const MERGE = `${import.meta.dir}/merge.ts`;
const SETUP = `${import.meta.dir}/setup.ts`;

interface MockBankReading {
  readonly environmentVariant: string | null;
  readonly listedVariants: readonly string[];
  readonly mockRefusal: string | null;
  readonly mockVariantFound: boolean;
  readonly storedMockRecognisedAs: string | null;
  readonly storedMockState: string;
}

const READ_MOCK_BANK = `
const { findIntegration, findVariant, isListedFor, recogniseVariant } =
  await import("@freenary/instance-config/integrations");
const { serverEnvSchema } = await import("@freenary/env/schema");
const { environmentVariantOf } = await import(${JSON.stringify(MERGE)});
const { integrationStateOf } = await import(${JSON.stringify(SETUP)});
const { Option } = await import("effect");

const banking = Option.getOrThrow(findIntegration("banking"));
const storedMock = { BANKING_PROVIDER: "mock", "variant:banking": "mock" };
const holding = (values) => (key) => values[key];
const recognised = Option.getOrNull(
  recogniseVariant(banking, holding(storedMock), "mock")
);
const parsed = serverEnvSchema.BANKING_PROVIDER.safeParse("mock");
const environmentVariant = environmentVariantOf(
  banking,
  {},
  holding({ BANKING_PROVIDER: "mock" }),
  (key) => key === "BANKING_PROVIDER"
);

console.log(JSON.stringify({
  environmentVariant: environmentVariant?.id ?? null,
  listedVariants: banking.variants
    .filter((variant) => isListedFor(variant, "disabled"))
    .map((variant) => variant.id),
  mockRefusal: parsed.success ? null : parsed.error.issues[0].message,
  mockVariantFound: Option.isSome(findVariant(banking, "mock")),
  storedMockRecognisedAs: recognised?.id ?? null,
  storedMockState: integrationStateOf(
    banking,
    recognised?.id ?? "disabled",
    (key) => storedMock[key] !== undefined
  ),
}));
`;

const readMockBankUnder = async (
  nodeEnv: "development" | "production"
): Promise<MockBankReading> => {
  const reader = Bun.spawn([process.execPath, "--eval", READ_MOCK_BANK], {
    cwd: import.meta.dir,
    env: { ...process.env, NODE_ENV: nodeEnv },
    stderr: "pipe",
    stdout: "pipe",
  });

  const [output, failure, exitCode] = await Promise.all([
    new Response(reader.stdout).text(),
    new Response(reader.stderr).text(),
    reader.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(failure);
  }

  return JSON.parse(output) as MockBankReading;
};

describe("the mock bank in production", async () => {
  const production = await readMockBankUnder("production");

  it("lists only the real bank providers", () => {
    expect(production.listedVariants).toEqual([
      "disabled",
      "powens",
      "enable-banking",
    ]);
  });

  it("finds no mock variant, so a save naming it is refused", () => {
    expect(production.mockVariantFound).toBe(false);
  });

  it("refuses BANKING_PROVIDER=mock in the environment", () => {
    expect(production.mockRefusal).toBe(
      "mock generates bank data and is refused in production"
    );
  });

  it("reads a stored mock as no provider, not as a crash", () => {
    expect(production.storedMockRecognisedAs).toBeNull();
    expect(production.storedMockState).toBe("disabled");
  });

  it("does not read a mock in the environment as set by the server", () => {
    expect(production.environmentVariant).toBeNull();
  });
});

describe("the mock bank in development", async () => {
  const development = await readMockBankUnder("development");

  it("lists the mock last, after the real providers", () => {
    expect(development.listedVariants).toEqual([
      "disabled",
      "powens",
      "enable-banking",
      "mock",
    ]);
  });

  it("accepts BANKING_PROVIDER=mock", () => {
    expect(development.mockVariantFound).toBe(true);
    expect(development.mockRefusal).toBeNull();
  });

  it("reads a mock in the environment as set by the server", () => {
    expect(development.environmentVariant).toBe("mock");
  });

  it("reads a stored mock as a configured provider", () => {
    expect(development.storedMockRecognisedAs).toBe("mock");
    expect(development.storedMockState).toBe("configured");
  });
});
