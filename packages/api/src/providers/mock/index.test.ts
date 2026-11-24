import { describe, expect, it } from "bun:test";

import { mockProvider } from "./index";
import { mockSessionCode } from "./session";

describe("mock provider", () => {
  it("opens a connection for a code its consent page issued", async () => {
    const code = mockSessionCode(new Date("2026-10-20T15:00:00Z"));
    const completed = await mockProvider.completeConnection({
      callbackParams: { code, state: "signed-state" },
      user: null,
    });

    expect(completed.providerSessionId).toBe(code);
    expect(completed.accounts.length).toBeGreaterThanOrEqual(2);
  });

  it("keeps the session and its accounts when a connection reopens", async () => {
    const opened = mockSessionCode(new Date("2026-07-20T15:00:00Z"));
    const reopened = await mockProvider.completeConnection({
      callbackParams: {
        code: mockSessionCode(new Date("2026-10-20T15:00:00Z")),
        state: "signed-state",
      },
      providerSessionId: opened,
      user: null,
    });

    expect(reopened).toEqual(
      await mockProvider.completeConnection({
        callbackParams: { code: opened, state: "signed-state" },
        user: null,
      })
    );
  });

  it("refuses a callback with a code it did not issue", async () => {
    await expect(
      mockProvider.completeConnection({
        callbackParams: { code: "mock_forged", state: "signed-state" },
        user: null,
      })
    ).rejects.toThrow("The mock bank callback carries no session code");
  });
});
