#!/usr/bin/env bun
export const DOKPLOY_COMPOSE_FILE = "deploy/docker-compose.yml";
export const DOKPLOY_TEMPLATE_FILE = "deploy/dokploy/template.toml";

export const encodeDokployImport = (compose: string, config: string): string =>
  Buffer.from(JSON.stringify({ compose, config }, null, 2)).toString("base64");

if (import.meta.main) {
  const [compose, config] = await Promise.all([
    Bun.file(DOKPLOY_COMPOSE_FILE).text(),
    Bun.file(DOKPLOY_TEMPLATE_FILE).text(),
  ]);

  console.log(encodeDokployImport(compose, config));
}
