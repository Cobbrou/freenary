import { Button } from "@freenary/ui/components/button";
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from "@freenary/ui/components/popover";
import {
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@freenary/ui/components/sidebar";
import { Skeleton } from "@freenary/ui/components/skeleton";
import { RiNotificationOffLine } from "@remixicon/react";
import { Bell } from "kubai-icons-react";
import { useId, useRef, useState } from "react";
import type { Ref } from "react";

import { m } from "@/paraglide/messages.js";
import { useNow } from "@/shared/lib/calendar-day";
import { CHART_COLOR_VARS } from "@/shared/lib/chart-colors";
import { kubaiIcon } from "@/shared/lib/kubai-icon";

import { groupsOf } from "../model/notification-groups";
import type {
  NotificationEntry,
  NotificationGroup,
} from "../model/notification-groups";
import { useNotifications } from "../model/use-notifications";
import { NotificationBundle, NotificationItem } from "./notification-item";

const BellIcon = kubaiIcon(Bell, CHART_COLOR_VARS.grey);

const SKELETON_ROWS = ["first", "second", "third"] as const;

const MAX_BADGE = 99;

type Center = ReturnType<typeof useNotifications>;

const GroupList = ({
  group,
  now,
  onDismiss,
  onOpen,
}: {
  group: NotificationGroup;
  now: Date;
  onDismiss: (notification: NotificationEntry) => void;
  onOpen: (notification: NotificationEntry) => void;
}) => {
  const labelId = useId();

  return (
    <section aria-labelledby={labelId} className="flex flex-col">
      <h3
        className="bg-popover text-muted-foreground sticky top-0 z-10 flex gap-1.5 px-2.5 pt-2 pb-0.5 text-[11px] leading-[14px] font-normal"
        id={labelId}
      >
        {group.isRead
          ? m.notifications_group_read()
          : m.notifications_group_unread()}
        <span className="opacity-70">{group.total}</span>
      </h3>
      <ul className="flex flex-col">
        {group.rows.map((row) =>
          row.kind === "item" ? (
            <NotificationItem
              key={row.notification.id}
              notification={row.notification}
              now={now}
              onDismiss={onDismiss}
              onOpen={onOpen}
            />
          ) : (
            <NotificationBundle
              key={row.key}
              notifications={row.notifications}
              now={now}
              onDismiss={onDismiss}
              onOpen={onOpen}
            />
          )
        )}
      </ul>
    </section>
  );
};

const PanelBody = ({
  center,
  listRef,
  onDismiss,
  onOpen,
}: {
  center: Center;
  listRef: Ref<HTMLDivElement>;
  onDismiss: (notification: NotificationEntry) => void;
  onOpen: (notification: NotificationEntry) => void;
}) => {
  const now = useNow();

  if (center.query.isPending) {
    return (
      <div aria-busy="true" className="flex flex-col gap-1 p-3">
        <output className="sr-only">{m.notifications_loading()}</output>
        {SKELETON_ROWS.map((row) => (
          <div aria-hidden="true" className="flex gap-2.5 py-1.5" key={row}>
            <Skeleton className="size-6 shrink-0 rounded-full" />
            <div className="flex flex-1 flex-col gap-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (center.query.isError) {
    return (
      <div className="flex flex-col items-start gap-2 p-4">
        <p className="text-muted-foreground text-sm">
          {m.notifications_error()}
        </p>
        <Button
          loading={center.query.isFetching}
          onClick={() => {
            void center.query.refetch();
          }}
          size="compact"
          variant="secondary"
        >
          {m.notifications_retry()}
        </Button>
      </div>
    );
  }

  if (center.notifications.length === 0) {
    return (
      <div className="flex flex-col items-center gap-1 px-4 pt-7 pb-8 text-center">
        <span
          aria-hidden="true"
          className="bg-muted text-muted-foreground mb-2 flex size-8 items-center justify-center rounded-full"
        >
          <RiNotificationOffLine className="size-4" />
        </span>
        <p className="text-foreground text-[13px] font-medium">
          {m.notifications_empty_title()}
        </p>
        <p className="text-muted-foreground text-xs">
          {m.notifications_empty_description()}
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex max-h-[min(520px,calc(100svh-6rem))] flex-col overflow-y-auto overscroll-contain px-1 pt-0.5 pb-1"
      ref={listRef}
    >
      {groupsOf(center.notifications).map((group) => (
        <GroupList
          group={group}
          key={group.isRead ? "read" : "unread"}
          now={now}
          onDismiss={onDismiss}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
};

const nextFocusTarget = (
  list: HTMLDivElement | null,
  dismissedId: string
): HTMLElement | null => {
  const openers = [
    ...(list?.querySelectorAll<HTMLElement>(
      "[data-notification-id] > [data-notification-open]"
    ) ?? []),
  ];

  const index = openers.findIndex(
    (opener) => opener.parentElement?.dataset.notificationId === dismissedId
  );

  return openers[index + 1] ?? openers[index - 1] ?? null;
};

export const NotificationCenter = ({
  onOpen,
  triggerRef,
}: {
  onOpen: (notification: NotificationEntry) => void;
  triggerRef?: Ref<HTMLButtonElement>;
}) => {
  const center = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const hasUnread = center.unreadCount > 0;
  const hasAny = center.notifications.length > 0;

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);

    if (open && hasUnread) {
      center.markAllRead();
    }

    if (!open) {
      void center.refresh();
    }
  };

  const handleOpen = (notification: NotificationEntry) => {
    if (!notification.isRead) {
      center.markRead(notification);
    }

    handleOpenChange(false);
    onOpen(notification);
  };

  const handleDismiss = (notification: NotificationEntry) => {
    const target = nextFocusTarget(listRef.current, notification.id);

    center.dismiss(notification);
    (target ?? popupRef.current)?.focus();
  };

  return (
    <SidebarMenuItem>
      <Popover onOpenChange={handleOpenChange} open={isOpen}>
        <PopoverTrigger
          render={
            <SidebarMenuButton
              aria-label={
                hasUnread
                  ? m.nav_notifications_unread({ count: center.unreadCount })
                  : undefined
              }
              icon={BellIcon}
              isActive={isOpen}
              ref={triggerRef}
            />
          }
        >
          {m.nav_notifications()}
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[360px] max-w-[calc(100vw-1rem)] gap-0 overflow-hidden rounded-xl p-0"
          ref={popupRef}
          side="right"
          sideOffset={24}
          tabIndex={-1}
        >
          <div className="border-border flex h-10 shrink-0 items-center gap-1 border-b ps-3.5 pe-1.5">
            <PopoverTitle className="text-foreground min-w-0 flex-1 truncate text-sm font-medium">
              {m.notifications_title()}
            </PopoverTitle>
            {hasAny ? (
              <Button
                onClick={() => {
                  center.dismissAll();
                  popupRef.current?.focus();
                }}
                size="compact"
                variant="ghost"
              >
                {m.notifications_dismiss_all()}
              </Button>
            ) : null}
          </div>
          <PanelBody
            center={center}
            listRef={listRef}
            onDismiss={handleDismiss}
            onOpen={handleOpen}
          />
        </PopoverContent>
      </Popover>
      {hasUnread ? (
        <SidebarMenuBadge
          aria-hidden="true"
          className="bg-primary text-primary-foreground top-1/2 -translate-y-1/2 rounded-full"
        >
          {center.unreadCount > MAX_BADGE
            ? `${MAX_BADGE}+`
            : center.unreadCount}
        </SidebarMenuBadge>
      ) : null}
    </SidebarMenuItem>
  );
};
