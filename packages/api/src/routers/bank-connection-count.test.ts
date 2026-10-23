import { describe, expect, it } from "bun:test";

import { call, ORPCError } from "@orpc/server";

import { bankConnectionCountWith } from "./bank-connection-count";

const OPERATOR = "operator";
const EVERY_MEMBERS_CONNECTIONS = 3;

const bankConnectionCount = bankConnectionCountWith({
  countConnections: () => Promise.resolve(EVERY_MEMBERS_CONNECTIONS),
  isOperatorAccount: (userId) => Promise.resolve(userId === OPERATOR),
});

const contextOf = (userId: string) => ({
  auth: null,
  headers: new Headers(),
  session: { session: {}, user: { id: userId } },
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
