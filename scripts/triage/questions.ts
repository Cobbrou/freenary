export type SubjectKind = "issue" | "pull-request";

export type Question =
  | {
      readonly type: "noul";
      readonly instructions: string;
      readonly criteria: { readonly true: string; readonly false: string };
    }
  | {
      readonly type: "choice";
      readonly instructions: string;
      readonly criteria: Readonly<Record<string, string | null>>;
    }
  | {
      readonly type: "score";
      readonly instructions: string;
      readonly criteria: readonly string[];
    };

export interface DuplicateCandidate {
  readonly number: number;
  readonly title: string;
}

export const NO_DUPLICATE = "none";
const DUPLICATE_KEY_PREFIX = "item-";
const MAX_CANDIDATE_TITLE_LENGTH = 200;

export const duplicateKey = (candidate: DuplicateCandidate): string =>
  `${DUPLICATE_KEY_PREFIX}${candidate.number}`;

export const candidateNumber = (key: string): number | undefined =>
  key.startsWith(DUPLICATE_KEY_PREFIX)
    ? Number(key.slice(DUPLICATE_KEY_PREFIX.length))
    : undefined;

const typeQuestion = (kind: SubjectKind): Question => ({
  criteria:
    kind === "issue"
      ? {
          bug: "Something in Freenary crashes, fails or behaves differently from what it should today",
          documentation:
            "A mistake, gap or confusing passage in the documentation site, README or contributor guides",
          enhancement:
            "A request to improve, extend or polish something Freenary already does",
          feature: "A request for a capability Freenary does not have at all",
          maintenance:
            "Housekeeping: dependencies, refactoring, tooling, tests, CI or repository chores",
          question:
            "The author asks how something works or how to use or run Freenary",
        }
      : {
          bug: "The change fixes something that crashes, fails or behaves incorrectly",
          documentation:
            "The change only edits documentation, guides or code comments",
          enhancement:
            "The change improves, extends or polishes something Freenary already does",
          feature: "The change adds a capability Freenary did not have",
          maintenance:
            "The change updates dependencies, refactors, or touches tooling, tests or CI without changing behaviour",
        },
  instructions:
    kind === "issue"
      ? "What kind of request is this issue?"
      : "What kind of change is this pull request?",
  type: "choice",
});

const AREA_QUESTION: Question = {
  criteria: {
    api: "The oRPC routes of packages/api: their inputs, outputs and permissions",
    auth: "Sign-in, sign-up, sessions, one-time codes, OAuth or OIDC providers, two-factor authentication",
    backend:
      "The API server: bank and email providers, background jobs, transaction categorisation, server configuration",
    "ci-cd": "GitHub Actions workflows, releases, published images, Renovate",
    database: "The PostgreSQL schema, Prisma models and migrations",
    docs: "The documentation site or the contributor documentation",
    frontend:
      "The web app interface: screens, components, styling, navigation, translations",
    infra:
      "Docker images, compose files, self-hosting, deployment templates, reverse proxies",
  },
  instructions: "Which part of Freenary does this concern most?",
  type: "choice",
};

const IMPACT_QUESTION: Question = {
  criteria: [
    "Cosmetic, or very few users affected",
    "A feature degrades for some users, and a workaround exists",
    "A main flow breaks for many users, with no workaround",
    "Data loss, wrong balances, exposed credentials or an unusable instance",
  ],
  instructions: "How much does this affect the people who use Freenary?",
  type: "score",
};

const needsInfoQuestion = (kind: SubjectKind): Question => ({
  criteria:
    kind === "issue"
      ? {
          false:
            "The problem or request, the expected outcome and the context are all clear",
          true: "Vague or incomplete: missing steps, versions, expected versus actual behaviour, or the goal",
        }
      : {
          false: "The description explains what changed and why",
          true: "The description is empty, a bare template, or leaves out what changed and why",
        },
  instructions:
    kind === "issue"
      ? "Would a maintainer have to ask the author for more information before acting?"
      : "Would a reviewer have to ask the author what this change does and why?",
  type: "noul",
});

const BLOCKED_QUESTION: Question = {
  criteria: {
    false: "Nothing outside it holds this work back",
    true: "The text says it waits on another issue or pull request, an upstream release or an outside decision",
  },
  instructions:
    "Does the text say this work waits on something outside it before it can go on?",
  type: "noul",
};

const readyQuestion = (kind: SubjectKind): Question => ({
  criteria:
    kind === "issue"
      ? {
          false: "The scope or the expected outcome still needs discussion",
          true: "A contributor could start right now: the scope and the expected outcome are clear",
        }
      : {
          false:
            "Marked as work in progress, or the description says more work is coming",
          true: "Complete and ready for a reviewer to read",
        },
  instructions:
    kind === "issue"
      ? "Could a contributor start work on this issue right now?"
      : "Is this pull request complete and ready for review?",
  type: "noul",
});

const REGRESSION_QUESTION: Question = {
  criteria: {
    false: "A new problem, a request, or a change unrelated to a breakage",
    true: "It worked before and broke after an update, a release or a change",
  },
  instructions:
    "Is this about something that used to work and broke after a change?",
  type: "noul",
};

const BREAKING_CHANGE_QUESTION: Question = {
  criteria: {
    false: "Existing installs keep working with no action",
    true: "Operators or users must act: configuration, environment variables, data, API contracts or workflows change incompatibly",
  },
  instructions:
    "Does this change, or the change it asks for, break existing installs, configuration, data or API contracts?",
  type: "noul",
};

const SECURITY_QUESTION: Question = {
  criteria: {
    false: "No security or privacy concern",
    true: "A vulnerability, or a risk to credentials, financial data, authentication or privacy",
  },
  instructions:
    "Is this about a security vulnerability or a risk to credentials, financial data or privacy?",
  type: "noul",
};

const PERFORMANCE_QUESTION: Question = {
  criteria: {
    false: "Speed and resource usage are not the subject",
    true: "Slowness, latency, memory, CPU, bundle size or database load is the subject",
  },
  instructions: "Is this about speed or resource usage?",
  type: "noul",
};

const GOOD_FIRST_ISSUE_QUESTION: Question = {
  criteria: {
    false: "Large, vague, or needs deep knowledge of the architecture",
    true: "Small, well scoped, and touches few files",
  },
  instructions:
    "Could a newcomer to the codebase complete this without deep knowledge of its architecture?",
  type: "noul",
};

const NEEDS_REPRODUCTION_QUESTION: Question = {
  criteria: {
    false: "The steps to see the bug are written down",
    true: "No steps, or steps too vague to follow",
  },
  instructions:
    "Does this bug report lack steps a maintainer could follow to see the bug?",
  type: "noul",
};

const duplicateQuestion = (
  candidates: readonly DuplicateCandidate[]
): Question => ({
  criteria: Object.fromEntries([
    [
      NO_DUPLICATE,
      "None of them describes the same problem, request or change",
    ],
    ...candidates.map((candidate) => [
      duplicateKey(candidate),
      candidate.title.slice(0, MAX_CANDIDATE_TITLE_LENGTH),
    ]),
  ]),
  instructions:
    "Which existing open item describes the same problem, request or change as this one?",
  type: "choice",
});

export const buildQuestions = (
  kind: SubjectKind,
  candidates: readonly DuplicateCandidate[]
): Record<string, Question> => {
  const questions: Record<string, Question> = {
    area: AREA_QUESTION,
    blocked: BLOCKED_QUESTION,
    breaking_change: BREAKING_CHANGE_QUESTION,
    impact: IMPACT_QUESTION,
    needs_info: needsInfoQuestion(kind),
    performance: PERFORMANCE_QUESTION,
    ready: readyQuestion(kind),
    regression: REGRESSION_QUESTION,
    security: SECURITY_QUESTION,
    type: typeQuestion(kind),
  };

  if (kind === "issue") {
    questions.good_first_issue = GOOD_FIRST_ISSUE_QUESTION;
    questions.needs_reproduction = NEEDS_REPRODUCTION_QUESTION;
  }

  if (candidates.length > 0) {
    questions.duplicate = duplicateQuestion(candidates);
  }

  return questions;
};
