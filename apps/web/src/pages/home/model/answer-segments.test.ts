import { describe, expect, it } from "bun:test";

import { splitAnswer } from "./answer-segments";

const program =
  'root = Card("Spending", [chart])\nchart = DonutChart(["A"], [1])';

describe("splitAnswer", () => {
  it("keeps a plain answer as one markdown segment", () => {
    expect(splitAnswer("You spent **12 €**.\n\nThat is all.")).toEqual([
      { kind: "markdown", text: "You spent **12 €**.\n\nThat is all." },
    ]);
  });

  it("lifts a closed openui-lang fence out of the prose", () => {
    const text = `You spent 12 €.\n\n\`\`\`openui-lang\n${program}\n\`\`\`\n\nOne more line.`;

    expect(splitAnswer(text)).toEqual([
      { kind: "markdown", text: "You spent 12 €." },
      { closed: true, code: program, kind: "chart" },
      { kind: "markdown", text: "One more line." },
    ]);
  });

  it("accepts the short openui tag", () => {
    expect(splitAnswer(`\`\`\`openui\n${program}\n\`\`\``)).toEqual([
      { closed: true, code: program, kind: "chart" },
    ]);
  });

  it("reports a fence still open as a chart in progress", () => {
    expect(splitAnswer(`Here it is:\n\`\`\`openui-lang\n${program}`)).toEqual([
      { kind: "markdown", text: "Here it is:" },
      { closed: false, code: program, kind: "chart" },
    ]);
  });

  it("holds back a last line that may still become the chart opener", () => {
    expect(splitAnswer("Here it is:\n```openui-la")).toEqual([
      { kind: "markdown", text: "Here it is:" },
    ]);

    expect(splitAnswer("Here it is:\n``")).toEqual([
      { kind: "markdown", text: "Here it is:" },
    ]);
  });

  it("leaves another fenced block in the markdown, closer included", () => {
    const text = "Run this:\n```bash\necho hi\n```\nDone.";

    expect(splitAnswer(text)).toEqual([{ kind: "markdown", text }]);
  });

  it("does not open a chart fence from inside another fence", () => {
    const text = "```text\n```openui-lang\nnot a chart\n```\n";

    expect(splitAnswer(text)).toEqual([
      { kind: "markdown", text: "```text\n```openui-lang\nnot a chart\n```" },
    ]);
  });

  it("splits CRLF text the same way", () => {
    expect(
      splitAnswer('Here:\r\n```openui-lang\r\nroot = Card("a", [])\r\n```\r\n')
    ).toEqual([
      { kind: "markdown", text: "Here:" },
      { closed: true, code: 'root = Card("a", [])', kind: "chart" },
    ]);
  });
});
