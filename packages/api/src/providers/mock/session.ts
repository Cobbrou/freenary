import { Option } from "effect";

export const MOCK_SESSION_PREFIX = "mock_";
export const FIXTURE_SESSION_PREFIX = "fixture_";
export const SESSION_ACCOUNT_SEPARATOR = ":";

const SESSION_BODY =
  /^(?<openedOn>\d{4}-\d{2}-\d{2})_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;

const FIXTURE_SESSION_BODY =
  /^(?<institutionId>fixture-[a-z0-9-]+-\d+)_[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/u;

export const mockSessionCode = (openedOn: Date): string =>
  `${MOCK_SESSION_PREFIX}${openedOn.toISOString().slice(0, 10)}_${crypto.randomUUID()}`;

export const openedOnOf = (code: string): Option.Option<string> =>
  code.startsWith(MOCK_SESSION_PREFIX)
    ? Option.fromNullishOr(
        SESSION_BODY.exec(code.slice(MOCK_SESSION_PREFIX.length))?.groups
          ?.openedOn
      )
    : Option.none();

export const fixtureSessionCode = (institutionId: string): string =>
  `${FIXTURE_SESSION_PREFIX}${institutionId}_${crypto.randomUUID()}`;

export const fixtureInstitutionOf = (code: string): Option.Option<string> =>
  code.startsWith(FIXTURE_SESSION_PREFIX)
    ? Option.fromNullishOr(
        FIXTURE_SESSION_BODY.exec(code.slice(FIXTURE_SESSION_PREFIX.length))
          ?.groups?.institutionId
      )
    : Option.none();

export interface SessionAccount {
  readonly accountKey: string;
  readonly sessionId: string;
}

export const sessionAccountOf = (providerAccountId: string): SessionAccount => {
  const [sessionId = providerAccountId, accountKey = ""] =
    providerAccountId.split(SESSION_ACCOUNT_SEPARATOR);

  return { accountKey, sessionId };
};
