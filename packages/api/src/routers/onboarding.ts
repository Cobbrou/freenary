import prisma from "@freenary/db";
import { ORPCError } from "@orpc/server";
import { z } from "zod";

import { protectedProcedure } from "../index";
import { taxResidencyCountries } from "../lib/country-code";

export const onboardingRouter = {
  completeOnboarding: protectedProcedure
    .input(z.object({ taxCountries: taxResidencyCountries.min(1) }))
    .handler(async ({ context, input }) => {
      const userId = context.session.user.id;
      const bankConnectionCount = await prisma.bankConnection.count({
        where: { userId },
      });

      if (bankConnectionCount === 0) {
        throw new ORPCError("PRECONDITION_FAILED", {
          message: "Connect a bank before finishing onboarding",
        });
      }

      await prisma.user.update({
        data: {
          onboardingCompletedAt: new Date(),
          taxCountries: input.taxCountries,
        },
        where: { id: userId },
      });

      return { success: true as const };
    }),

  getStatus: protectedProcedure.handler(async ({ context }) => {
    const user = await prisma.user.findUniqueOrThrow({
      select: { onboardingCompletedAt: true, taxCountries: true },
      where: { id: context.session.user.id },
    });

    return {
      completed: user.onboardingCompletedAt !== null,
      taxCountries: user.taxCountries,
    };
  }),
};
