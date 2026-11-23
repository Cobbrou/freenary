import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { m } from "@/paraglide/messages.js";
import { client } from "@/shared/api";

import {
  notificationsQueryKey,
  notificationsQueryOptions,
} from "../api/notifications-query";
import type { NotificationEntry } from "./notification-groups";

type NotificationList = Awaited<ReturnType<typeof client.notifications.list>>;

const without = (
  list: NotificationList | undefined,
  ids: ReadonlySet<string>
): NotificationList | undefined =>
  list && {
    notifications: list.notifications.filter(
      (notification) => !ids.has(notification.id)
    ),
    unreadCount: Math.max(
      0,
      list.unreadCount -
        list.notifications.filter(
          (notification) => ids.has(notification.id) && !notification.isRead
        ).length
    ),
  };

const asRead = (
  list: NotificationList | undefined,
  ids: ReadonlySet<string>
): NotificationList | undefined =>
  list && {
    notifications: list.notifications.map((notification) =>
      ids.has(notification.id)
        ? { ...notification, isRead: true }
        : notification
    ),
    unreadCount: Math.max(
      0,
      list.unreadCount -
        list.notifications.filter(
          (notification) => ids.has(notification.id) && !notification.isRead
        ).length
    ),
  };

export const useNotifications = () => {
  const queryClient = useQueryClient();
  const query = useQuery(notificationsQueryOptions());
  const listKey = notificationsQueryOptions().queryKey;

  const patch = (
    change: (list: NotificationList | undefined) => NotificationList | undefined
  ) => queryClient.setQueryData<NotificationList>(listKey, change);

  const refresh = () =>
    queryClient.invalidateQueries({ queryKey: notificationsQueryKey() });

  const restore = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (ids: readonly string[]) =>
      Promise.all(ids.map((id) => client.notifications.restore({ id }))),
    onError: () => toast.error(m.notifications_update_error()),
    onSettled: refresh,
  });

  const offerUndo = (message: string, ids: readonly string[]) =>
    toast(message, {
      action: {
        label: m.notifications_undo(),
        onClick: () => restore.mutate(ids),
      },
    });

  const dismiss = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (notification: NotificationEntry) =>
      client.notifications.dismiss({ id: notification.id }),
    onError: () => toast.error(m.notifications_update_error()),
    onMutate: (notification) => {
      patch((list) => without(list, new Set([notification.id])));
    },
    onSettled: refresh,
    onSuccess: (_answer, notification) =>
      offerUndo(m.notifications_dismissed(), [notification.id]),
  });

  const dismissAll = useMutation({
    meta: { errorShownInline: true },
    mutationFn: () => client.notifications.dismissAll(),
    onError: () => toast.error(m.notifications_update_error()),
    onMutate: () => {
      const ids = (query.data?.notifications ?? []).map(
        (notification) => notification.id
      );

      patch((list) => without(list, new Set(ids)));

      return ids;
    },
    onSettled: refresh,
    onSuccess: (_answer, _request, ids) =>
      offerUndo(m.notifications_dismissed_all(), ids),
  });

  const markRead = useMutation({
    meta: { errorShownInline: true },
    mutationFn: (notification: NotificationEntry) =>
      client.notifications.markRead({ id: notification.id }),
    onMutate: (notification) => {
      patch((list) => asRead(list, new Set([notification.id])));
    },
    onSettled: refresh,
  });

  const markAllRead = useMutation({
    meta: { errorShownInline: true },
    mutationFn: () => client.notifications.markAllRead(),
    onSuccess: () => {
      patch((list) => list && { ...list, unreadCount: 0 });
    },
  });

  return {
    dismiss: dismiss.mutate,
    dismissAll: () => dismissAll.mutate(),
    markAllRead: () => markAllRead.mutate(),
    markRead: markRead.mutate,
    notifications: query.data?.notifications ?? [],
    query,
    refresh,
    unreadCount: query.data?.unreadCount ?? 0,
  };
};
