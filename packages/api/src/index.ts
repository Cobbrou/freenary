import prisma from "@freenary/db";
import { ORPCError, os } from "@orpc/server";

import type { Context } from "./context";

export const o = os.$context<Context>();

export const publicProcedure = o;

const requireAuth = o.middleware(({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  return next({
    context: {
      session: context.session,
    },
  });
});

export const protectedProcedure = publicProcedure.use(requireAuth);

export const isOperator = async (userId: string): Promise<boolean> => {
  const account = await prisma.user.findUnique({
    select: { role: true },
    where: { id: userId },
  });

  return account?.role === "OPERATOR";
};

const requireOperator = o.middleware(async ({ context, next }) => {
  if (!context.session?.user) {
    throw new ORPCError("UNAUTHORIZED");
  }

  if (!(await isOperator(context.session.user.id))) {
    throw new ORPCError("FORBIDDEN");
  }

  return next({ context: { session: context.session } });
});

export const operatorProcedure = publicProcedure.use(requireOperator);
