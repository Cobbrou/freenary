export type AnswerSegment =
  | { kind: "markdown"; text: string }
  | { kind: "chart"; code: string; closed: boolean };

const CHART_FENCE_OPEN = /^ {0,3}```[ \t]*openui(?:-lang)?[ \t]*$/u;
const FENCE_OPEN = /^ {0,3}```/u;
const FENCE_CLOSE = /^ {0,3}```[ \t]*$/u;
const CHART_FENCE_TAG = "```openui-lang";

const pushMarkdown = (segments: AnswerSegment[], lines: string[]) => {
  const text = lines.join("\n").trim();

  if (text.length > 0) {
    segments.push({ kind: "markdown", text });
  }

  lines.length = 0;
};

const growsIntoChartFence = (line: string): boolean =>
  CHART_FENCE_TAG.startsWith(line.trimStart());

export const splitAnswer = (text: string): AnswerSegment[] => {
  const segments: AnswerSegment[] = [];
  const lines = text.split(/\r?\n/u);
  const lastLineIsFinished = text.endsWith("\n");
  const pending: string[] = [];
  let fence: "none" | "other" | "chart" = "none";

  for (const [index, line] of lines.entries()) {
    const last = index === lines.length - 1;

    if (fence === "chart") {
      if (FENCE_CLOSE.test(line)) {
        segments.push({
          closed: true,
          code: pending.join("\n"),
          kind: "chart",
        });

        pending.length = 0;
        fence = "none";
      } else {
        pending.push(line);
      }

      continue;
    }

    if (fence === "other") {
      pending.push(line);

      if (FENCE_CLOSE.test(line)) {
        fence = "none";
      }

      continue;
    }

    if (CHART_FENCE_OPEN.test(line)) {
      pushMarkdown(segments, pending);
      fence = "chart";

      continue;
    }

    if (last && !lastLineIsFinished && growsIntoChartFence(line)) {
      break;
    }

    pending.push(line);

    if (FENCE_OPEN.test(line)) {
      fence = "other";
    }
  }

  if (fence === "chart") {
    segments.push({ closed: false, code: pending.join("\n"), kind: "chart" });
  } else {
    pushMarkdown(segments, pending);
  }

  return segments;
};
