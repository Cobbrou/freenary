import { describe, expect, it } from "bun:test";

import { call } from "@orpc/server";

import type { Context } from "../context";
import { dataExportRouter } from "./data-export";

const SIGNED_IN_AT = new Date("2026-01-01T00:00:00.000Z");

const contextWith = (headers: Headers): Context => ({
  auth: null,
  headers,
  session: {
    session: {
      createdAt: SIGNED_IN_AT,
      expiresAt: SIGNED_IN_AT,
      id: "session-member",
      token: "token-member",
      updatedAt: SIGNED_IN_AT,
      userId: "member",
    },
    user: {
      createdAt: SIGNED_IN_AT,
      email: "member@example.test",
      emailVerified: true,
      id: "member",
      name: "member",
      updatedAt: SIGNED_IN_AT,
    },
  },
});

describe("dataExport.download", () => {
  it("refuses an API key", async () => {
    const refused = call(dataExportRouter.download, undefined, {
      context: contextWith(
        new Headers({ authorization: "Bearer fny_member_key" })
      ),
    });

    await expect(refused).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
