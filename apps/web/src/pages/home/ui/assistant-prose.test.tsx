import { expect, it } from "bun:test";

import { renderToStaticMarkup } from "react-dom/server";

import { AssistantProse } from "./assistant-prose";

it("drops a Markdown image instead of rendering it", () => {
  const html = renderToStaticMarkup(
    <AssistantProse>
      Done ![x](https://example.com/pixel.png?d=test)
      [link](https://example.com)
    </AssistantProse>
  );

  expect(html).not.toContain("<img");
  expect(html).not.toContain("pixel.png");
  expect(html).toContain('href="https://example.com"');
});
