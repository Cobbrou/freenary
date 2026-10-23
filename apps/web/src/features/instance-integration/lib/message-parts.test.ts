import { describe, expect, it } from "bun:test";

import { code, link, messageParts, strong } from "./message-parts";

const domainHelp = (inputs: { example: string; scheme: string }): string =>
  `Such as ${inputs.example}. Don't include ${inputs.scheme}.`;

const consoleStep = (inputs: { console: string }): string =>
  `${inputs.console} first`;

const repeated = (inputs: { term: string }): string =>
  `${inputs.term}, ${inputs.term}`;

describe("messageParts", () => {
  it("splits a message around each term, in message order", () => {
    expect(
      messageParts(domainHelp, {
        example: code("acme-sandbox"),
        scheme: strong("https://"),
      })
    ).toEqual([
      { emphasis: "plain", position: 0, text: "Such as " },
      { emphasis: "code", position: 1, text: "acme-sandbox" },
      { emphasis: "plain", position: 2, text: ". Don't include " },
      { emphasis: "strong", position: 3, text: "https://" },
      { emphasis: "plain", position: 4, text: "." },
    ]);
  });

  it("keeps two identical segments apart by their position", () => {
    const positions = messageParts(repeated, { term: code("x") }).map(
      (part) => part.position
    );

    expect(new Set(positions).size).toBe(positions.length);
  });

  it("drops the empty text around a term at either end", () => {
    expect(
      messageParts(consoleStep, {
        console: link("Powens console", "https://console.powens.com"),
      })
    ).toEqual([
      {
        emphasis: "link",
        href: "https://console.powens.com",
        position: 1,
        text: "Powens console",
      },
      { emphasis: "plain", position: 2, text: " first" },
    ]);
  });
});
