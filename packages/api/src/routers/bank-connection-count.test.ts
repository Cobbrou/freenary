import { describe, expect, it } from "bun:test";

import { call, ORPCError } from "@orpc/server";

import type { Context } from "../context";
import { bankConnectionCountWith } from "./bank-connection-count";

const OPERATOR = "operator";
const EVERY_MEMBERS_CONNECTIONS = 3;

const bankConnectionCount = bankConnectionCountWith({
  countConnections: () => Promise.resolve(EVERY_MEMBERS_CONNECTIONS),
  isOperatorAccount: (userId) => Promise.resolve(userId === OPERATOR),
});

const SIGNED_IN_AT = new Date("2026-01-01T00:00:00.000Z");

const contextOf = (userId: string): Context => ({
  auth: null,
  headers: new Headers(),
  session: {
    session: {
      createdAt: SIGNED_IN_AT,
      expiresAt: SIGNED_IN_AT,
      id: `session-${userId}`,
      token: `token-${userId}`,
      updatedAt: SIGNED_IN_AT,
      userId,
    },
    user: {
      createdAt: SIGNED_IN_AT,
      email: `${userId}@example.test`,
      emailVerified: true,
      id: userId,
      name: userId,
      updatedAt: SIGNED_IN_AT,
    },
  },
});

describe("instance.bankConnectionCount", () => {
  it("counts the bank connections of every member for the operator", async () => {
    expect(
      await call(bankConnectionCount, undefined, {
        context: contextOf(OPERATOR),
      })
    ).toEqual({ count: EVERY_MEMBERS_CONNECTIONS });
  });

  it("refuses a member who is not the operator", async () => {
    const refused = call(bankConnectionCount, undefined, {
      context: contextOf("member"),
    });

    await expect(refused).rejects.toBeInstanceOf(ORPCError);
    await expect(refused).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
