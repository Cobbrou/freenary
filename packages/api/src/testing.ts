import { ORPCError, safe } from "@orpc/client";

import type { Context } from "./context";

const SIGNED_IN_AT = new Date("2026-01-01T00:00:00.000Z");

export const guestContext = (): Context => ({
  auth: null,
  headers: new Headers(),
  session: null,
});

export const contextOf = (
  userId: string,
  headers = new Headers()
): Context => ({
  auth: null,
  headers,
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

export const codeOf = async (answer: Promise<unknown>): Promise<string> => {
  const { error } = await safe(answer);

  if (error === null) {
    return "OK";
  }

  if (error instanceof ORPCError) {
    return error.code;
  }

  throw error;
};
