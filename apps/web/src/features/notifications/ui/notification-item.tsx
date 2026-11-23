import { cn } from "@freenary/ui/lib/utils";
import { RiArrowDownSLine, RiCloseLine } from "@remixicon/react";
import { useId, useState } from "react";

import { m } from "@/paraglide/messages.js";
import { getLocale } from "@/paraglide/runtime.js";

import { notificationTimeLabel } from "../lib/notification-time";
import { contentOf } from "../model/notification-content";
import type { NotificationEntry } from "../model/notification-groups";

const ROW_FOCUS =
  "outline-none focus-visible:outline-1 focus-visible:outline-offset-[-1px] focus-visible:outline-[color:var(--focus-ring,#6B97FF)]";

const TypeIcon = ({
  className,
  notification,
}: {
  className?: string;
  notification: NotificationEntry;
}) => {
  const { icon: Icon, toneClassName } = contentOf(notification);

  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-px flex size-6 shrink-0 items-center justify-center rounded-full",
        toneClassName,
        className
      )}
    >
      <Icon className="size-3.5" />
    </span>
  );
};

export const NotificationItem = ({
  notification,
  now,
  onDismiss,
  onOpen,
}: {
  notification: NotificationEntry;
  now: Date;
  onDismiss: (notification: NotificationEntry) => void;
  onOpen: (notification: NotificationEntry) => void;
}) => {
  const content = contentOf(notification);
  const title = content.title(notification);

  return (
    <li className="relative" data-notification-id={notification.id}>
      <button
        className={cn(
          "hover:bg-hover active:bg-active flex w-full gap-2.5 rounded-lg py-2 ps-2.5 pe-8 text-start transition-colors duration-80",
          ROW_FOCUS
        )}
        data-notification-open=""
        onClick={() => onOpen(notification)}
        type="button"
      >
        <TypeIcon notification={notification} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-baseline gap-2">
            <span
              className={cn(
                "min-w-0 flex-1 truncate text-[13px] leading-[18px]",
                notification.isRead
                  ? "text-muted-foreground"
                  : "text-foreground font-medium"
              )}
            >
              {title}
            </span>
            <span className="text-muted-foreground shrink-0 text-[11px] leading-[14px] whitespace-nowrap tabular-nums">
              {notificationTimeLabel(
                new Date(notification.createdAt),
                now,
                getLocale()
              )}
            </span>
          </span>
          <span className="text-muted-foreground line-clamp-2 text-xs">
            {content.body()}
          </span>
        </span>
      </button>
      <button
        aria-label={m.notifications_dismiss({ title })}
        className={cn(
          "text-muted-foreground hover:text-foreground absolute end-1.5 top-1.5 flex size-[22px] items-center justify-center rounded-md transition-colors duration-80 hover:bg-[var(--tint)]",
          ROW_FOCUS
        )}
        onClick={() => onDismiss(notification)}
        title={m.notifications_dismiss_tooltip()}
        type="button"
      >
        <RiCloseLine aria-hidden="true" className="size-3" />
      </button>
    </li>
  );
};

export const NotificationBundle = ({
  notifications,
  now,
  onDismiss,
  onOpen,
}: {
  notifications: readonly NotificationEntry[];
  now: Date;
  onDismiss: (notification: NotificationEntry) => void;
  onOpen: (notification: NotificationEntry) => void;
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const listId = useId();
  const [first] = notifications;

  if (!first) {
    return null;
  }

  return (
    <li>
      <button
        aria-controls={listId}
        aria-expanded={isExpanded}
        className={cn(
          "hover:bg-hover active:bg-active text-muted-foreground flex w-full items-center gap-2.5 rounded-lg py-2 ps-2.5 pe-2 text-start text-[13px] leading-[18px] transition-colors duration-80",
          ROW_FOCUS
        )}
        onClick={() => setIsExpanded((expanded) => !expanded)}
        type="button"
      >
        <TypeIcon className="opacity-60" notification={first} />
        <span className="min-w-0 flex-1">
          {contentOf(first).bundle(notifications.length)}
        </span>
        <RiArrowDownSLine
          aria-hidden="true"
          className={cn(
            "size-4 shrink-0 transition-transform duration-150 motion-reduce:transition-none",
            isExpanded && "rotate-180"
          )}
        />
      </button>
      {isExpanded ? (
        <ul className="flex flex-col" id={listId}>
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              now={now}
              onDismiss={onDismiss}
              onOpen={onOpen}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
};
