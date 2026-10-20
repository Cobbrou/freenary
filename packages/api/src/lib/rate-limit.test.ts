import { describe, expect, test } from "bun:test";

import { callerBucket } from "./rate-limit";

describe("callerBucket", () => {
  test("shares one bucket when a client invents a forwarded chain", () => {
    const spoofed = callerBucket(
      new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" })
    );

    const otherSpoof = callerBucket(
      new Headers({ "x-forwarded-for": "198.51.100.9, 10.0.0.1" })
    );

    expect(spoofed).toBe(otherSpoof);
  });

  test("ignores headers Better Auth does not read", () => {
    expect(
      callerBucket(new Headers({ "cf-connecting-ip": "203.0.113.9" }))
    ).toBe(callerBucket(new Headers({ "cf-connecting-ip": "198.51.100.4" })));
  });

  test("separates callers a single-value header can place", () => {
    const first = callerBucket(
      new Headers({ "x-forwarded-for": "203.0.113.7" })
    );

    const second = callerBucket(
      new Headers({ "x-forwarded-for": "198.51.100.9" })
    );

    expect(first).not.toBe(second);
  });

  test("refuses a value that is not an address", () => {
    expect(callerBucket(new Headers({ "x-forwarded-for": "not-an-ip" }))).toBe(
      callerBucket(new Headers())
    );
  });
});
