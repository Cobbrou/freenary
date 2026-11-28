import prisma from "@freenary/db";

import { countedTransactionsWhere } from "../lib/budget-aggregates";
import { reviewYearOf } from "../lib/year-review";
import { NOTIFICATION_TYPES } from "./types";

export const raiseYearInReview = async (userId: string, now: Date) => {
  const year = reviewYearOf(now);

  if (year === null) {
    return;
  }

  const user = await prisma.user.findUniqueOrThrow({
    select: { yearInReviewNotifiedFor: true },
    where: { id: userId },
  });

  if ((user.yearInReviewNotifiedFor ?? 0) >= year) {
    return;
  }

  const hasYear = await prisma.transaction.findFirst({
    select: { id: true },
    where: countedTransactionsWhere(
      userId,
      new Date(Date.UTC(year, 0, 1)),
      new Date(Date.UTC(year + 1, 0, 1) - 1)
    ),
  });

  if (!hasYear) {
    return;
  }

  const claimed = await prisma.user.updateMany({
    data: { yearInReviewNotifiedFor: year },
    where: {
      OR: [
        { yearInReviewNotifiedFor: null },
        { yearInReviewNotifiedFor: { lt: year } },
      ],
      id: userId,
    },
  });

  if (claimed.count > 0) {
    await prisma.notification.create({
      data: { type: NOTIFICATION_TYPES.yearInReview, userId },
    });
  }
};
