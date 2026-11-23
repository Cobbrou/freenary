import { describe, expect, it } from "bun:test";

import { groupsOf, rowsOf } from "./notification-groups";
import type { NotificationEntry } from "./notification-groups";

const entry = (
  id: string,
  overrides: Partial<NotificationEntry> = {}
): NotificationEntry => ({
  count: 3,
  createdAt: "2026-11-20T08:02:00.000Z",
  id,
  isRead: false,
  type: "transactions_to_check",
  ...overrides,
});

describe("groupsOf", () => {
  it("puts unread notifications before read ones and drops an empty group", () => {
    const groups = groupsOf([entry("a", { isRead: true }), entry("b")]);

    expect(groups.map((group) => [group.isRead, group.total])).toEqual([
      [false, 1],
      [true, 1],
    ]);

    expect(groupsOf([entry("a", { isRead: true })])).toHaveLength(1);
  });
});

describe("rowsOf", () => {
  it("keeps a single repeat of a type as its own row", () => {
    expect(rowsOf([entry("a"), entry("b")]).map((row) => row.kind)).toEqual([
      "item",
      "item",
    ]);
  });

  it("bundles two or more repeats of a type under its newest notification", () => {
    const rows = rowsOf([entry("a"), entry("b"), entry("c")]);

    expect(rows.map((row) => row.kind)).toEqual(["item", "bundle"]);
    expect(
      rows[1]?.kind === "bundle"
        ? rows[1].notifications.map((notification) => notification.id)
        : []
    ).toEqual(["b", "c"]);
  });
});
