import { useCallback, useRef, useState } from "react";

import { NotificationCenter } from "@/features/notifications";
import type { NotificationEntry } from "@/features/notifications";
import { TransactionsToCheckDrawer } from "@/features/transaction-details";

export const SidebarNotifications = () => {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [reviewedId, setReviewedId] = useState<string | null>(null);
  const [isReviewOpen, setIsReviewOpen] = useState(false);

  const handleOpen = useCallback((notification: NotificationEntry) => {
    if (notification.type === "transactions_to_check") {
      setReviewedId(notification.id);
      setIsReviewOpen(true);
    }
  }, []);

  return (
    <>
      <NotificationCenter onOpen={handleOpen} triggerRef={triggerRef} />
      <TransactionsToCheckDrawer
        finalFocus={triggerRef}
        notificationId={reviewedId}
        onOpenChange={setIsReviewOpen}
        open={isReviewOpen}
      />
    </>
  );
};
