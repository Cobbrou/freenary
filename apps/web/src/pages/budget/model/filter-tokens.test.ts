import { describe, expect, it } from "bun:test";

import type { TransactionFilter } from "@freenary/api/lib/transaction-filters";

import {
  companySuggestions,
  fieldSuggestions,
  highlightsByDefault,
  lastWordOf,
  operatorSuggestions,
  withoutLastWord,
} from "./filter-suggestions";
import {
  filterTokenText,
  highlightedChartCategories,
  searchKey,
  selectChartCategory,
} from "./filter-tokens";

const overFifty: TransactionFilter = {
  field: "amount",
  operator: "gt",
  value: 5000,
};

const isGroceries: TransactionFilter = {
  field: "category",
  operator: "is",
  values: ["groceries"],
};

describe("selectChartCategory", () => {
  it("replaces every category filter with the picked one", () => {
    expect(
      selectChartCategory(
        [
          overFifty,
          { field: "category", operator: "isNot", values: ["rent-mortgage"] },
        ],
        { category: "groceries", kind: "category" }
      )
    ).toEqual([overFifty, isGroceries]);
  });

  it("clears the category when the chart part is picked again", () => {
    expect(
      selectChartCategory([isGroceries, overFifty], {
        category: "groceries",
        kind: "category",
      })
    ).toEqual([overFifty]);
  });

  it("clears the category when the chart drops its selection", () => {
    expect(selectChartCategory([isGroceries, overFifty], null)).toEqual([
      overFifty,
    ]);
  });
});

describe("highlightedChartCategories", () => {
  it("highlights the categories a filter keeps, never a group or an exclusion", () => {
    expect(
      highlightedChartCategories([
        {
          field: "category",
          operator: "isAnyOf",
          values: ["spending", "taxes"],
        },
        { field: "category", operator: "isNot", values: ["groceries"] },
        overFifty,
      ])
    ).toEqual(["taxes"]);
  });
});

describe("searchKey", () => {
  it("ignores the order of filters and of their values", () => {
    const companies: TransactionFilter = {
      field: "company",
      operator: "isAnyOf",
      values: ["Uber", "Amazon"],
    };

    expect(searchKey([overFifty, companies], " uber ")).toBe(
      searchKey(
        [{ ...companies, values: ["Amazon", "Uber"] }, overFifty],
        "uber"
      )
    );

    expect(searchKey([overFifty], "")).not.toBe(searchKey([overFifty], "x"));
  });
});

describe("filterTokenText", () => {
  it("joins several values as alternatives", () => {
    expect(
      filterTokenText(
        { field: "company", operator: "isAnyOf", values: ["Uber", "Lyft"] },
        "en"
      ).value
    ).toBe("Uber or Lyft");
  });
});

describe("suggestions", () => {
  it("offers the fields that start with the last typed word", () => {
    expect(fieldSuggestions("").map((s) => s.label)).toEqual([
      "Company",
      "Category",
      "Amount",
    ]);

    expect(fieldSuggestions("CA").map((s) => s.label)).toEqual(["Category"]);
    expect(fieldSuggestions("uber")).toEqual([]);
  });

  it("reads and drops the last word of the free text", () => {
    expect(lastWordOf("uber ca")).toBe("ca");
    expect(lastWordOf("uber ")).toBe("");
    expect(withoutLastWord("uber ca")).toBe("uber");
  });

  it("matches an amount comparison by its symbol", () => {
    expect(operatorSuggestions("amount", ">").map((s) => s.kind)).toEqual([
      "operator",
    ]);

    expect(operatorSuggestions("company", "")).toHaveLength(3);
  });

  it("keeps a picked company listed when the search no longer finds it", () => {
    const rows = companySuggestions(
      {
        field: "company",
        operator: "isAnyOf",
        stage: "values",
        values: ["Amazon"],
      },
      ["Uber"],
      ""
    );

    expect(
      rows.map((row) => [row.label, row.kind === "company" && row.picked])
    ).toEqual([
      ["Amazon", true],
      ["Uber", false],
    ]);
  });

  it("leaves nothing highlighted while free text could be submitted as is", () => {
    expect(highlightsByDefault(null, "uber")).toBe(false);

    expect(
      highlightsByDefault(
        {
          field: "company",
          operator: "isAnyOf",
          stage: "values",
          values: ["Uber"],
        },
        ""
      )
    ).toBe(false);

    expect(
      highlightsByDefault({ field: "amount", stage: "operator" }, "")
    ).toBe(true);
  });
});
