import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  tool,
  toUIMessageStream,
} from "ai";
import { Document, type DocumentData } from "flexsearch";
import { z } from "zod";

import { listVersions, newestRelease, source } from "@/shared/content";
import { ChatUIMessage, SearchTool } from "@/shared/ui/ai-search";

interface CustomDocument extends DocumentData {
  url: string;
  title: string;
  description: string;
  content: string;
}

const INDEXING_CHUNK_SIZE = 50;

const MAX_TOOL_STEPS = 5;

const DEFAULT_MODEL = "anthropic/claude-3.5-sonnet";

const chatRequestBody = z
  .object({
    version: z.string().optional(),
  })
  .catch({});

const indexByVersion = new Map<string, Promise<Document<CustomDocument>>>();

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const systemPrompt = [
  "You are an AI assistant for a documentation site.",
  "Use the `search` tool to retrieve relevant docs context before answering when needed.",
  "The `search` tool returns raw JSON results from documentation. Use those results to ground your answer and cite sources as markdown links using the document `url` field when available.",
  "If you cannot find the answer in search results, say you do not know and suggest a better search query.",
].join("\n");

const searchTool = (version: string) =>
  tool({
    description: "Search the docs content and return raw JSON results.",
    inputSchema: z.object({
      query: z.string(),
      limit: z.number().int().min(1).max(100).default(10),
    }),
    async execute({ query, limit }) {
      const search = await searchServerFor(version);

      return await search.searchAsync(query, {
        limit,
        merge: true,
        enrich: true,
      });
    },
  }) satisfies SearchTool;

export const chatHandler = async (ctx: { request: Request }) => {
  const req = ctx.request;
  const reqJson = await req.json();
  const requestedVersion = chatRequestBody.parse(reqJson).version;
  const version =
    requestedVersion !== undefined && listVersions().includes(requestedVersion)
      ? requestedVersion
      : newestRelease();

  const stream = streamText({
    model: openrouter.chat(process.env.OPENROUTER_MODEL ?? DEFAULT_MODEL),
    stopWhen: stepCountIs(MAX_TOOL_STEPS),
    tools: {
      search: searchTool(version),
    },
    messages: [
      { role: "system", content: systemPrompt },
      ...(await convertToModelMessages<ChatUIMessage>(reqJson.messages ?? [], {
        convertDataPart(part) {
          if (part.type === "data-client")
            return {
              type: "text",
              text: `[Client Context: ${JSON.stringify(part.data)}]`,
            };
        },
      })),
    ],
    toolChoice: "auto",
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: stream.stream }),
  });
};

function searchServerFor(version: string) {
  let server = indexByVersion.get(version);

  if (!server) {
    server = createSearchServer(version);
    indexByVersion.set(version, server);
  }

  return server;
}

async function createSearchServer(version: string) {
  const search = new Document<CustomDocument>({
    document: {
      id: "url",
      index: ["title", "description", "content"],
      store: true,
    },
  });

  const documents = await chunkedAll(
    source.getPages().flatMap((page) =>
      page.slugs[0] === version
        ? [
            (async (): Promise<CustomDocument> => ({
              title: page.data.title,
              description: page.data.description,
              url: page.url,
              content: await page.data.getText("processed"),
            }))(),
          ]
        : []
    )
  );

  for (const document of documents) {
    search.add(document);
  }

  return search;
}

async function chunkedAll<O>(promises: Promise<O>[]): Promise<O[]> {
  const out: O[] = [];

  for (let i = 0; i < promises.length; i += INDEXING_CHUNK_SIZE) {
    out.push(
      ...(await Promise.all(promises.slice(i, i + INDEXING_CHUNK_SIZE)))
    );
  }

  return out;
}
