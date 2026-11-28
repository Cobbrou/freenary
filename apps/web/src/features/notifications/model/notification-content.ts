import { RiQuestionMark, RiSparkling2Line } from "@remixicon/react";
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

const PINK_TONE = "bg-pink-500/15 text-pink-700 dark:text-pink-300";

const DECEMBER = 11;

export const reviewedYearOf = ({ createdAt }: NotificationEntry): number => {
  const raised = new Date(createdAt);

  return raised.getUTCMonth() === DECEMBER
    ? raised.getUTCFullYear()
    : raised.getUTCFullYear() - 1;
};

export const NOTIFICATION_CONTENT = {
  transactions_to_check: {
    body: () => m.notifications_to_check_body(),
    bundle: (count) => m.notifications_to_check_bundle({ count }),
    icon: RiQuestionMark,
    title: ({ count }) => m.notifications_to_check_title({ count }),
    toneClassName: AMBER_TONE,
  },
  year_in_review: {
    body: () => m.notifications_year_review_body(),
    bundle: (count) => m.notifications_year_review_bundle({ count }),
    icon: RiSparkling2Line,
    title: (notification) =>
      m.notifications_year_review_title({
        year: String(reviewedYearOf(notification)),
      }),
    toneClassName: PINK_TONE,
  },
} as const satisfies Record<NotificationEntry["type"], NotificationContent>;

export const contentOf = (notification: NotificationEntry) =>
  NOTIFICATION_CONTENT[notification.type];
