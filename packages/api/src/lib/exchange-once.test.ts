import { describe, expect, it } from "bun:test";

import { mockProvider } from "../providers/mock";
import { mockSessionCode } from "../providers/mock/session";
import { exchangeOnceWith } from "./exchange-once";

interface OpenedConnection {
  readonly id: string;
  readonly providerSessionId: string;
}

const callbackOf = (code: string) => {
  const opened: OpenedConnection[] = [];
  let isClaimed = false;

  return {
    callback: {
      claim: () => {
        const isFirst = !isClaimed;

        isClaimed = true;

        return Promise.resolve(isFirst);
      },
      exchange: async () => {
        const { providerSessionId } = await mockProvider.completeConnection({
          callbackParams: { code },
          user: null,
        });

        const connection = {
          id: `connection-${opened.length + 1}`,
          providerSessionId,
        };

        opened.push(connection);

        return connection;
      },
      findExchanged: () => Promise.resolve(opened[0] ?? null),
      nonce: "nonce-1",
    },
    opened,
  };
};

describe("exchangeOnceWith", () => {
  it("returns the first connection when the callback is replayed", async () => {
    const exchangeOnce = exchangeOnceWith<OpenedConnection>();
    const { callback, opened } = callbackOf(mockSessionCode(new Date()));

    const first = await exchangeOnce(callback);
    const replayed = await exchangeOnce(callback);

    expect(replayed).toEqual(first);
    expect(opened).toHaveLength(1);
  });

  it("joins an exchange that is still running", async () => {
    const exchangeOnce = exchangeOnceWith<OpenedConnection>();
    const { callback, opened } = callbackOf(mockSessionCode(new Date()));

    const [first, concurrent] = await Promise.all([
      exchangeOnce(callback),
      exchangeOnce(callback),
    ]);

    expect(concurrent).toEqual(first);
    expect(opened).toHaveLength(1);
  });

  it("refuses a used nonce that opened no connection", async () => {
    const exchangeOnce = exchangeOnceWith<OpenedConnection>();
    const { callback } = callbackOf("mock_forged");

    await expect(exchangeOnce(callback)).rejects.toThrow(
      "The mock bank callback carries no session code"
    );

    await expect(exchangeOnce(callback)).rejects.toThrow(
      "Bank connection state has expired or was already used"
    );
  });
});
