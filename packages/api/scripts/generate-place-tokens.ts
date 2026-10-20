import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Data, Effect, Match } from "effect";
import { unzipSync } from "fflate";

import { normaliseDescriptor } from "../src/categorisation/normalise/normalise-descriptor";

type PlaceTokenFailure =
  | { readonly kind: "archiveUnreadable"; readonly cause: unknown }
  | {
      readonly kind: "downloadRejected";
      readonly status: number;
      readonly statusText: string;
    }
  | { readonly kind: "memberMissing"; readonly member: string }
  | { readonly kind: "requestFailed"; readonly cause: unknown }
  | { readonly kind: "writeFailed"; readonly cause: unknown };

class PlaceTokenBuildFailed extends Data.TaggedError("PlaceTokenBuildFailed")<{
  readonly reason: PlaceTokenFailure;
}> {}

const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../data/place-tokens.json"
);

const GEONAMES_URL =
  "https://download.geonames.org/export/dump/cities15000.zip";

const GEONAMES_MEMBER = "cities15000.txt";

const EUROPEAN_COUNTRIES = {
  AT: true,
  BE: true,
  BG: true,
  CH: true,
  CY: true,
  CZ: true,
  DE: true,
  DK: true,
  EE: true,
  ES: true,
  FI: true,
  FR: true,
  GB: true,
  GR: true,
  HR: true,
  HU: true,
  IE: true,
  IT: true,
  LT: true,
  LU: true,
  LV: true,
  MT: true,
  NL: true,
  NO: true,
  PL: true,
  PT: true,
  RO: true,
  SE: true,
  SI: true,
  SK: true,
} as const satisfies Record<string, true>;

const NAME_COLUMN = 1;
const ALTERNATE_NAMES_COLUMN = 3;
const COUNTRY_CODE_COLUMN = 8;

const ALPHA_ONLY = /^[a-z]+$/u;
const MIN_TOKEN_LENGTH = 3;

const KEEP_EXISTING_ARTIFACT_EXIT_CODE = 1;

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const noticeFor = (reason: PlaceTokenFailure): string =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      archiveUnreadable: ({ cause }) => describe(cause),
      downloadRejected: ({ status, statusText }) =>
        `Download failed: ${status} ${statusText}`,
      memberMissing: ({ member }) => `${member} not found in zip archive`,
      requestFailed: ({ cause }) => describe(cause),
      writeFailed: ({ cause }) => describe(cause),
    })
  );

const downloadAndExtract = Effect.fnUntraced(function* downloadAndExtract(
  url: string
) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new PlaceTokenBuildFailed({ reason: { cause, kind: "requestFailed" } }),
    try: () => fetch(url),
  });

  if (!response.ok) {
    return yield* new PlaceTokenBuildFailed({
      reason: {
        kind: "downloadRejected",
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  const archive = yield* Effect.tryPromise({
    catch: (cause) =>
      new PlaceTokenBuildFailed({
        reason: { cause, kind: "archiveUnreadable" },
      }),
    try: async () => unzipSync(new Uint8Array(await response.arrayBuffer())),
  });

  const member = archive[GEONAMES_MEMBER];

  if (!member) {
    return yield* new PlaceTokenBuildFailed({
      reason: { kind: "memberMissing", member: GEONAMES_MEMBER },
    });
  }

  return new TextDecoder().decode(member);
});

const collectPlaceTokens = (tsvContent: string): string[] => {
  const tokens = new Set<string>();

  for (const line of tsvContent.split("\n")) {
    if (line === "") {
      continue;
    }

    const columns = line.split("\t");

    if (
      !Object.hasOwn(EUROPEAN_COUNTRIES, columns[COUNTRY_CODE_COLUMN] ?? "")
    ) {
      continue;
    }

    const rawNames = [columns[NAME_COLUMN] ?? ""];
    const alternateNames = columns[ALTERNATE_NAMES_COLUMN] ?? "";

    if (alternateNames !== "") {
      for (const alternateName of alternateNames.split(",")) {
        rawNames.push(alternateName);
      }
    }

    for (const rawName of rawNames) {
      const normalised = normaliseDescriptor(rawName);

      if (normalised === "") {
        continue;
      }

      for (const token of normalised.split(" ")) {
        if (token.length >= MIN_TOKEN_LENGTH && ALPHA_ONLY.test(token)) {
          tokens.add(token);
        }
      }
    }
  }

  return [...tokens].toSorted();
};

const generatePlaceTokens = Effect.fnUntraced(function* generatePlaceTokens() {
  console.log("Downloading GeoNames cities15000 dataset…");

  const tsvContent = yield* downloadAndExtract(GEONAMES_URL);
  console.log(`Extracted ${tsvContent.split("\n").length} lines`);

  const tokens = collectPlaceTokens(tsvContent);

  yield* Effect.tryPromise({
    catch: (cause) =>
      new PlaceTokenBuildFailed({ reason: { cause, kind: "writeFailed" } }),
    try: () => writeFile(OUTPUT_PATH, JSON.stringify(tokens, null, 2)),
  });

  console.log(`Generated ${tokens.length} place tokens → ${OUTPUT_PATH}`);
});

const keepExistingArtifact = (
  cause: unknown,
  notice: string
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (!existsSync(OUTPUT_PATH)) {
      console.error(`Place-token generation failed: ${notice}`, cause);
      process.exit(KEEP_EXISTING_ARTIFACT_EXIT_CODE);
    }

    console.warn(
      "Download/extraction failed but existing place-tokens.json found — keeping it."
    );

    console.warn(notice);
  });

await Effect.runPromise(
  generatePlaceTokens().pipe(
    Effect.catchTag("PlaceTokenBuildFailed", (failure) =>
      keepExistingArtifact(failure, noticeFor(failure.reason))
    ),
    Effect.catchDefect((cause) => keepExistingArtifact(cause, describe(cause)))
  )
);
