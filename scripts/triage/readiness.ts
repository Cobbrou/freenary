import type { Question } from "./questions";
import type { Answers } from "./subq";
import { TYPE_LABELS } from "./taxonomy";

export type GapOwner = "author" | "maintainer" | "waiting";

export interface Gap {
  readonly owner: GapOwner;
  readonly text: string;
}

export const MIN_CRITERION_PROBABILITY = 0.5;

export type Checklist = "bug" | "request" | "documentation" | "maintenance";

interface Criterion {
  readonly owner: GapOwner;
  readonly instructions: string;
  readonly met: string;
  readonly unmet: string;
  readonly missing: string;
}

export const STEPS_CRITERION = "check_steps";

const SCOPE_CRITERION: Criterion = {
  instructions:
    "Could a contributor build this without a design decision that is still open?",
  met: "The scope is clear and no design choice is left open",
  missing: "Decide the open design question or the scope.",
  owner: "maintainer",
  unmet: "Two or more ways to do it are possible, or the scope is still open",
};

const CRITERIA: Readonly<
  Record<Checklist, Readonly<Record<string, Criterion>>>
> = {
  bug: {
    check_environment: {
      instructions:
        "Does the report name the Freenary version, commit, browser or deployment where the bug happens?",
      met: "It names a version, commit, browser or deployment",
      missing: "Name the Freenary version or commit, and where you run it.",
      owner: "author",
      unmet: "No version, commit, browser or deployment is named",
    },
    check_expected_actual: {
      instructions:
        "Does the report say both what happened and what should have happened?",
      met: "It says what happened and what should have happened",
      missing: "Say what happened and what you expected instead.",
      owner: "author",
      unmet: "Only one of the two, or neither",
    },
    [STEPS_CRITERION]: {
      instructions:
        "Does the report give steps someone else could follow to see the bug?",
      met: "Ordered steps, or one exact action that shows the bug",
      missing: "Add the steps that reproduce the bug.",
      owner: "author",
      unmet: "No steps, or only a description of the result",
    },
  },
  documentation: {
    check_correction: {
      instructions:
        "Does the text say what is wrong, missing or confusing in the documentation?",
      met: "It says what is wrong, missing or confusing",
      missing: "Say what is wrong or missing on that page.",
      owner: "author",
      unmet: "It only says the documentation could be better",
    },
    check_location: {
      instructions:
        "Does the text name the documentation page, section or file concerned?",
      met: "It names a page, section or file",
      missing: "Name the page or section.",
      owner: "author",
      unmet: "No page, section or file is named",
    },
  },
  maintenance: {
    check_goal: {
      instructions: "Does the text say what should change and why?",
      met: "It says what should change and why",
      missing: "Say what should change and why.",
      owner: "author",
      unmet: "The change or its reason is missing",
    },
    check_scope: SCOPE_CRITERION,
  },
  request: {
    check_outcome: {
      instructions:
        "Does the text describe what the result should look like or do?",
      met: "It describes the expected result",
      missing: "Describe the result you expect.",
      owner: "author",
      unmet: "No expected result is described",
    },
    check_problem: {
      instructions:
        "Does the text explain the problem or need behind the request?",
      met: "It explains the problem or the need",
      missing: "Explain the problem this would solve.",
      owner: "author",
      unmet: "It only names a solution",
    },
    check_scope: SCOPE_CRITERION,
  },
};

const CHECKLIST_BY_TYPE: Readonly<Record<string, Checklist>> = {
  [TYPE_LABELS.bug]: "bug",
  [TYPE_LABELS.documentation]: "documentation",
  [TYPE_LABELS.feature]: "request",
  [TYPE_LABELS.maintenance]: "maintenance",
};

export const checklistFor = (
  typeLabel: string | undefined
): Checklist | undefined =>
  typeLabel === undefined ? undefined : CHECKLIST_BY_TYPE[typeLabel];

export const checklistQuestions = (
  checklist: Checklist
): Record<string, Question> =>
  Object.fromEntries(
    Object.entries(CRITERIA[checklist]).map(([key, criterion]) => [
      key,
      {
        criteria: { false: criterion.unmet, true: criterion.met },
        instructions: criterion.instructions,
        type: "noul",
      } satisfies Question,
    ])
  );

export const unmetCriteria = (
  checklist: Checklist,
  answers: Answers
): string[] =>
  Object.keys(CRITERIA[checklist]).filter((key) => {
    const answer = answers[key];

    return answer?.type !== "noul" || answer.noul < MIN_CRITERION_PROBABILITY;
  });

export const checklistGaps = (
  checklist: Checklist,
  unmet: readonly string[]
): Gap[] =>
  Object.entries(CRITERIA[checklist]).flatMap(([key, criterion]) =>
    unmet.includes(key)
      ? [{ owner: criterion.owner, text: criterion.missing }]
      : []
  );

const TEMPLATE_HEADING = /^#{1,6}[ \t]+(?<title>.+?)(?:[ \t]+#+)?[ \t]*$/gmu;
const LINK_DEFINITION = /^\[[^\]]+\]:\s*#\S*\s*$/gmu;
const HTML_COMMENT = /<!--[\s\S]*?-->/gu;
const WHITESPACE_RUN = /\s+/gu;

const normaliseSection = (text: string): string =>
  text
    .replace(HTML_COMMENT, "")
    .replace(LINK_DEFINITION, "")
    .replace(WHITESPACE_RUN, " ")
    .trim();

const FENCED_BLOCK = /^(?<fence>```|~~~)[\s\S]*?^\k<fence>[^\n]*$/gmu;

const NON_NEWLINE = /[^\n]/gu;

const blankFences = (markdown: string): string =>
  markdown.replace(FENCED_BLOCK, (block) =>
    block.replaceAll(NON_NEWLINE, (character) => " ".repeat(character.length))
  );

export const splitSections = (
  markdown: string,
  titles: ReadonlySet<string> | null
): Map<string, string> => {
  const sections = new Map<string, string>();
  const headings = [...blankFences(markdown).matchAll(TEMPLATE_HEADING)].filter(
    (heading) =>
      titles === null || titles.has(heading.groups?.title?.trim() ?? "")
  );

  for (const [index, heading] of headings.entries()) {
    const start = (heading.index ?? 0) + heading[0].length;
    const end = headings[index + 1]?.index ?? markdown.length;
    const title = heading.groups?.title?.trim() ?? "";

    sections.set(title, normaliseSection(markdown.slice(start, end)));
  }

  return sections;
};

export const sectionGapText = (title: string): string =>
  `Fill the ${title} section.`;

const OPTIONAL_SECTIONS: ReadonlySet<string> = new Set(["Evidence"]);

export const templateGaps = (template: string, body: string): Gap[] => {
  const expected = splitSections(template, null);
  const written = splitSections(body, new Set(expected.keys()));

  return [...expected].flatMap(([title, placeholder]) => {
    if (OPTIONAL_SECTIONS.has(title)) {
      return [];
    }

    const text = written.get(title);
    const filled = text !== undefined && text !== "" && text !== placeholder;

    return filled
      ? []
      : [{ owner: "author" as const, text: sectionGapText(title) }];
  });
};

const STILL_TO_DEFINE_TITLE = "still to define";
const UNCHECKED_ITEM = /^[ \t]*[-*+][ \t]+\[ \][ \t]*(?<text>\S.*)$/u;
const ANY_CHECKBOX = /^[ \t]*[-*+][ \t]+\[[ xX]\]/u;

const NOTHING_LEFT: ReadonlySet<string> = new Set([
  "",
  "-",
  "_no response_",
  "n/a",
  "nothing",
  "nothing left",
  "none",
]);

export const STILL_TO_DEFINE_GAP_TEXT =
  "Settle the open items under Still to define, and tick or remove each one.";

export const openItemsToDefine = (body: string): string[] => {
  const blanked = blankFences(body);
  const raw = [...blanked.matchAll(TEMPLATE_HEADING)].find(
    (heading) =>
      heading.groups?.title?.trim().toLowerCase() === STILL_TO_DEFINE_TITLE
  );

  if (raw === undefined) {
    return [];
  }

  const start = (raw.index ?? 0) + raw[0].length;
  const rest = blanked.slice(start);
  const next = rest.search(/^#{1,6}[ \t]+/mu);
  const section = (next === -1 ? rest : rest.slice(0, next))
    .replace(HTML_COMMENT, "")
    .replace(LINK_DEFINITION, "");

  const lines = section.split("\n").filter((line) => line.trim() !== "");
  const unchecked = lines.flatMap((line) => {
    const text = UNCHECKED_ITEM.exec(line)?.groups?.text?.trim();

    return text === undefined ? [] : [text];
  });

  if (unchecked.length > 0) {
    return unchecked;
  }

  const hasCheckboxes = lines.some((line) => ANY_CHECKBOX.test(line));
  const prose = lines.join(" ").replace(WHITESPACE_RUN, " ").trim();

  return hasCheckboxes || NOTHING_LEFT.has(prose.toLowerCase()) ? [] : [prose];
};

export const stillToDefineGaps = (body: string): Gap[] =>
  openItemsToDefine(body).length > 0
    ? [{ owner: "maintainer", text: STILL_TO_DEFINE_GAP_TEXT }]
    : [];

export const REQUIRED_CHECKS = ["ci", "compose"] as const;

export interface CheckRun {
  readonly id: number;
  readonly name: string;
  readonly status: string;
  readonly conclusion?: string | null;
}

const PASSING_CONCLUSIONS: ReadonlySet<string> = new Set([
  "success",
  "skipped",
  "neutral",
]);

const SUPERSEDED_CONCLUSIONS: ReadonlySet<string> = new Set([
  "cancelled",
  "stale",
]);

export const checkGaps = (runs: readonly CheckRun[]): Gap[] =>
  REQUIRED_CHECKS.flatMap((name): Gap[] => {
    const [latest] = runs
      .filter((run) => run.name === name)
      .toSorted((left, right) => right.id - left.id);

    if (
      !latest ||
      latest.status !== "completed" ||
      SUPERSEDED_CONCLUSIONS.has(latest.conclusion ?? "")
    ) {
      return [
        { owner: "waiting" as const, text: `Wait for the \`${name}\` check.` },
      ];
    }

    return PASSING_CONCLUSIONS.has(latest.conclusion ?? "")
      ? []
      : [
          {
            owner: "author" as const,
            text: `Fix the failing \`${name}\` check.`,
          },
        ];
  });

const DOCS_PATH = /^apps\/fumadocs\/content\/docs\/next\//u;

const DOCUMENTED_BEHAVIOUR_PATH =
  /^(?:apps\/web\/src\/|apps\/server\/src\/|packages\/(?:api|auth|db|email|env|instance-config)\/src\/|packages\/db\/prisma\/|docker-compose[^/]*\.yml$|\.github\/workflows\/|package\.json$)/u;

export const docsExpected = (files: readonly string[]): boolean =>
  files.some((file) => DOCUMENTED_BEHAVIOUR_PATH.test(file)) &&
  !files.some((file) => DOCS_PATH.test(file));

export type ReadinessStatus =
  | "blocked"
  | "needs-info"
  | "needs-triage"
  | "ready";

export const decideReadiness = (
  blocked: boolean,
  gaps: readonly Gap[]
): ReadinessStatus => {
  if (blocked) {
    return "blocked";
  }

  if (gaps.some((gap) => gap.owner === "author")) {
    return "needs-info";
  }

  return gaps.length > 0 ? "needs-triage" : "ready";
};
