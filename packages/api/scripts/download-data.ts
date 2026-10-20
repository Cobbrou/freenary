import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { Data, Effect, Match, Option } from "effect";

interface ReleaseAsset {
  name: string;
  url: string;
}

interface Release {
  tag_name: string;
  assets: ReleaseAsset[];
}

type DownloadFailure =
  | { readonly kind: "artifactMissing" }
  | { readonly kind: "assetMissing"; readonly tagName: string }
  | { readonly kind: "downloadRejected"; readonly status: number }
  | { readonly kind: "noRelease" }
  | { readonly kind: "releaseListRejected"; readonly status: number }
  | { readonly kind: "unexpected"; readonly cause: unknown };

class DataDownloadFailed extends Data.TaggedError("DataDownloadFailed")<{
  readonly reason: DownloadFailure;
}> {}

const RELEASE_TAG_PREFIX = "data-";
const ASSET_NAME = "merchant-data.tar.gz";
const RELEASE_PAGE_SIZE = 20;
const REPO_WITHOUT_GIT_METADATA = "suiramdev/freenary";
const BYTES_PER_MEGABYTE = 1024 * 1024;
const FALL_BACK_TO_LOCAL_GENERATION = 1;
const GITHUB_REMOTE_SLUG = /github\.com[:/](?<slug>[^/]+\/[^/]+?)(?:\.git)?$/u;

const PACKAGE_DIR = path.resolve(import.meta.dirname, "..");
const DATA_DIR = path.resolve(PACKAGE_DIR, "data");
const EXPECTED_ARTIFACT = path.resolve(DATA_DIR, "merchants.jsonl.gz");

const noticeFor = (reason: DownloadFailure): string =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      artifactMissing: () =>
        "Extraction completed but merchants.jsonl.gz is missing — tarball may be malformed",
      assetMissing: ({ tagName }) =>
        `Release ${tagName} has no ${ASSET_NAME} asset`,
      downloadRejected: ({ status }) => `Download failed with status ${status}`,
      noRelease: () => `No ${RELEASE_TAG_PREFIX}* release found`,
      releaseListRejected: ({ status }) =>
        `GitHub API returned ${status} — no release available`,
      unexpected: ({ cause }) =>
        `Data download failed: ${cause instanceof Error ? cause.message : String(cause)}`,
    })
  );

const unexpected = (cause: unknown): DataDownloadFailed =>
  new DataDownloadFailed({ reason: { cause, kind: "unexpected" } });

const readGitOriginUrl = Option.liftThrowable(() =>
  execSync("git remote get-url origin", {
    encoding: "utf-8",
    stdio: ["pipe", "pipe", "pipe"],
  }).trim()
);

const resolveRepo = (): string =>
  Option.fromNullishOr(process.env.GITHUB_REPOSITORY).pipe(
    Option.filter((repo) => repo.length > 0),
    Option.orElse(() =>
      readGitOriginUrl().pipe(
        Option.flatMap((url) =>
          Option.fromNullishOr(GITHUB_REMOTE_SLUG.exec(url)?.groups?.slug)
        )
      )
    ),
    Option.getOrElse(() => REPO_WITHOUT_GIT_METADATA)
  );

const resolveHeaders = (): Record<string, string> => {
  const baseHeaders = {
    Accept: "application/vnd.github+json",
    "User-Agent": "freenary-data-download",
    "X-GitHub-Api-Version": "2022-11-28",
  } satisfies Record<string, string>;

  const token = process.env.GITHUB_TOKEN;

  return token
    ? { ...baseHeaders, Authorization: `Bearer ${token}` }
    : baseHeaders;
};

const scopedTarballPath = Effect.acquireRelease(
  Effect.sync(() => path.join(tmpdir(), `merchant-data-${Date.now()}.tar.gz`)),
  (tarballPath) => Effect.promise(() => rm(tarballPath, { force: true }))
);

const extractIntoPackage = Effect.fnUntraced(function* extractIntoPackage(
  tarballBytes: Uint8Array
) {
  const tarballPath = yield* scopedTarballPath;

  yield* Effect.tryPromise({
    catch: unexpected,
    try: () => writeFile(tarballPath, tarballBytes),
  });

  yield* Effect.try({
    catch: unexpected,
    try: () =>
      execSync(`tar -xzf ${tarballPath} -C ${PACKAGE_DIR}`, {
        stdio: "inherit",
      }),
  });
}, Effect.scoped);

const findDataRelease = Effect.fnUntraced(function* findDataRelease(
  repo: string
) {
  console.log(`Looking for latest ${RELEASE_TAG_PREFIX}* release in ${repo}…`);

  const headers = resolveHeaders();
  const releasesUrl = `https://api.github.com/repos/${repo}/releases?per_page=${RELEASE_PAGE_SIZE}`;

  const response = yield* Effect.tryPromise({
    catch: unexpected,
    try: () => fetch(releasesUrl, { headers }),
  });

  if (!response.ok) {
    return yield* new DataDownloadFailed({
      reason: { kind: "releaseListRejected", status: response.status },
    });
  }

  /* SAFETY: the releases endpoint returned 2xx, checked above, so GitHub's
     documented release list shape holds */
  const releases = yield* Effect.tryPromise({
    catch: unexpected,
    try: async () => (await response.json()) as Release[],
  });

  const release = releases.find((candidate) =>
    candidate.tag_name.startsWith(RELEASE_TAG_PREFIX)
  );

  if (!release) {
    return yield* new DataDownloadFailed({ reason: { kind: "noRelease" } });
  }

  const asset = release.assets.find(
    (candidate) => candidate.name === ASSET_NAME
  );

  if (!asset) {
    return yield* new DataDownloadFailed({
      reason: { kind: "assetMissing", tagName: release.tag_name },
    });
  }

  return { asset, headers, tagName: release.tag_name };
});

const downloadLatestData = Effect.fnUntraced(function* downloadLatestData() {
  const { asset, headers, tagName } = yield* findDataRelease(resolveRepo());

  console.log(`Downloading ${ASSET_NAME} from ${tagName}…`);

  const download = yield* Effect.tryPromise({
    catch: unexpected,
    try: () =>
      fetch(asset.url, {
        headers: { ...headers, Accept: "application/octet-stream" },
        redirect: "follow",
      }),
  });

  if (!download.ok) {
    return yield* new DataDownloadFailed({
      reason: { kind: "downloadRejected", status: download.status },
    });
  }

  const tarballBytes = new Uint8Array(
    yield* Effect.tryPromise({
      catch: unexpected,
      try: () => download.arrayBuffer(),
    })
  );

  console.log(
    `Downloaded ${(tarballBytes.byteLength / BYTES_PER_MEGABYTE).toFixed(1)} MB`
  );

  yield* Effect.tryPromise({
    catch: unexpected,
    try: () => mkdir(DATA_DIR, { recursive: true }),
  });

  yield* extractIntoPackage(tarballBytes);

  if (!existsSync(EXPECTED_ARTIFACT)) {
    return yield* new DataDownloadFailed({
      reason: { kind: "artifactMissing" },
    });
  }

  console.log(`Using merchant data from release ${tagName}`);
});

const fallBackToLocalGeneration = (
  reason: DownloadFailure
): Effect.Effect<never> =>
  Effect.sync(() => {
    console.log(noticeFor(reason));

    return process.exit(FALL_BACK_TO_LOCAL_GENERATION);
  });

await Effect.runPromise(
  downloadLatestData().pipe(
    Effect.catchTag("DataDownloadFailed", ({ reason }) =>
      fallBackToLocalGeneration(reason)
    ),
    Effect.catchDefect((cause) =>
      fallBackToLocalGeneration({ cause, kind: "unexpected" })
    )
  )
);
