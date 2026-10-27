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

export const NO_GOOD_FIRST_ISSUE = "none";
export const GOOD_FIRST_ISSUE_CHOICE = "good_first_issue";

const DUPLICATE_KEY_PREFIX = "item-";
const MAX_CANDIDATE_TITLE_LENGTH = 200;

export const duplicateKey = (number: number): string =>
  `${DUPLICATE_KEY_PREFIX}${number}`;

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
          feature:
            "A request for a capability Freenary does not have, or to improve, extend or polish something it already does",
          maintenance:
            "Housekeeping: dependencies, refactoring, tooling, tests, CI or repository chores",
        }
      : {
          bug: "The change fixes something that crashes, fails or behaves incorrectly",
          documentation:
            "The change only edits documentation, guides or code comments",
          feature:
            "The change adds a capability Freenary did not have, or improves, extends or polishes something it already does",
          maintenance:
            "The change updates dependencies, refactors, or touches tooling, tests or CI without changing behaviour",
        },
  instructions:
    kind === "issue"
      ? "What kind of request is this issue?"
      : "What kind of change is this pull request?",
  type: "choice",
});

const IMPACT_QUESTION: Question = {
  criteria: [
    "Cosmetic, or very few users affected",
    "A feature degrades for some users, and a workaround exists",
    "A main flow breaks for many users with no workaround, or data, balances or credentials are at risk",
  ],
  instructions: "How much does this affect the people who use Freenary?",
  type: "score",
};

const BLOCKED_QUESTION: Question = {
  criteria: {
    false: "Nothing outside it holds this work back",
    true: "The text says it waits on another issue or pull request, an upstream release or an outside decision",
  },
  instructions:
    "Does the text say this work waits on something outside it before it can go on?",
  type: "noul",
};

const REGRESSION_QUESTION: Question = {
  criteria: {
    false: "A new problem, a request, or a change unrelated to a breakage",
    true: "It worked before and broke after an update, a release or a change",
  },
  instructions:
    "Is this about something that used to work and broke after a change?",
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

const GOOD_FIRST_ISSUE_QUESTION: Question = {
  criteria: {
    [GOOD_FIRST_ISSUE_CHOICE]: "Small, well scoped, and touches few files",
    [NO_GOOD_FIRST_ISSUE]:
      "Large, vague, needs deep knowledge of the architecture, or too little is said to judge",
  },
  instructions:
    "Could a newcomer to the codebase complete this without deep knowledge of its architecture?",
  type: "choice",
};

const PULL_REQUEST_SUMMARY_QUESTION: Question = {
  criteria: {
    false: "Empty, the template text, or only a title repeated",
    true: "It says what changed and what a reviewer should read first",
  },
  instructions:
    "Does the Summary section of this pull request say what changed and what a reviewer should look at first?",
  type: "noul",
};

const PULL_REQUEST_DOCS_QUESTION: Question = {
  criteria: {
    false: "The Notes say nothing about documentation",
    true: "The Notes name the documentation pages updated, or say that none needed a change and why",
  },
  instructions:
    "Do the Notes of this pull request say which documentation pages it updated, or that none needed a change?",
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
      duplicateKey(candidate.number),
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
    blocked: BLOCKED_QUESTION,
    type: typeQuestion(kind),
  };

  if (kind === "issue") {
    questions.good_first_issue = GOOD_FIRST_ISSUE_QUESTION;
    questions.impact = IMPACT_QUESTION;
    questions.regression = REGRESSION_QUESTION;
    questions.security = SECURITY_QUESTION;
  } else {
    questions.pr_summary = PULL_REQUEST_SUMMARY_QUESTION;
    questions.pr_docs = PULL_REQUEST_DOCS_QUESTION;
  }

  if (candidates.length > 0) {
    questions.duplicate = duplicateQuestion(candidates);
  }

  return questions;
};
