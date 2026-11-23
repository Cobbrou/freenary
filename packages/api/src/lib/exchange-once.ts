import { ORPCError } from "@orpc/server";
import { Effect } from "effect";

export interface CallbackExchange<T> {
  readonly claim: () => Promise<boolean>;
  readonly exchange: () => Promise<T>;
  readonly findExchanged: () => Promise<T | null>;
  readonly nonce: string;
}

const exchangeOrFind = async <T>({
  claim,
  exchange,
  findExchanged,
}: CallbackExchange<T>): Promise<T> => {
  if (await claim()) {
    return await exchange();
  }

  const exchanged = await findExchanged();

  if (exchanged === null) {
    throw new ORPCError("BAD_REQUEST", {
      message: "Bank connection state has expired or was already used",
    });
  }

  return exchanged;
};

export const exchangeOnceWith = <T>() => {
  const inFlight = new Map<string, Promise<T>>();

  const run = (request: CallbackExchange<T>): Promise<T> =>
    Effect.runPromise(
      Effect.promise(() => exchangeOrFind(request)).pipe(
        Effect.ensuring(Effect.sync(() => inFlight.delete(request.nonce)))
      )
    );

  return (request: CallbackExchange<T>): Promise<T> => {
    const running = inFlight.get(request.nonce) ?? run(request);

    inFlight.set(request.nonce, running);

    return running;
  };
};
