import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";
import { Effect } from "effect";

import {
  claimForFirstSession,
  InstanceSetupUnavailable,
  readSetupState,
} from "./claim";

const FIRST = "claim-first";
const SECOND = "claim-second";
const UNKNOWN = "claim-unknown";
const CLAIMANTS = [FIRST, SECOND];

const claim = (userId: string): Promise<boolean> =>
  Effect.runPromise(claimForFirstSession(userId));

const failedClaim = (userId: string) =>
  Effect.runPromise(Effect.flip(claimForFirstSession(userId)));

const operators = async (): Promise<string[]> => {
  const accounts = await prisma.user.findMany({
    select: { id: true },
    where: { id: { in: CLAIMANTS }, role: "OPERATOR" },
  });

  return accounts.map(({ id }) => id);
};

beforeAll(async () => {
  await startTestDatabase();
});

beforeEach(async () => {
  await prisma.instanceSetup.deleteMany();
  await prisma.user.deleteMany({ where: { id: { in: CLAIMANTS } } });
  await prisma.user.createMany({
    data: CLAIMANTS.map((id) => ({
      email: `${id}@example.test`,
      firstName: id,
      id,
    })),
  });
});

describe("claimForFirstSession", () => {
  test("makes one operator out of two concurrent claims", async () => {
    const taken = await Promise.all(CLAIMANTS.map(claim));

    expect(taken.filter(Boolean)).toHaveLength(1);
    expect(await operators()).toEqual(
      CLAIMANTS.filter((_claimant, index) => taken[index])
    );
  });

  test("leaves a claimed instance to its operator", async () => {
    expect(await claim(FIRST)).toBe(true);
    expect(await claim(SECOND)).toBe(false);
    expect(await operators()).toEqual([FIRST]);
  });

  test("stays unclaimed when the role cannot be written", async () => {
    const failure = await failedClaim(UNKNOWN);

    expect(failure).toBeInstanceOf(InstanceSetupUnavailable);
    expect(failure.operation).toBe("claimed");

    expect(await Effect.runPromise(readSetupState())).toEqual({
      claimed: false,
      completed: false,
    });

    expect(await claim(FIRST)).toBe(true);
  });
});

describe("claimForFirstSession, when the setup cannot be read", () => {
  beforeEach(async () => {
    await prisma.$executeRaw`ALTER TABLE "instance_setup" RENAME TO "instance_setup_away"`;
  });

  afterEach(async () => {
    await prisma.$executeRaw`ALTER TABLE "instance_setup_away" RENAME TO "instance_setup"`;
  });

  test("fails and makes no operator", async () => {
    const failure = await failedClaim(FIRST);

    expect(failure).toBeInstanceOf(InstanceSetupUnavailable);
    expect(failure.operation).toBe("read");

    expect(await operators()).toEqual([]);
  });
});
