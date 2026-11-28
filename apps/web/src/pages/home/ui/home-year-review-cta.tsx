import { Button } from "@freenary/ui/components/button";
import { RiSparkling2Line } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import {
  notificationsQueryOptions,
  reviewedYearOf,
} from "@/features/notifications";
import { m } from "@/paraglide/messages.js";

export const HomeYearReviewCta = () => {
  const notifications = useQuery(notificationsQueryOptions());
  const review = notifications.data?.notifications.find(
    (notification) => notification.type === "year_in_review"
  );

  if (!review) {
    return null;
  }

  const year = reviewedYearOf(review);

  return (
    <div className="bg-card flex w-full flex-wrap items-center gap-3 rounded-xl border p-3 ps-4 text-start shadow-xs">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-pink-500/15 text-pink-700 dark:text-pink-300">
        <RiSparkling2Line aria-hidden="true" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-sm font-medium">
          {m.notifications_year_review_title({ year: String(year) })}
        </span>
        <span className="text-muted-foreground text-xs">
          {m.notifications_year_review_body()}
        </span>
      </div>
      <Button
        className="ms-auto"
        render={<Link search={{ year }} to="/year-in-review" />}
        size="compact"
        variant="secondary"
      >
        {m.home_year_review_cta()}
      </Button>
    </div>
  );
};
