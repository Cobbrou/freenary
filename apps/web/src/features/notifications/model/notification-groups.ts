import type { AppRouter } from "@freenary/api/routers/index";
import type { InferRouterOutputs } from "@orpc/server";

export type NotificationEntry =
  InferRouterOutputs<AppRouter>["notifications"]["list"]["notifications"][number];

export type NotificationRow =
  | { readonly kind: "item"; readonly notification: NotificationEntry }
  | {
      readonly kind: "bundle";
      readonly key: string;
      readonly notifications: readonly NotificationEntry[];
    };

export interface NotificationGroup {
  readonly isRead: boolean;
  readonly rows: readonly NotificationRow[];
  readonly total: number;
}

const BUNDLE_FROM = 2;

export const rowsOf = (
  notifications: readonly NotificationEntry[]
): NotificationRow[] => {
  const repeatsByType = new Map<string, NotificationEntry[]>();
  const rows: NotificationRow[] = [];

  for (const notification of notifications) {
    const repeats = repeatsByType.get(notification.type);

    if (repeats) {
      repeats.push(notification);
    } else {
      repeatsByType.set(notification.type, []);
      rows.push({ kind: "item", notification });
    }
  }

  return rows.flatMap<NotificationRow>((row) => {
    if (row.kind !== "item") {
      return [row];
    }

    const repeats = repeatsByType.get(row.notification.type) ?? [];

    if (repeats.length < BUNDLE_FROM) {
      return [
        row,
        ...repeats.map((notification): NotificationRow => ({
          kind: "item",
          notification,
        })),
      ];
    }

    return [
      row,
      {
        key: `${row.notification.type}-${row.notification.isRead ? "read" : "unread"}`,
        kind: "bundle",
        notifications: repeats,
      },
    ];
  });
};

export const groupsOf = (
  notifications: readonly NotificationEntry[]
): NotificationGroup[] =>
  [false, true].flatMap((isRead) => {
    const members = notifications.filter(
      (notification) => notification.isRead === isRead
    );

    return members.length === 0
      ? []
      : [{ isRead, rows: rowsOf(members), total: members.length }];
  });
