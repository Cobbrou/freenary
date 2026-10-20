import { Option } from "effect";

export const MOCK_SESSION_PREFIX = "mock_";

const SESSION_BODY =
  /^(?<openedOn>\d{4}-\d{2}-\d{2})_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;

export const mockSessionCode = (openedOn: Date): string =>
  `${MOCK_SESSION_PREFIX}${openedOn.toISOString().slice(0, 10)}_${crypto.randomUUID()}`;

export const openedOnOf = (code: string): Option.Option<string> =>
  code.startsWith(MOCK_SESSION_PREFIX)
    ? Option.fromNullishOr(
        SESSION_BODY.exec(code.slice(MOCK_SESSION_PREFIX.length))?.groups
          ?.openedOn
      )
    : Option.none();
