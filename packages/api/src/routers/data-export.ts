import { carriesApiKey } from "@freenary/auth/api-key";
import prisma from "@freenary/db";
import { ORPCError } from "@orpc/server";

import { protectedProcedure } from "../index";
import {
  DATA_EXPORT_FORMAT,
  DATA_EXPORT_HOLDING_SELECT,
  DATA_EXPORT_TRANSACTION_SELECT,
  DATA_EXPORT_VERSION,
  exportHolding,
  exportTransaction,
} from "../lib/data-export";
import type { DataExport } from "../lib/data-export";

const isoOrNull = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

const readConnections = (userId: string) =>
  prisma.bankConnection.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      accounts: {
        orderBy: { createdAt: "asc" },
        select: {
          balanceAt: true,
          balanceMinor: true,
          balances: {
            orderBy: { currency: "asc" },
            select: { balanceAt: true, balanceMinor: true, currency: true },
          },
          createdAt: true,
          currency: true,
          holdings: {
            orderBy: { providerHoldingId: "asc" },
            select: DATA_EXPORT_HOLDING_SELECT,
          },
          iban: true,
          id: true,
          identificationHash: true,
          inConsent: true,
          name: true,
          providerAccountId: true,
          transactions: {
            orderBy: [{ date: "asc" }, { id: "asc" }],
            select: DATA_EXPORT_TRANSACTION_SELECT,
          },
          type: true,
        },
      },
      createdAt: true,
      id: true,
      institutionBic: true,
      institutionCountry: true,
      institutionGroup: true,
      institutionId: true,
      institutionName: true,
      lastSyncedAt: true,
      provider: true,
      status: true,
    },
    where: { userId },
  });

type StoredConnection = Awaited<ReturnType<typeof readConnections>>[number];

const exportConnection = (connection: StoredConnection) => ({
  ...connection,
  accounts: connection.accounts.map((account) => ({
    ...account,
    balanceAt: isoOrNull(account.balanceAt),
    balances: account.balances.map((balance) => ({
      ...balance,
      balanceAt: isoOrNull(balance.balanceAt),
    })),
    createdAt: account.createdAt.toISOString(),
    holdings: account.holdings.map(exportHolding),
    transactions: account.transactions.map(exportTransaction),
  })),
  createdAt: connection.createdAt.toISOString(),
  lastSyncedAt: isoOrNull(connection.lastSyncedAt),
});

const readDataExport = async (
  userId: string,
  now: Date
): Promise<DataExport> => {
  const user = await prisma.user.findUnique({
    select: {
      budgetMonthAnchor: true,
      budgetMonthHolidayCountry: true,
      budgetMonthStartDay: true,
      createdAt: true,
      email: true,
      firstName: true,
      lastName: true,
      reportingCurrency: true,
      taxCountries: true,
    },
    where: { id: userId },
  });

  if (!user) {
    throw new ORPCError("NOT_FOUND", { message: "User not found" });
  }

  const [
    connections,
    customCategories,
    budgetLines,
    merchantOverrides,
    dashboards,
  ] = await Promise.all([
    readConnections(userId),
    prisma.customCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      select: {
        color: true,
        icon: true,
        id: true,
        label: true,
        parentId: true,
        parentSlug: true,
        sortOrder: true,
      },
      where: { userId },
    }),
    prisma.budgetLine.findMany({
      orderBy: { sortOrder: "asc" },
      select: {
        amount: true,
        categoryId: true,
        categorySlug: true,
        id: true,
        label: true,
        sortOrder: true,
      },
      where: { userId },
    }),
    prisma.merchantOverride.findMany({
      orderBy: { merchantKey: "asc" },
      select: { category: true, merchantKey: true, merchantName: true },
      where: { userId },
    }),
    prisma.dashboard.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        createdAt: true,
        id: true,
        title: true,
        updatedAt: true,
        widgets: true,
      },
      where: { userId },
    }),
  ]);

  return {
    budgetLines,
    connections: connections.map(exportConnection),
    customCategories,
    dashboards: dashboards.map((dashboard) => ({
      ...dashboard,
      createdAt: dashboard.createdAt.toISOString(),
      updatedAt: dashboard.updatedAt.toISOString(),
    })),
    exportedAt: now.toISOString(),
    format: DATA_EXPORT_FORMAT,
    merchantOverrides,
    user: { ...user, createdAt: user.createdAt.toISOString() },
    version: DATA_EXPORT_VERSION,
  };
};

export const dataExportRouter = {
  download: protectedProcedure.handler(async ({ context }) => {
    if (carriesApiKey(context.headers)) {
      throw new ORPCError("FORBIDDEN", {
        message: "An API key cannot export the account's data",
      });
    }

    return await readDataExport(context.session.user.id, new Date());
  }),
};
