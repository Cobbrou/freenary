import { Data, Effect, Option, Schedule, Schema } from "effect";

export const RELEASES_URL =
  "https://api.github.com/repos/suiramdev/freenary/releases?per_page=100";

const REQUEST_TIMEOUT_MS = 5000;
const CHECK_INTERVAL = "24 hours";

const VERSION =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/u;

const STABLE_TAG = /^v(?<version>\d+\.\d+\.\d+)$/u;

export interface Version {
  readonly major: number;
  readonly minor: number;
  readonly patch: number;
  readonly prerelease: string | undefined;
}

export interface ReleaseStatus {
  readonly current: string | null;
  readonly latest: string | null;
}

const GithubReleaseSchema = Schema.Struct({
  draft: Schema.Boolean,
  prerelease: Schema.Boolean,
  tag_name: Schema.String,
});

const GithubReleasesSchema = Schema.Array(GithubReleaseSchema);

export type GithubRelease = typeof GithubReleaseSchema.Type;

export const parseVersion = (value: string): Option.Option<Version> =>
  Option.map(
    Option.fromNullishOr(VERSION.exec(value)?.groups),
    ({ major, minor, patch, prerelease }) => ({
      major: Number(major),
      minor: Number(minor),
      patch: Number(patch),
      prerelease,
    })
  );

export const isNewer = (release: Version, running: Version): boolean => {
  const order =
    release.major - running.major ||
    release.minor - running.minor ||
    release.patch - running.patch;

  if (order !== 0) {
    return order > 0;
  }

  return release.prerelease === undefined && running.prerelease !== undefined;
};

interface StableVersion {
  readonly text: string;
  readonly parsed: Version;
}

const stableVersionOf = (release: GithubRelease): StableVersion[] => {
  const text = STABLE_TAG.exec(release.tag_name)?.groups?.version;

  if (release.draft || release.prerelease || text === undefined) {
    return [];
  }

  return Option.match(parseVersion(text), {
    onNone: () => [],
    onSome: (parsed) => [{ parsed, text }],
  });
};

export const newestStable = (
  releases: readonly GithubRelease[]
): Option.Option<string> => {
  let newest: StableVersion | undefined;

  for (const candidate of releases.flatMap(stableVersionOf)) {
    if (newest === undefined || isNewer(candidate.parsed, newest.parsed)) {
      newest = candidate;
    }
  }

  return Option.fromNullishOr(newest?.text);
};

export class ReleaseCheckFailed extends Data.TaggedError("ReleaseCheckFailed")<{
  readonly detail: string;
}> {}

const checkFailed = (cause: unknown): ReleaseCheckFailed =>
  new ReleaseCheckFailed({ detail: String(cause) });

export type FetchReleases = (init: RequestInit) => Promise<Response>;

const fetchNewestStable = Effect.fn("release.fetchNewestStable")(
  function* fetchNewestStable(fetchReleases: FetchReleases, userAgent: string) {
    const response = yield* Effect.tryPromise({
      catch: checkFailed,
      try: (signal) =>
        fetchReleases({
          headers: {
            Accept: "application/vnd.github+json",
            "User-Agent": userAgent,
          },
          signal: AbortSignal.any([
            signal,
            AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          ]),
        }),
    });

    if (!response.ok) {
      return yield* new ReleaseCheckFailed({
        detail: `GitHub answered ${response.status}`,
      });
    }

    const payload = yield* Effect.tryPromise({
      catch: checkFailed,
      try: () => response.json(),
    });

    const releases = yield* Schema.decodeUnknownEffect(GithubReleasesSchema)(
      payload
    ).pipe(
      Effect.mapError(
        (cause: Schema.SchemaError) =>
          new ReleaseCheckFailed({ detail: cause.message })
      )
    );

    return newestStable(releases);
  }
);

export interface ReleaseCheckOptions {
  readonly version: string;
  readonly enabled: boolean;
  readonly fetchReleases: FetchReleases;
}

export const createReleaseCheck = (options: ReleaseCheckOptions) => {
  const running = parseVersion(options.version);
  const isActive = options.enabled && Option.isSome(running);
  const newest = { version: Option.none<string>() };

  const refresh = fetchNewestStable(
    options.fetchReleases,
    `freenary/${options.version}`
  ).pipe(
    Effect.tap((found) =>
      Effect.sync(() => {
        newest.version = found;
      })
    ),
    Effect.asVoid,
    Effect.catchTag("ReleaseCheckFailed", (failure) =>
      Effect.sync(() => {
        console.warn(
          `[update-check] The Freenary releases could not be read, and the check runs again in ${CHECK_INTERVAL}: ${failure.detail}`
        );
      })
    )
  );

  const isAheadOfRunning = (version: string): boolean =>
    isActive &&
    Option.isSome(running) &&
    Option.exists(parseVersion(version), (release) =>
      isNewer(release, running.value)
    );

  return {
    isActive,
    refresh: isActive ? refresh : Effect.void,
    start: () => {
      if (isActive) {
        Effect.runFork(
          refresh.pipe(Effect.repeat(Schedule.spaced(CHECK_INTERVAL)))
        );
      }
    },
    status: (): ReleaseStatus => ({
      current: options.version === "" ? null : options.version,
      latest: Option.getOrNull(
        newest.version.pipe(Option.filter(isAheadOfRunning))
      ),
    }),
  };
};

export const visibleTo = (
  status: ReleaseStatus,
  isOperator: boolean
): ReleaseStatus => ({
  current: status.current,
  latest: isOperator ? status.latest : null,
});
