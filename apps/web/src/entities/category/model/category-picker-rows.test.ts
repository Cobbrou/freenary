import { describe, expect, it } from "bun:test";

import {
  categoryPickerRowMatches,
  categoryPickerRows,
  withMatchRows,
} from "./category-picker-rows";

const outgoing = categoryPickerRows("outgoing");

describe("categoryPickerRows", () => {
  it("lists only the direction's categories", () => {
    expect(outgoing.some((row) => row.category === "salary")).toBe(false);
    expect(outgoing.some((row) => row.category === "groceries")).toBe(true);
    expect(outgoing.every((row) => row.value === row.category)).toBe(true);
    expect(outgoing.some((row) => row.isMatch)).toBe(false);
  });
});

describe("withMatchRows", () => {
  it("keeps the same rows when nothing matches", () => {
    expect(withMatchRows(outgoing, [])).toEqual(outgoing);
  });

  it("keeps every category row itself, so the selection stays put", () => {
    const rows = withMatchRows(outgoing, ["groceries"]);

    expect(rows.slice(0, outgoing.length)).toEqual(outgoing);
  });

  it("appends the matches after the categories", () => {
    const matches = withMatchRows(outgoing, ["groceries", "shopping"]).slice(
      outgoing.length
    );

    expect(matches.map((row) => [row.value, row.isMatch])).toEqual([
      ["match:groceries", true],
      ["match:shopping", true],
    ]);
  });

  it("drops matches the direction cannot take", () => {
    const rows = withMatchRows(outgoing, ["salary", "groceries"]);

    expect(rows.flatMap((row) => (row.isMatch ? [row.category] : []))).toEqual([
      "groceries",
    ]);
  });

  it("keeps the matches whatever is typed", () => {
    const kept = withMatchRows(outgoing, ["groceries"]).filter((row) =>
      categoryPickerRowMatches(row, "carrefour")
    );

    expect(kept.map((row) => row.value)).toEqual(["match:groceries"]);
  });
});
