export interface LabelDefinition {
  readonly name: string;
  readonly color: string;
  readonly description: string;
}

export const TYPE_LABELS = {
  bug: "type:bug",
  documentation: "type:documentation",
  enhancement: "type:enhancement",
  feature: "type:feature",
  maintenance: "type:maintenance",
  question: "type:question",
} as const;

export const AREA_LABELS = {
  api: "area:api",
  auth: "area:auth",
  backend: "area:backend",
  "ci-cd": "area:ci-cd",
  database: "area:database",
  docs: "area:docs",
  frontend: "area:frontend",
  infra: "area:infra",
} as const;

export const STATUS_LABELS = {
  blocked: "status:blocked",
  needsInfo: "status:needs-info",
  needsTriage: "status:needs-triage",
  ready: "status:ready",
} as const;

export const SIGNAL_LABELS = {
  breakingChange: "breaking-change",
  duplicate: "duplicate",
  goodFirstIssue: "good-first-issue",
  needsReproduction: "needs-reproduction",
  performance: "performance",
  regression: "regression",
  security: "security",
} as const;

export const PRIORITY_LABELS = {
  p0: "priority:p0",
  p1: "priority:p1",
  p2: "priority:p2",
  p3: "priority:p3",
} as const;

export type PriorityLabel =
  (typeof PRIORITY_LABELS)[keyof typeof PRIORITY_LABELS];

export const IMPACT_LEVELS = [
  "impact:low",
  "impact:medium",
  "impact:high",
  "impact:critical",
] as const;

export type AreaKey = keyof typeof AREA_LABELS;

export const GROUP_PREFIXES = {
  area: "area:",
  impact: "impact:",
  priority: "priority:",
  status: "status:",
  type: "type:",
} as const;

export const LABELS: readonly LabelDefinition[] = [
  {
    color: "d73a4a",
    description: "Something in Freenary behaves incorrectly",
    name: TYPE_LABELS.bug,
  },
  {
    color: "0e8a16",
    description: "A capability Freenary does not have yet",
    name: TYPE_LABELS.feature,
  },
  {
    color: "a2eeef",
    description: "An improvement to something Freenary already does",
    name: TYPE_LABELS.enhancement,
  },
  {
    color: "0075ca",
    description: "Documentation site, README or contributor guides",
    name: TYPE_LABELS.documentation,
  },
  {
    color: "d876e3",
    description: "A usage or support question",
    name: TYPE_LABELS.question,
  },
  {
    color: "fef2c0",
    description: "Dependencies, refactoring, tooling, tests or chores",
    name: TYPE_LABELS.maintenance,
  },
  {
    color: "c5def5",
    description: "Web app interface (apps/web, packages/ui)",
    name: AREA_LABELS.frontend,
  },
  {
    color: "c5def5",
    description: "API server, providers, jobs and categorisation",
    name: AREA_LABELS.backend,
  },
  {
    color: "c5def5",
    description: "oRPC routes and their contracts (packages/api routers)",
    name: AREA_LABELS.api,
  },
  {
    color: "c5def5",
    description: "Prisma schema and migrations (packages/db)",
    name: AREA_LABELS.database,
  },
  {
    color: "c5def5",
    description: "Sign-in, sessions, one-time codes and providers",
    name: AREA_LABELS.auth,
  },
  {
    color: "c5def5",
    description: "Docker images, compose files and deployment",
    name: AREA_LABELS.infra,
  },
  {
    color: "c5def5",
    description: "GitHub Actions, releases and Renovate",
    name: AREA_LABELS["ci-cd"],
  },
  {
    color: "c5def5",
    description: "Documentation site (apps/fumadocs) and docs/",
    name: AREA_LABELS.docs,
  },
  {
    color: "b60205",
    description: "Urgent: drop everything",
    name: PRIORITY_LABELS.p0,
  },
  {
    color: "d93f0b",
    description: "Important: the next release",
    name: PRIORITY_LABELS.p1,
  },
  {
    color: "fbca04",
    description: "Normal: an upcoming release",
    name: PRIORITY_LABELS.p2,
  },
  {
    color: "c2e0c6",
    description: "Nice to have: no deadline",
    name: PRIORITY_LABELS.p3,
  },
  {
    color: "5319e7",
    description: "Data loss, security exposure or an unusable instance",
    name: "impact:critical",
  },
  {
    color: "8a63d2",
    description: "A main flow breaks for many users, no workaround",
    name: "impact:high",
  },
  {
    color: "b392f0",
    description: "A feature degrades for some users, a workaround exists",
    name: "impact:medium",
  },
  {
    color: "e1d4fb",
    description: "Cosmetic, or few users affected",
    name: "impact:low",
  },
  {
    color: "ededed",
    description: "Waiting for a maintainer to confirm the labels",
    name: STATUS_LABELS.needsTriage,
  },
  {
    color: "f9d0c4",
    description: "Waiting for the author to add information",
    name: STATUS_LABELS.needsInfo,
  },
  {
    color: "0e8a16",
    description: "Clear and ready to work on or review",
    name: STATUS_LABELS.ready,
  },
  {
    color: "b60205",
    description: "Waiting on something outside this item",
    name: STATUS_LABELS.blocked,
  },
  {
    color: "cfd3d7",
    description: "This issue or pull request already exists",
    name: SIGNAL_LABELS.duplicate,
  },
  {
    color: "e11d21",
    description: "Used to work, broke after a change",
    name: SIGNAL_LABELS.regression,
  },
  {
    color: "b60205",
    description: "Needs action from users or operators",
    name: SIGNAL_LABELS.breakingChange,
  },
  {
    color: "ee0701",
    description: "Vulnerability or risk to credentials or financial data",
    name: SIGNAL_LABELS.security,
  },
  {
    color: "f29513",
    description: "Speed, memory or resource usage",
    name: SIGNAL_LABELS.performance,
  },
  {
    color: "7057ff",
    description: "Small and well scoped, good for newcomers",
    name: SIGNAL_LABELS.goodFirstIssue,
  },
  {
    color: "fef2c0",
    description: "A maintainer cannot reproduce it yet",
    name: SIGNAL_LABELS.needsReproduction,
  },
];

export const LEGACY_LABEL_RENAMES: Readonly<Record<string, string>> = {
  bug: TYPE_LABELS.bug,
  documentation: TYPE_LABELS.documentation,
  enhancement: TYPE_LABELS.enhancement,
  "good first issue": SIGNAL_LABELS.goodFirstIssue,
  question: TYPE_LABELS.question,
};
