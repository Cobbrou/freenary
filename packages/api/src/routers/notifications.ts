import prisma from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import {
  effectiveCategory,
  pipelineCategory,
} from "../lib/transaction-category";
import { stillToCheck } from "../notifications/transactions-to-check";
import { isNotificationType, NOTIFICATION_TYPES } from "../notifications/types";

const DAY_MS = 24 * 60 * 60 * 1000;
const READ_RETENTION_MS = 30 * DAY_MS;
const UNDO_WINDOW_MS = DAY_MS;
const MAX_LISTED = 100;
const MAX_TO_CHECK = 500;

const notificationInput = z.object({ id: z.string().min(1).max(64) });

const ownedNotification = async (userId: string, id: string) => {
  const notification = await prisma.notification.findFirst({
    select: { id: true, type: true },
    where: { id, userId },
  });

  if (!notification) {
    throw new ORPCError("NOT_FOUND", { message: "Notification not found" });
  }

  return notification;
};

const forgetExpired = (userId: string, now: Date) =>
  prisma.notification.deleteMany({
    where: {
      OR: [
        { readAt: { lt: new Date(now.getTime() - READ_RETENTION_MS) } },
        { dismissedAt: { lt: new Date(now.getTime() - UNDO_WINDOW_MS) } },
      ],
      userId,
    },
  });

const listed = async (userId: string) => {
  const rows = await prisma.notification.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      _count: {
        select: { transactions: { where: { transaction: stillToCheck } } },
      },
      createdAt: true,
      id: true,
      readAt: true,
      type: true,
    },
    take: MAX_LISTED,
    where: { dismissedAt: null, userId },
  });

  const settled = rows.flatMap((row) =>
    row.type === NOTIFICATION_TYPES.transactionsToCheck &&
    row._count.transactions === 0
      ? [row.id]
      : []
  );

  if (settled.length > 0) {
    await prisma.notification.deleteMany({
      where: { id: { in: settled }, userId },
    });
  }

  return rows.flatMap((row) => {
    if (settled.includes(row.id) || !isNotificationType(row.type)) {
      return [];
    }

    return [
      {
        count: row._count.transactions,
        createdAt: row.createdAt.toISOString(),
        id: row.id,
        isRead: row.readAt !== null,
        type: row.type,
      },
    ];
  });
};

export const notificationsRouter = {
  clearTransactionsToCheck: protectedProcedure
    .input(notificationInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      await ownedNotification(userId, input.id);
      await prisma.notification.deleteMany({
        where: { id: input.id, userId },
      });

      return { id: input.id };
    }),

  dismiss: protectedProcedure
    .input(notificationInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      await ownedNotification(userId, input.id);
      await prisma.notification.updateMany({
        data: { dismissedAt: new Date() },
        where: { id: input.id, userId },
      });

      return { id: input.id };
    }),

  dismissAll: protectedProcedure.handler(async ({ context }) => {
    const { count } = await prisma.notification.updateMany({
      data: { dismissedAt: new Date() },
      where: { dismissedAt: null, userId: context.session.user.id },
    });

    return { count };
  }),

  list: protectedProcedure.handler(async ({ context }) => {
    const userId = context.session.user.id;

    await forgetExpired(userId, new Date());

    const notifications = await listed(userId);
    const unreadCount = await prisma.notification.count({
      where: { dismissedAt: null, readAt: null, userId },
    });

    return { notifications, unreadCount };
  }),

  markAllRead: protectedProcedure.handler(async ({ context }) => {
    const { count } = await prisma.notification.updateMany({
      data: { readAt: new Date() },
      where: {
        dismissedAt: null,
        readAt: null,
        userId: context.session.user.id,
      },
    });

    return { count };
  }),

  markRead: protectedProcedure
    .input(notificationInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      await ownedNotification(userId, input.id);
      await prisma.notification.updateMany({
        data: { readAt: new Date() },
        where: { id: input.id, readAt: null, userId },
      });

      return { id: input.id };
    }),

  restore: protectedProcedure
    .input(notificationInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      await ownedNotification(userId, input.id);
      await prisma.notification.updateMany({
        data: { dismissedAt: null },
        where: { id: input.id, userId },
      });

      return { id: input.id };
    }),

  transactionsToCheck: protectedProcedure
    .input(notificationInput)
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const notification = await ownedNotification(userId, input.id);

      if (notification.type !== NOTIFICATION_TYPES.transactionsToCheck) {
        throw new ORPCError("BAD_REQUEST", {
          message: "This notification is not about transactions to check",
        });
      }

      const transactions = await prisma.transaction.findMany({
        orderBy: [{ date: "desc" }, { id: "desc" }],
        select: {
          account: {
            select: {
              connection: { select: { institutionName: true } },
              name: true,
            },
          },
          amount: true,
          category: true,
          counterpartyName: true,
          currency: true,
          date: true,
          description: true,
          id: true,
          normalisedDescriptor: true,
          resolvedCategory: true,
        },
        take: MAX_TO_CHECK,
        where: {
          ...stillToCheck,
          account: { connection: { userId } },
          notifications: { some: { notificationId: input.id } },
        },
      });

      return {
        transactions: transactions.map((t) => ({
          accountName: t.account.name ?? t.account.connection.institutionName,
          amount: t.amount,
          category: effectiveCategory(t),
          counterpartyName: t.counterpartyName,
          currency: t.currency,
          date: t.date.toISOString(),
          derivedCategory: pipelineCategory(t),
          description: t.description,
          id: t.id,
          normalisedDescriptor: t.normalisedDescriptor,
        })),
      };
    }),
};
