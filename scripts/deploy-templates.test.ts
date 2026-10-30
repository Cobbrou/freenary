import { describe, expect, it } from "bun:test";

import { FORWARDED_PATH_PREFIXES } from "../apps/web/src/shared/lib/forward-api-request";
import {
  DOKPLOY_COMPOSE_FILE,
  DOKPLOY_TEMPLATE_FILE,
  encodeDokployImport,
} from "./dokploy-import";

interface ComposeService {
  image: string;
  command?: string;
  working_dir?: string;
  healthcheck?: { test: unknown };
}

interface ComposeFile {
  services: Record<string, ComposeService>;
}

const readCompose = async (path: string): Promise<ComposeFile> => {
  const parsed: unknown = Bun.YAML.parse(await Bun.file(path).text());

  // SAFETY: every file read here is a compose file this repository ships, and the assertions below fail on any other shape
  return parsed as ComposeFile;
};

const STACKS = [
  "docker-compose.yml",
  DOKPLOY_COMPOSE_FILE,
  "deploy/coolify.yml",
];

const SERVER_ROUTE = /\.(?:all|get|post)\(\s*"(?<route>\/[^"]*)"/gu;
const ROUTE_WILDCARD = /\/?\*$/u;

describe("the deployment templates", () => {
  it("run the same images, migration and health checks as docker-compose.yml", async () => {
    const [reference, ...variants] = await Promise.all(STACKS.map(readCompose));

    for (const variant of variants) {
      expect(Object.keys(variant?.services ?? {}).toSorted()).toEqual(
        Object.keys(reference?.services ?? {}).toSorted()
      );

      for (const [name, service] of Object.entries(reference?.services ?? {})) {
        const counterpart = variant?.services[name];

        expect(counterpart?.image).toBe(service.image);
        expect(counterpart?.command).toBe(service.command);
        expect(counterpart?.working_dir).toBe(service.working_dir);
        expect(counterpart?.healthcheck?.test).toEqual(
          service.healthcheck?.test
        );
      }
    }
  });

  it("route the Dokploy domain to the port the web service exposes", async () => {
    const template = Bun.TOML.parse(
      await Bun.file(DOKPLOY_TEMPLATE_FILE).text()
    );

    expect(template).toMatchObject({
      config: { domains: [{ port: 3001, serviceName: "web" }] },
    });
  });

  it("encode the Dokploy import as base64 JSON of the compose file and the template", () => {
    const decoded: unknown = JSON.parse(
      Buffer.from(
        encodeDokployImport("services: {}", "[config]"),
        "base64"
      ).toString()
    );

    expect(decoded).toEqual({ compose: "services: {}", config: "[config]" });
  });
});

describe("the single-origin forwarding", () => {
  it("covers every route the API server declares", async () => {
    const serverSource = await Bun.file("apps/server/src/index.ts").text();
    const routes = [...serverSource.matchAll(SERVER_ROUTE)].flatMap((match) => {
      const route = match.groups?.route?.replace(ROUTE_WILDCARD, "");

      return route && route !== "/" ? [route] : [];
    });

    expect(routes.length).toBeGreaterThan(0);
    expect<string[]>(FORWARDED_PATH_PREFIXES.toSorted()).toEqual(
      routes.toSorted()
    );
  });
});
