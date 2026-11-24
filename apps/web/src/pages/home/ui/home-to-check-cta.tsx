import { Button } from "@freenary/ui/components/button";
import { RiErrorWarningLine } from "@remixicon/react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";

import { notificationsQueryOptions } from "@/features/notifications";
import { m } from "@/paraglide/messages.js";

export const HomeToCheckCta = () => {
  const notifications = useQuery(notificationsQueryOptions());
  const toCheck = notifications.data?.notifications.find(
    (notification) =>
      notification.type === "transactions_to_check" && notification.count > 0
  );

  if (!toCheck) {
    return null;
  }

  return (
    <div className="bg-card flex w-full flex-wrap items-center gap-3 rounded-xl border p-3 ps-4 text-start shadow-xs">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400">
        <RiErrorWarningLine aria-hidden="true" className="size-4" />
      </span>
      <div className="flex min-w-0 flex-1 basis-48 flex-col">
        <span className="text-sm font-medium">
          {m.notifications_to_check_title({ count: toCheck.count })}
        </span>
        <span className="text-muted-foreground text-xs">
          {m.notifications_to_check_body()}
        </span>
      </div>
      <Button
        className="ms-auto"
        render={
          <Link search={{ check: toCheck.id }} to="/budget/transactions" />
        }
        size="compact"
        variant="secondary"
      >
        {m.home_to_check_cta()}
      </Button>
    </div>
  );
};
