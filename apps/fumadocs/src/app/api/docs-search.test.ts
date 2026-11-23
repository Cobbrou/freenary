import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { structure } from "fumadocs-core/mdx-plugins";

import { guardChatRequest } from "./chat-guard";
import {
  createSectionIndex,
  type IndexedPage,
  MAX_SEARCH_RESULTS,
  MAX_SECTION_LENGTH,
  readSection,
  searchSections,
} from "./docs-search";

const DOCS = path.join(import.meta.dir, "../../../../../docs");

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

const frontmatterField = (frontmatter: string, field: string) =>
  frontmatter.match(new RegExp(`^${field}: (.*)$`, "m"))?.[1] ?? "";

const docsPages = async (): Promise<IndexedPage[]> => {
  const files = (await readdir(DOCS, { recursive: true })).filter((file) =>
    file.endsWith(".md")
  );

  return Promise.all(
    files.map(async (file) => {
      const source = (await readFile(path.join(DOCS, file), "utf8")).replaceAll(
        "\r\n",
        "\n"
      );

      const frontmatter = source.match(FRONTMATTER)?.[1] ?? "";

      return {
        url: `/docs/${file.replaceAll("\\", "/").replace(/\.md$/, "")}`,
        title: frontmatterField(frontmatter, "title"),
        description: frontmatterField(frontmatter, "description"),
        structuredData: structure(source.replace(FRONTMATTER, "")),
      };
    })
  );
};

const post = (messages: unknown[]) =>
  new Request("http://docs.test/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-real-ip": crypto.randomUUID(),
    },
    body: JSON.stringify({ messages }),
  });

const text = (role: string, content: string) => ({
  id: crypto.randomUUID(),
  role,
  parts: [{ type: "text", text: content }],
});

describe("a follow-up question after a docs search", async () => {
  const index = createSectionIndex(await docsPages());

  for (const query of ["install", "docker compose", "bank", "email"]) {
    test(`passes the guard after searching "${query}"`, async () => {
      const results = await searchSections(index, query, 100);

      expect(results.length).toBeGreaterThan(0);
      expect(results.length).toBeLessThanOrEqual(MAX_SEARCH_RESULTS);

      const firstAnswer = {
        id: crypto.randomUUID(),
        role: "assistant",
        parts: [
          { type: "step-start" },
          {
            type: "tool-search",
            toolCallId: "call-1",
            state: "output-available",
            input: { query, limit: MAX_SEARCH_RESULTS },
            output: results,
          },
          {
            type: "text",
            text: `See [${results[0]?.title}](${results[0]?.url}).`,
          },
        ],
      };

      const guarded = await guardChatRequest(
        post([text("user", query), firstAnswer, text("user", "And then?")])
      );

      if (guarded instanceof Response) {
        throw new Error(`Expected 200, got ${guarded.status}`);
      }

      expect(
        guarded.messages
          .flatMap((message) => message.parts)
          .map((part) => part.type)
      ).toEqual(["text", "step-start", "text", "text"]);
    });
  }
});

describe("readSection", async () => {
  const index = createSectionIndex(await docsPages());

  test("returns the section of a search result, capped in length", async () => {
    const [first] = await searchSections(index, "install", 1);

    if (!first) throw new Error("Expected a search result");

    const section = readSection(index, first.url);

    if (!section.found) throw new Error(section.error);

    expect(section.url).toBe(first.url);
    expect(section.content.startsWith(first.excerpt)).toBe(true);
    expect(section.content.length).toBeLessThanOrEqual(MAX_SECTION_LENGTH);
  });

  test("reads a url with the site origin", async () => {
    const [first] = await searchSections(index, "docker compose", 1);

    if (!first) throw new Error("Expected a search result");

    const section = readSection(index, `https://freenary.app${first.url}`);

    expect(section.found ? section.url : section.error).toBe(first.url);
  });

  test("caps a long section", () => {
    const longIndex = createSectionIndex([
      {
        url: "/docs/long",
        title: "Long",
        description: "",
        structuredData: {
          headings: [{ id: "part", content: "Part" }],
          contents: [{ heading: "part", content: "a".repeat(10_000) }],
        },
      },
    ]);

    const section = readSection(longIndex, "/docs/long#part");

    if (!section.found) throw new Error(section.error);

    expect(section.content).toHaveLength(MAX_SECTION_LENGTH);
    expect(section.truncated).toBe(true);
  });

  for (const url of ["/docs/does-not-exist#nope", "http://[bad", ""]) {
    test(`returns a readable error for "${url}"`, () => {
      const section = readSection(index, url);

      expect(section.found).toBe(false);
    });
  }
});
