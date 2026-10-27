import { afterEach, describe, expect, mock, spyOn, test } from "bun:test";

import { Effect, Exit, Option } from "effect";

import type { FetchReleases, GithubRelease } from "./release";
import {
  createReleaseCheck,
  isNewer,
  newestStable,
  parseVersion,
  visibleTo,
} from "./release";

const TOO_MANY_REQUESTS = 429;

const versionOf = (value: string) => Option.getOrThrow(parseVersion(value));

const published = (tag: string): GithubRelease => ({
  draft: false,
  prerelease: false,
  tag_name: tag,
});

const answering =
  (releases: readonly GithubRelease[]): FetchReleases =>
  () =>
    Promise.resolve(Response.json(releases));

const checkOn = (
  version: string,
  fetchReleases: FetchReleases,
  enabled = true
) => createReleaseCheck({ enabled, fetchReleases, version });

describe("parseVersion", () => {
  test("reads a release and a prerelease", () => {
    expect(versionOf("1.2.3")).toEqual({
      major: 1,
      minor: 2,
      patch: 3,
      prerelease: undefined,
    });

    expect(versionOf("1.3.0-rc.1").prerelease).toBe("rc.1");
  });

  test("refuses a build that is not a release", () => {
    for (const build of ["", "dev", "main", "sha-1a2b3c4", "v1.2.3", "1.2"]) {
      expect(Option.isNone(parseVersion(build))).toBe(true);
    }
  });
});

describe("isNewer", () => {
  test("compares each part as a number", () => {
    expect(isNewer(versionOf("1.10.0"), versionOf("1.9.9"))).toBe(true);
    expect(isNewer(versionOf("2.0.0"), versionOf("1.99.99"))).toBe(true);
    expect(isNewer(versionOf("1.2.0"), versionOf("1.2.1"))).toBe(false);
  });

  test("ranks a release above its own prerelease", () => {
    expect(isNewer(versionOf("1.3.0"), versionOf("1.3.0-rc.1"))).toBe(true);
  });

  test("never reports the running release as newer", () => {
    expect(isNewer(versionOf("1.2.0"), versionOf("1.2.0"))).toBe(false);
  });
});

describe("newestStable", () => {
  test("ignores drafts, prereleases and merchant data releases", () => {
    const newest = newestStable([
      published("data-2026-10-26"),
      { ...published("v9.0.0"), draft: true },
      { ...published("v8.0.0"), prerelease: true },
      published("v7.0.0-rc.1"),
      published("v1.10.0"),
      published("v1.9.0"),
    ]);

    expect(newest).toEqual(Option.some("1.10.0"));
  });

  test("finds nothing without a stable release", () => {
    expect(newestStable([published("data-2026-10-26")])).toEqual(Option.none());
  });
});

describe("createReleaseCheck", () => {
  afterEach(() => {
    mock.restore();
  });

  test("reports a newer release", async () => {
    const check = checkOn("1.2.0", answering([published("v1.3.0")]));

    await Effect.runPromise(check.refresh);

    expect(check.status()).toEqual({ current: "1.2.0", latest: "1.3.0" });
  });

  test("tells a prerelease about its release", async () => {
    const check = checkOn("1.3.0-rc.1", answering([published("v1.3.0")]));

    await Effect.runPromise(check.refresh);

    expect(check.status().latest).toBe("1.3.0");
  });

  test("offers nothing when the instance runs the newest release", async () => {
    const check = checkOn("1.2.0", answering([published("v1.2.0")]));

    await Effect.runPromise(check.refresh);

    expect(check.status().latest).toBeNull();
  });

  test("sends its version as the user agent and nothing else", async () => {
    const fetchReleases = mock(answering([]));
    const check = checkOn("1.2.0", fetchReleases);

    await Effect.runPromise(check.refresh);

    const [init] = fetchReleases.mock.calls[0] ?? [];

    expect(init?.headers).toEqual({
      Accept: "application/vnd.github+json",
      "User-Agent": "freenary/1.2.0",
    });

    expect(init?.body).toBeUndefined();
  });

  test("makes no request when turned off", async () => {
    const fetchReleases = mock(answering([published("v9.0.0")]));
    const check = checkOn("1.2.0", fetchReleases, false);

    await Effect.runPromise(check.refresh);

    expect(check.isActive).toBe(false);
    expect(fetchReleases).not.toHaveBeenCalled();
    expect(check.status()).toEqual({ current: "1.2.0", latest: null });
  });

  test("makes no request for a build that is not a release", async () => {
    const fetchReleases = mock(answering([published("v9.0.0")]));
    const checks = ["", "dev", "main", "sha-1a2b3c4"].map((build) =>
      checkOn(build, fetchReleases)
    );

    await Promise.all(checks.map((check) => Effect.runPromise(check.refresh)));

    expect(fetchReleases).not.toHaveBeenCalled();
    expect(checks.map((check) => check.isActive)).toEqual([
      false,
      false,
      false,
      false,
    ]);

    expect(checks.map((check) => check.status().latest)).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  test("shows nothing and warns once after a refused, timed-out or unreadable request", async () => {
    const warn = spyOn(console, "warn").mockImplementation(() => {});
    const failing: FetchReleases[] = [
      () =>
        Promise.resolve(
          new Response("rate limited", { status: TOO_MANY_REQUESTS })
        ),
      () =>
        Promise.reject(
          new DOMException("The operation timed out.", "TimeoutError")
        ),
      () => Promise.resolve(Response.json({ message: "not a list" })),
    ];

    const checks = failing.map((fetchReleases) =>
      checkOn("1.2.0", fetchReleases)
    );

    await Promise.all(checks.map((check) => Effect.runPromise(check.refresh)));

    expect(checks.map((check) => check.status().latest)).toEqual([
      null,
      null,
      null,
    ]);

    expect(warn).toHaveBeenCalledTimes(failing.length);
  });

  test("keeps repeating after a failed attempt", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    const answers: (() => Promise<Response>)[] = [
      () => Promise.reject(new Error("offline")),
      () => Promise.resolve(Response.json([published("v1.3.0")])),
    ];

    const check = checkOn(
      "1.2.0",
      () => answers.shift()?.() ?? Promise.reject(new Error("no answer"))
    );

    const exit = await Effect.runPromiseExit(
      check.refresh.pipe(Effect.repeat({ times: 1 }))
    );

    expect(Exit.isSuccess(exit)).toBe(true);
    expect(check.status().latest).toBe("1.3.0");
  });

  test("keeps the last answer when a later request fails", async () => {
    spyOn(console, "warn").mockImplementation(() => {});

    const answers: (() => Promise<Response>)[] = [
      () => Promise.resolve(Response.json([published("v1.3.0")])),
      () => Promise.reject(new Error("offline")),
    ];

    const check = checkOn(
      "1.2.0",
      () => answers.shift()?.() ?? Promise.reject(new Error("no answer"))
    );

    await Effect.runPromise(check.refresh);
    await Effect.runPromise(check.refresh);

    expect(check.status().latest).toBe("1.3.0");
  });
});

describe("visibleTo", () => {
  const status = { current: "1.2.0", latest: "1.3.0" };

  test("shows the newer release to the operator", () => {
    expect(visibleTo(status, true)).toEqual(status);
  });

  test("hides it from any other account", () => {
    expect(visibleTo(status, false)).toEqual({
      current: "1.2.0",
      latest: null,
    });
  });
});
