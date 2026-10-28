import { describe, expect, test } from "bun:test";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

import { structure } from "fumadocs-core/mdx-plugins";

import { guardChatRequest } from "./chat-guard";
import {
  createSectionIndex,
  type IndexedPage,
  MAX_SEARCH_RESULTS,
  searchSections,
} from "./docs-search";

const NEXT_DOCS = path.join(import.meta.dir, "../../../content/docs/next");

const FRONTMATTER = /^---\n([\s\S]*?)\n---\n/;

const frontmatterField = (frontmatter: string, field: string) =>
  frontmatter.match(new RegExp(`^${field}: (.*)$`, "m"))?.[1] ?? "";

const nextPages = async (): Promise<IndexedPage[]> => {
  const files = (await readdir(NEXT_DOCS, { recursive: true })).filter((file) =>
    file.endsWith(".mdx")
  );

  return Promise.all(
    files.map(async (file) => {
      const source = (
        await readFile(path.join(NEXT_DOCS, file), "utf8")
      ).replaceAll("\r\n", "\n");

      const frontmatter = source.match(FRONTMATTER)?.[1] ?? "";

      return {
        url: `/docs/next/${file.replaceAll("\\", "/").replace(/\.mdx$/, "")}`,
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
  const index = createSectionIndex(await nextPages());

  for (const query of ["install", "docker compose", "bank", "password"]) {
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
