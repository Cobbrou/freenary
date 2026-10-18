import type { AreaKey } from "./taxonomy";

const AREA_BY_PATH: readonly (readonly [RegExp, AreaKey])[] = [
  [/(?:^|\/)(?:AGENTS|README|CLAUDE)\.md$/u, "docs"],
  [/^apps\/(?:server|web)\/Dockerfile$/u, "infra"],
  [/^apps\/web\//u, "frontend"],
  [/^packages\/ui\//u, "frontend"],
  [/^apps\/fumadocs\//u, "docs"],
  [/^docs\//u, "docs"],
  [/^\.github\/[^/]+\.md$/u, "docs"],
  [/^\.github\//u, "ci-cd"],
  [/^(?:renovate\.json5|lefthook\.yml)$/u, "ci-cd"],
  [/^scripts\/triage\//u, "ci-cd"],
  [/^packages\/db\//u, "database"],
  [/^packages\/auth\//u, "auth"],
  [/^packages\/api\/src\/routers\//u, "api"],
  [/^packages\/api\//u, "backend"],
  [/^apps\/server\//u, "backend"],
  [/^packages\/(?:email|env|instance-config)\//u, "backend"],
  [/^deploy\//u, "infra"],
  [/^docker-compose[^/]*\.yml$/u, "infra"],
  [/^[^/]+\.md$/u, "docs"],
];

export const areasForPaths = (paths: readonly string[]): AreaKey[] => {
  const areas = new Set<AreaKey>();

  for (const path of paths) {
    const match = AREA_BY_PATH.find(([pattern]) => pattern.test(path));

    if (match) {
      areas.add(match[1]);
    }
  }

  return [...areas].toSorted();
};
