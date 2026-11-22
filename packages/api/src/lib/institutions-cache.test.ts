import { describe, expect, test } from "bun:test";

import { ORPCError } from "@orpc/server";
import { Effect } from "effect";

import type { ProviderInstitution } from "../providers/types";
import { BankInstitutionsUnavailable } from "../providers/types";
import {
  INSTITUTIONS_CACHE_TTL_MS,
  institutionsLoaderWith,
} from "./institutions-cache";

const BANKS: ProviderInstitution[] = [
  { country: "FR", id: "bank-a", name: "Bank A" },
  { country: "DE", id: "bank-b", name: "Bank B" },
];

const fakeProvider = (id: string, answers: ("banks" | "unavailable")[]) => {
  const calls = { count: 0 };

  const provider = {
    id,
    listInstitutions: () => {
      const answer = answers[calls.count] ?? "banks";

      calls.count += 1;

      return answer === "banks"
        ? Effect.succeed(BANKS)
        : Effect.fail(new BankInstitutionsUnavailable({}));
    },
  };

  return { calls, provider };
};

const controlledClock = () => {
  const clock = { at: Date.parse("2026-01-01T00:00:00.000Z") };

  return { clock, now: () => clock.at };
};

describe("institutionsLoaderWith", () => {
  test("reaches the provider once for two calls within the hour", async () => {
    const { clock, now } = controlledClock();
    const load = institutionsLoaderWith({ now });
    const { calls, provider } = fakeProvider("enable-banking", []);

    expect(await load(provider)).toEqual(BANKS);

    clock.at += INSTITUTIONS_CACHE_TTL_MS - 1;

    expect(await load(provider)).toEqual(BANKS);
    expect(calls.count).toBe(1);
  });

  test("reloads the list once the hour has passed", async () => {
    const { clock, now } = controlledClock();
    const load = institutionsLoaderWith({ now });
    const { calls, provider } = fakeProvider("enable-banking", []);

    await load(provider);

    clock.at += INSTITUTIONS_CACHE_TTL_MS;

    await load(provider);

    expect(calls.count).toBe(2);
  });

  test("does not keep a failed load, and still answers SERVICE_UNAVAILABLE", async () => {
    const { now } = controlledClock();
    const load = institutionsLoaderWith({ now });
    const { calls, provider } = fakeProvider("enable-banking", [
      "unavailable",
      "banks",
    ]);

    const failed = load(provider);

    await expect(failed).rejects.toBeInstanceOf(ORPCError);
    await expect(failed).rejects.toMatchObject({ code: "SERVICE_UNAVAILABLE" });
    expect(await load(provider)).toEqual(BANKS);
    expect(calls.count).toBe(2);
  });

  test("keeps each provider's list apart", async () => {
    const { now } = controlledClock();
    const load = institutionsLoaderWith({ now });
    const first = fakeProvider("enable-banking", []);
    const second = fakeProvider("powens", []);

    await load(first.provider);
    await load(second.provider);
    await load(first.provider);

    expect(first.calls.count).toBe(1);
    expect(second.calls.count).toBe(1);
  });
});
