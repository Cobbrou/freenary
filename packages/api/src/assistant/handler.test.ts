import { describe, expect, test } from "bun:test";

import { ORPCError } from "@orpc/server";

import { rateLimitRefusal, refusalResponse } from "./handler";

describe("rateLimitRefusal", () => {
  test("answers 503 when the rate-limit store fails", async () => {
    const response = refusalResponse(rateLimitRefusal(new Error("db down")));

    expect(response.status).toBe(503);
    expect(await response.text()).toBe("unavailable");
  });

  test("answers 429 when the caller is over the limit", async () => {
    const response = refusalResponse(
      rateLimitRefusal(new ORPCError("TOO_MANY_REQUESTS"))
    );

    expect(response.status).toBe(429);
    expect(await response.text()).toBe("rate_limited");
  });
});
