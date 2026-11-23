import { RiQuestionMark } from "@remixicon/react";
import type { RemixiconComponentType } from "@remixicon/react";

import { m } from "@/paraglide/messages.js";

import type { NotificationEntry } from "./notification-groups";

interface NotificationContent {
  body: () => string;
  bundle: (count: number) => string;
  icon: RemixiconComponentType;
  toneClassName: string;
  title: (notification: NotificationEntry) => string;
}

const AMBER_TONE = "bg-warning/20 text-amber-700 dark:text-warning";

export const NOTIFICATION_CONTENT = {
  transactions_to_check: {
    body: () => m.notifications_to_check_body(),
    bundle: (count) => m.notifications_to_check_bundle({ count }),
    icon: RiQuestionMark,
    title: ({ count }) => m.notifications_to_check_title({ count }),
    toneClassName: AMBER_TONE,
  },
} as const satisfies Record<NotificationEntry["type"], NotificationContent>;

export const contentOf = (notification: NotificationEntry) =>
  NOTIFICATION_CONTENT[notification.type];
