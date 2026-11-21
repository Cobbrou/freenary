import { expect, test } from "bun:test";
import { access } from "node:fs/promises";
import path from "node:path";

import { MOVED_PAGES } from "./moved-pages";

const DOCS = path.join(import.meta.dir, "../../../../../docs");

test.each(Object.entries(MOVED_PAGES))(
  "%s moves to a page that exists",
  async (_before, after) => {
    expect(await access(path.join(DOCS, `${after}.md`)).then(() => true)).toBe(
      true
    );
  }
);
