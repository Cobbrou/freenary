import { describe, expect, test } from "bun:test";

import { deriveDevIdentity } from "./dev-identity";

describe("deriveDevIdentity slug derivation", () => {
  test.each([
    ["a branch slash becomes a dash", "feat/projects", "feat-projects"],
    [
      "uppercase and underscores fold to lowercase dashes",
      "Feature/Foo_Bar",
      "feature-foo-bar",
    ],
    [
      "leading/trailing junk trims and runs collapse",
      "/weird--branch/",
      "weird-branch",
    ],
    ["dots and spaces are non-label runs", "Release 1.2.3", "release-1-2-3"],
  ])("%s", (_name, branch, expected) => {
    expect(deriveDevIdentity({ branch }).slug).toBe(expected);
  });

  test("a slug longer than 40 chars is capped at 40", () => {
    const { slug } = deriveDevIdentity({ branch: "a".repeat(45) });

    expect(slug).toBe("a".repeat(40));
    expect(slug).toHaveLength(40);
  });

  test("a dash landing on the 40-char cap is trimmed off", () => {
    const { slug } = deriveDevIdentity({
      branch: `${"a".repeat(39)}_${"z".repeat(20)}`,
    });

    expect(slug).toBe("a".repeat(39));
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("deriveDevIdentity slug precedence", () => {
  test("slugOverride wins over both branch and dir", () => {
    expect(
      deriveDevIdentity({
        branch: "some-branch",
        dir: "some-dir",
        slugOverride: "override",
      }).slug
    ).toBe("override");
  });

  test("branch wins over dir", () => {
    expect(deriveDevIdentity({ branch: "my-branch", dir: "my-dir" }).slug).toBe(
      "my-branch"
    );
  });

  test.each([
    ["branch is null", null],
    ["branch is empty", ""],
    ["branch is undefined", undefined],
  ])("dir is used when %s", (_name, branch) => {
    expect(deriveDevIdentity({ branch, dir: "my-dir" }).slug).toBe("my-dir");
  });

  test.each([
    ["both branch and dir are null", { branch: null, dir: null }],
    ["nothing is provided", {}],
    ["branch is empty, dir is empty", { branch: "", dir: "" }],
  ])("falls back to 'dev' when %s", (_name, input) => {
    expect(deriveDevIdentity(input).slug).toBe("dev");
  });
});

describe("deriveDevIdentity URL / host consistency", () => {
  test("URLs stay mutually consistent", () => {
    const id = deriveDevIdentity({ branch: "feat/projects" });

    expect(new URL(id.corsOrigin).host).toBe(id.webHost);
    expect(new URL(id.betterAuthUrl).host).toBe(id.serverHost);
    expect(new URL(id.viteServerUrl).host).toBe(id.serverHost);
    expect(new URL(id.docsUrl).host).toBe(id.docsHost);
    expect(new URL(id.mailUrl).host).toBe(id.mailHost);
    expect(id.betterAuthUrl).toBe(id.viteServerUrl);
    expect(id.webHost).toContain(id.slug);
    expect(id.serverHost).toContain(id.slug);
    expect(id.docsHost).toContain(id.slug);
    expect(id.composeProjectName).toBe(`freenary-${id.slug}`);
  });
});

describe("deriveDevIdentity host shapes", () => {
  test("produces http + freenary.localhost hosts", () => {
    const id = deriveDevIdentity({ branch: "feat/projects" });

    expect(new URL(id.corsOrigin).protocol).toBe("http:");
    expect(id.webHost).toBe("web.feat-projects.freenary.localhost");
    expect(id.serverHost).toBe("server.feat-projects.freenary.localhost");
    expect(id.corsOrigin).toBe("http://web.feat-projects.freenary.localhost");
    expect(id.betterAuthUrl).toBe(
      "http://server.feat-projects.freenary.localhost"
    );

    expect(id.viteServerUrl).toBe(
      "http://server.feat-projects.freenary.localhost"
    );

    expect(id.docsHost).toBe("docs.feat-projects.freenary.localhost");
    expect(id.docsUrl).toBe("http://docs.feat-projects.freenary.localhost");
    expect(id.mailHost).toBe("mail.feat-projects.freenary.localhost");
    expect(id.mailUrl).toBe("http://mail.feat-projects.freenary.localhost");
    expect(id.cookieDomain).toBe(".feat-projects.freenary.localhost");
  });
});

describe("deriveDevIdentity cross-worktree distinctness", () => {
  test("two different branches produce fully distinct identities", () => {
    const a = deriveDevIdentity({ branch: "feature-a" });
    const b = deriveDevIdentity({ branch: "feature-b" });

    expect(a.composeProjectName).not.toBe(b.composeProjectName);
    expect(a.webHost).not.toBe(b.webHost);
    expect(a.serverHost).not.toBe(b.serverHost);
    expect(a.docsHost).not.toBe(b.docsHost);
    expect(a.mailHost).not.toBe(b.mailHost);
    expect(a.corsOrigin).not.toBe(b.corsOrigin);
  });
});
