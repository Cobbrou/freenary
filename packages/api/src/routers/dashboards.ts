import prisma from "@freenary/db";
import type { Prisma } from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { ownedConversation } from "../assistant/conversation";
import {
  dashboardTitleSchema,
  dashboardWidgetsSchema,
  dashboardWidgetSchema,
  MAX_DASHBOARDS,
} from "../dashboards/widgets";
import type { DashboardWidget } from "../dashboards/widgets";
import { protectedProcedure } from "../index";

const dashboardInput = z.object({ dashboardId: z.string().max(64) });

/* SAFETY: a widget is a plain object of strings, numbers and string arrays,
   parsed by `dashboardWidgetSchema`; nothing in it is a Date, a class or a
   function, which is all `Prisma.InputJsonObject` excludes. */
const asJson = (widgets: DashboardWidget[]): Prisma.InputJsonArray =>
  widgets.map((widget) => widget as Prisma.InputJsonObject);

const storedWidgets = (stored: Prisma.JsonValue): DashboardWidget[] =>
  Array.isArray(stored)
    ? stored.flatMap((entry) => {
        const parsed = dashboardWidgetSchema.safeParse(entry);

        return parsed.success ? [parsed.data] : [];
      })
    : [];

const requireDashboard = async (userId: string, dashboardId: string) => {
  const dashboard = await prisma.dashboard.findFirst({
    select: {
      conversation: { select: { id: true, title: true } },
      id: true,
      title: true,
      updatedAt: true,
      widgets: true,
    },
    where: { id: dashboardId, userId },
  });

  if (!dashboard) {
    throw new ORPCError("NOT_FOUND", { message: "Dashboard not found" });
  }

  return dashboard;
};

export const dashboardsRouter = {
  create: protectedProcedure
    .input(
      z.object({
        conversationId: z.string().max(64).optional(),
        title: dashboardTitleSchema,
        widgets: dashboardWidgetsSchema,
      })
    )
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;

      const [count, conversation] = await Promise.all([
        prisma.dashboard.count({ where: { userId } }),
        input.conversationId === undefined
          ? null
          : ownedConversation(userId, input.conversationId),
      ]);

      if (count >= MAX_DASHBOARDS) {
        throw new ORPCError("BAD_REQUEST", {
          message: `A user keeps at most ${MAX_DASHBOARDS} dashboards`,
        });
      }

      const { id } = await prisma.dashboard.create({
        data: {
          conversationId: conversation?.id ?? null,
          title: input.title,
          userId,
          widgets: asJson(input.widgets),
        },
        select: { id: true },
      });

      return { dashboardId: id, title: input.title };
    }),

  delete: protectedProcedure
    .input(dashboardInput)
    .handler(async ({ context, input }) => {
      await prisma.dashboard.deleteMany({
        where: { id: input.dashboardId, userId: context.session.user.id },
      });

      return { ok: true };
    }),

  get: protectedProcedure
    .input(dashboardInput)
    .handler(async ({ context, input }) => {
      const dashboard = await requireDashboard(
        context.session.user.id,
        input.dashboardId
      );

      return { ...dashboard, widgets: storedWidgets(dashboard.widgets) };
    }),

  list: protectedProcedure.handler(async ({ context }) => {
    const dashboards = await prisma.dashboard.findMany({
      orderBy: { updatedAt: "desc" },
      select: { id: true, title: true, updatedAt: true, widgets: true },
      where: { userId: context.session.user.id },
    });

    return {
      dashboards: dashboards.map(({ widgets, ...dashboard }) => ({
        ...dashboard,
        widgetTypes: storedWidgets(widgets).map((widget) => widget.type),
      })),
    };
  }),

  update: protectedProcedure
    .input(
      dashboardInput.extend({
        title: dashboardTitleSchema.optional(),
        widgets: dashboardWidgetsSchema.optional(),
      })
    )
    .handler(async ({ context, input }) => {
      const dashboard = await requireDashboard(
        context.session.user.id,
        input.dashboardId
      );

      const updated = await prisma.dashboard.update({
        data: {
          title: input.title,
          widgets:
            input.widgets === undefined ? undefined : asJson(input.widgets),
        },
        select: { id: true, title: true },
        where: { id: dashboard.id },
      });

      return { dashboardId: updated.id, title: updated.title };
    }),
};
