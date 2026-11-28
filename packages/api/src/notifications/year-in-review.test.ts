import { beforeAll, describe, expect, it } from "bun:test";
import { randomUUID } from "node:crypto";

import prisma from "@freenary/db";
import { startTestDatabase } from "@freenary/db/testing";

import { NOTIFICATION_TYPES } from "./types";
import { raiseYearInReview } from "./year-in-review";

const DECEMBER_TWENTIETH = new Date("2026-12-20T12:00:00.000Z");

const createUser = async (bookedOn: Date | null): Promise<string> => {
  const id = `review-${randomUUID()}`;

  await prisma.user.create({
    data: { email: `${id}@example.test`, firstName: "Review", id },
  });

  await prisma.bankConnection.create({
    data: {
      accounts: {
        create: {
          currency: "EUR",
          name: "Checking",
          providerAccountId: `checking-${id}`,
          transactions: {
            create:
              bookedOn === null
                ? []
                : [
                    {
                      amount: -1250,
                      currency: "EUR",
                      date: bookedOn,
                      description: "BAKERY",
                    },
                  ],
          },
          type: "CHECKING",
        },
      },
      institutionCountry: "FR",
      institutionId: "mock-bank",
      institutionName: "Mock Bank",
      provider: "mock",
      providerSessionId: id,
      userId: id,
    },
  });

  return id;
};

const reviewNotificationsOf = (userId: string) =>
  prisma.notification.count({
    where: { type: NOTIFICATION_TYPES.yearInReview, userId },
  });

beforeAll(async () => {
  await startTestDatabase();
});

describe("raiseYearInReview", () => {
  it("notifies once per year while the review is open", async () => {
    const userId = await createUser(new Date("2026-03-01T00:00:00.000Z"));

    await raiseYearInReview(userId, DECEMBER_TWENTIETH);
    await raiseYearInReview(userId, DECEMBER_TWENTIETH);

    expect(await reviewNotificationsOf(userId)).toBe(1);
  });

  it("does not notify again after the notification is gone", async () => {
    const userId = await createUser(new Date("2026-03-01T00:00:00.000Z"));

    await raiseYearInReview(userId, DECEMBER_TWENTIETH);
    await prisma.notification.deleteMany({ where: { userId } });
    await raiseYearInReview(userId, new Date("2027-01-20T00:00:00.000Z"));

    expect(await reviewNotificationsOf(userId)).toBe(0);
  });

  it("stays quiet outside the window and for a year without transactions", async () => {
    const withYear = await createUser(new Date("2026-03-01T00:00:00.000Z"));
    const withoutYear = await createUser(new Date("2025-03-01T00:00:00.000Z"));

    await raiseYearInReview(withYear, new Date("2026-11-30T00:00:00.000Z"));
    await raiseYearInReview(withoutYear, DECEMBER_TWENTIETH);

    expect(await reviewNotificationsOf(withYear)).toBe(0);
    expect(await reviewNotificationsOf(withoutYear)).toBe(0);
  });
});
