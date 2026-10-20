import { sign } from "node:crypto";
import {
  createWriteStream,
  existsSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

import { Data, Effect, Match, Option } from "effect";

import { mergeCountryScopes } from "../src/categorisation/merchant-scope";
import { normaliseDescriptor } from "../src/categorisation/normalise/normalise-descriptor";
import { resolveNsiCountries } from "../src/categorisation/nsi/location-scope";
import { mapOsmTagToCategory } from "./lib/category-map";
import { categoryPriority } from "./lib/category-priority";
import { CURATED_MERCHANTS } from "./lib/curated-merchants";
import type { DictionaryAlias, DictionaryMerchant } from "./lib/types";

interface NsiLocationSet {
  include?: unknown[];
}

interface NsiItem {
  id?: string;
  displayName?: string;
  locationSet?: NsiLocationSet;
  matchNames?: string[];
  tags?: Record<string, string> & {
    "contact:website"?: string;
    alt_name?: string;
    name?: string;
    short_name?: string;
    website?: string;
  };
}

interface NsiCategory {
  items?: NsiItem[];
  properties?: Record<string, string>;
  templates?: Record<string, string>;
}

interface NsiRoot {
  _meta: { version: string };
  nsi: Record<string, NsiCategory>;
}

interface GenericWordsRoot {
  _meta?: Record<string, string>;
  genericWords: string[];
}

interface Pass1Result {
  rawMerchants: DictionaryMerchant[];
  scannedCount: number;
}

interface WikidataBrand {
  aliases: string[];
  countries?: string[];
  domains: string[];
  id: string;
  label: string;
}

type DictionaryFailure =
  | { readonly kind: "artifactWriteFailed"; readonly cause: unknown }
  | { readonly kind: "memberMissing"; readonly member: string }
  | { readonly kind: "memberUnreadable"; readonly cause: unknown }
  | { readonly kind: "nsiJsonUndecodable"; readonly cause: unknown }
  | { readonly kind: "nsiRequestFailed"; readonly cause: unknown }
  | {
      readonly kind: "nsiTarballRejected";
      readonly status: number;
      readonly statusText: string;
    }
  | { readonly kind: "signingFailed"; readonly cause: unknown }
  | {
      readonly kind: "tarFailed";
      readonly member: string;
      readonly exitCode: number;
      readonly stderr: string;
    }
  | { readonly kind: "unexpected"; readonly cause: unknown }
  | { readonly kind: "wikidataUnavailable"; readonly cause: unknown };

class DictionaryBuildFailed extends Data.TaggedError("DictionaryBuildFailed")<{
  readonly reason: DictionaryFailure;
}> {}

const NSI_VERSION = "8.0.20260729";
const NSI_TARBALL_URL = `https://registry.npmjs.org/name-suggestion-index/-/name-suggestion-index-${NSI_VERSION}.tgz`;
const NSI_JSON_MEMBER = "package/dist/json/nsi.min.json";
const NSI_GENERIC_WORDS_MEMBER = "*/genericWords.min.json";

const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../data/merchants.jsonl.gz"
);

const WIKIDATA_PATH = path.resolve(
  import.meta.dirname,
  "../data/wikidata-brands.json"
);

const PRIVATE_KEY_PATH = path.resolve(
  import.meta.dirname,
  "../data/dictionary.key"
);

const MIN_SINGLE_TOKEN_LENGTH = 3;
const MAX_GZIP_LEVEL = 9;
const BYTES_PER_MEGABYTE = 1024 * 1024;
const BUILD_FAILED_EXIT_CODE = 1;

const OSM_TAG_PATH_SEGMENTS = 3;

const WWW_PREFIX = /^www\./u;
const NON_SLUG_CHARACTERS = /[^a-z0-9]+/gu;
const SLUG_EDGE_DASHES = /^-|-$/gu;

const TRANSIENT_MESSAGE =
  /fetch|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|AbortError|network/u;

const isEntirelyPlaceName = (_normalisedName: string): boolean => false;

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const noticeFor = (reason: DictionaryFailure): string =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      artifactWriteFailed: ({ cause }) => describe(cause),
      memberMissing: ({ member }) => `No files matching ${member} in tarball`,
      memberUnreadable: ({ cause }) => describe(cause),
      nsiJsonUndecodable: ({ cause }) => describe(cause),
      nsiRequestFailed: ({ cause }) => describe(cause),
      nsiTarballRejected: ({ status, statusText }) =>
        `Failed to fetch NSI tarball: ${status} ${statusText}`,
      signingFailed: ({ cause }) => describe(cause),
      tarFailed: ({ member, exitCode, stderr }) =>
        `tar extraction of ${member} failed (exit ${exitCode}): ${stderr}`,
      unexpected: ({ cause }) => describe(cause),
      wikidataUnavailable: ({ cause }) => describe(cause),
    })
  );

const isTransient = (reason: DictionaryFailure): boolean =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      artifactWriteFailed: () => false,
      memberMissing: () => false,
      memberUnreadable: () => false,
      nsiJsonUndecodable: () => false,
      nsiRequestFailed: () => true,
      nsiTarballRejected: () => true,
      signingFailed: () => false,
      tarFailed: () => false,
      unexpected: ({ cause }) =>
        cause instanceof TypeError ||
        (cause instanceof Error && TRANSIENT_MESSAGE.test(cause.message)),
      wikidataUnavailable: () => false,
    })
  );

const parseUrl = Option.liftThrowable(
  (url: string) => new URL(url.startsWith("http") ? url : `https://${url}`)
);

const extractDomain = (url: string): Option.Option<string> =>
  parseUrl(url).pipe(
    Option.map((parsed) =>
      parsed.hostname.toLowerCase().replace(WWW_PREFIX, "")
    )
  );

const discardTempDir = (tmpDir: string): Effect.Effect<void> =>
  Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "memberUnreadable" },
      }),
    try: () => rm(tmpDir, { force: true, recursive: true }),
  }).pipe(Effect.ignore);

const extractFromTarball = Effect.fnUntraced(function* extractFromTarball(
  tarballBytes: ArrayBuffer,
  memberGlob: string
) {
  const tmpDir = yield* Effect.acquireRelease(
    Effect.tryPromise({
      catch: (cause) =>
        new DictionaryBuildFailed({
          reason: { cause, kind: "memberUnreadable" },
        }),
      try: () => mkdtemp(path.join(tmpdir(), "nsi-")),
    }),
    discardTempDir
  );

  const tarPath = path.join(tmpDir, "archive.tgz");

  const extraction = yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "memberUnreadable" },
      }),
    try: async () => {
      await Bun.write(tarPath, tarballBytes);
      const proc = Bun.spawn(["tar", "-xzf", tarPath, "-C", tmpDir], {
        stderr: "pipe",
      });

      const exitCode = await proc.exited;

      return { exitCode, stderr: await new Response(proc.stderr).text() };
    },
  });

  if (extraction.exitCode !== 0) {
    return yield* new DictionaryBuildFailed({
      reason: {
        exitCode: extraction.exitCode,
        kind: "tarFailed",
        member: memberGlob,
        stderr: extraction.stderr,
      },
    });
  }

  const glob = new Bun.Glob(memberGlob);
  const [firstMatch] = [...glob.scanSync({ cwd: tmpDir })];

  if (!firstMatch) {
    return yield* new DictionaryBuildFailed({
      reason: { kind: "memberMissing", member: memberGlob },
    });
  }

  return yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "memberUnreadable" },
      }),
    try: () => readFile(path.join(tmpDir, firstMatch), "utf-8"),
  });
}, Effect.scoped);

const categoryPathToOsmTag = (categoryPath: string): string | null => {
  const parts = categoryPath.split("/");

  if (parts.length < OSM_TAG_PATH_SEGMENTS) {
    return null;
  }

  return `${parts[1]}=${parts[2]}`;
};

const slugify = (text: string): string =>
  text
    .toLowerCase()
    .replaceAll(NON_SLUG_CHARACTERS, "-")
    .replaceAll(SLUG_EDGE_DASHES, "");

const writeArtifact = Effect.fnUntraced(function* writeArtifact(
  outputPath: string,
  merchants: DictionaryMerchant[]
) {
  const rawLines: string[] = [];

  for (const merchant of merchants) {
    rawLines.push(JSON.stringify(merchant));
  }

  const rawContent = `${rawLines.join("\n")}\n`;
  const rawBytes = Buffer.byteLength(rawContent, "utf-8");

  const gzippedBytes = yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "artifactWriteFailed" },
      }),
    try: async () => {
      await mkdir(path.dirname(outputPath), { recursive: true });
      const gzip = createGzip({ level: MAX_GZIP_LEVEL });
      const fileStream = createWriteStream(outputPath);
      gzip.end(rawContent);
      await pipeline(gzip, fileStream);
      const { size } = await Bun.file(outputPath).stat();

      return size;
    },
  });

  return { gzippedBytes, rawBytes };
});

const extractWebsites = (tags: NsiItem["tags"]): string[] => {
  const urls: string[] = [];

  if (tags?.website && tags.website.length > 0) {
    urls.push(tags.website);
  }

  if (tags?.["contact:website"] && tags["contact:website"].length > 0) {
    urls.push(tags["contact:website"]);
  }

  return urls;
};

const collectRawAliases = (item: NsiItem): string[] => {
  const rawAliases: string[] = [];

  if (item.matchNames) {
    rawAliases.push(...item.matchNames);
  }

  if (item.tags?.alt_name) {
    for (const alt of item.tags.alt_name.split(";")) {
      const trimmed = alt.trim();

      if (trimmed.length > 0) {
        rawAliases.push(trimmed);
      }
    }
  }

  if (item.tags?.short_name) {
    for (const shortName of item.tags.short_name.split(";")) {
      const trimmed = shortName.trim();

      if (trimmed.length > 0) {
        rawAliases.push(trimmed);
      }
    }
  }

  return rawAliases;
};

const isTooWeakToIndex = (
  normalisedName: string,
  isGenericToken: (token: string) => boolean
): boolean => {
  const [firstToken] = normalisedName.split(" ");

  return (
    !normalisedName.includes(" ") &&
    (firstToken.length < MIN_SINGLE_TOKEN_LENGTH || isGenericToken(firstToken))
  );
};

const buildAliases = (
  rawAliases: string[],
  normalisedName: string,
  isGenericToken: (token: string) => boolean
): DictionaryAlias[] => {
  const seenNormalised = new Set<string>([normalisedName]);
  const aliases: DictionaryAlias[] = [];

  for (const rawAlias of rawAliases) {
    const normalisedAlias = normaliseDescriptor(rawAlias);

    if (normalisedAlias.length === 0 || seenNormalised.has(normalisedAlias)) {
      continue;
    }

    const aliasTokens = normalisedAlias.split(" ");

    if (aliasTokens.length === 1 && isGenericToken(aliasTokens[0])) {
      continue;
    }

    seenNormalised.add(normalisedAlias);
    aliases.push({ alias: rawAlias, normalisedAlias });
  }

  return aliases;
};

const buildDomains = (websiteUrls: string[]): string[] => {
  const domains: string[] = [];
  const seenDomains = new Set<string>();

  for (const url of websiteUrls) {
    const domain = extractDomain(url);

    if (Option.isSome(domain) && !seenDomains.has(domain.value)) {
      seenDomains.add(domain.value);
      domains.push(domain.value);
    }
  }

  return domains;
};

const collectNsiCandidates = (
  nsiData: Record<string, NsiCategory>,
  isGenericToken: (token: string) => boolean
): Pass1Result => {
  const rawMerchants: DictionaryMerchant[] = [];
  let scannedCount = 0;

  for (const [categoryPath, categoryData] of Object.entries(nsiData)) {
    if (
      categoryPath.startsWith("flags/") ||
      categoryPath.startsWith("transit/")
    ) {
      continue;
    }

    const osmTag = categoryPathToOsmTag(categoryPath);
    const category = mapOsmTagToCategory(osmTag);

    if (!categoryData.items) {
      continue;
    }

    scannedCount += categoryData.items.length;

    if (category === null) {
      continue;
    }

    for (const item of categoryData.items) {
      const displayName = item.displayName ?? item.tags?.name;

      if (!displayName || displayName.trim().length === 0) {
        continue;
      }

      const normalisedName = normaliseDescriptor(displayName);

      if (
        normalisedName.length === 0 ||
        isTooWeakToIndex(normalisedName, isGenericToken)
      ) {
        continue;
      }

      const rawAliases = collectRawAliases(item);
      const aliases = buildAliases(rawAliases, normalisedName, isGenericToken);
      const domains = buildDomains(extractWebsites(item.tags));
      const id = `nsi:${slugify(item.id ?? displayName)}`;

      rawMerchants.push({
        aliases,
        category,
        countries: resolveNsiCountries(item.locationSet?.include),
        domains,
        id,
        name: displayName,
        normalisedName,
        osmTag,
        source: "nsi",
      });
    }
  }

  return { rawMerchants, scannedCount };
};

const mergeCollisionGroup = (
  group: [DictionaryMerchant, ...DictionaryMerchant[]]
) => {
  let winningCategory = group[0].category;
  let bestPriority = -1;

  for (const candidate of group) {
    const priority = candidate.category
      ? categoryPriority(candidate.category)
      : 0;

    if (priority > bestPriority) {
      bestPriority = priority;
      winningCategory = candidate.category;
    }
  }

  group.sort(
    (left, right) =>
      left.name.length - right.name.length || left.id.localeCompare(right.id)
  );

  const [primary] = group;

  const allNormalisedAliases = new Set<string>([primary.normalisedName]);
  const mergedAliases: DictionaryAlias[] = [];
  const mergedDomains: string[] = [];
  const seenDomains = new Set<string>();

  for (const absorbed of group) {
    if (absorbed !== primary) {
      const normName = normaliseDescriptor(absorbed.name);

      if (normName.length > 0 && !allNormalisedAliases.has(normName)) {
        allNormalisedAliases.add(normName);
        mergedAliases.push({ alias: absorbed.name, normalisedAlias: normName });
      }
    }

    for (const alias of absorbed.aliases) {
      if (!allNormalisedAliases.has(alias.normalisedAlias)) {
        allNormalisedAliases.add(alias.normalisedAlias);
        mergedAliases.push(alias);
      }
    }

    for (const domain of absorbed.domains) {
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        mergedDomains.push(domain);
      }
    }
  }

  return {
    absorbed: group.length - 1,
    merged: {
      ...primary,
      aliases: mergedAliases,
      category: winningCategory,
      countries: mergeCountryScopes(group.map((member) => member.countries)),
      domains: mergedDomains,
    },
  };
};

const mergeWikidataBrands = (
  merchants: DictionaryMerchant[],
  wikidataBrands: WikidataBrand[],
  isGenericToken: (token: string) => boolean
) => {
  const byNorm: Record<string, number> = {};

  for (let index = 0; index < merchants.length; index += 1) {
    byNorm[merchants[index].normalisedName] = index;
  }

  let wikidataMatched = 0;
  let wikidataNew = 0;

  for (const brand of wikidataBrands) {
    const normalisedName = normaliseDescriptor(brand.label);

    if (
      normalisedName.length === 0 ||
      isTooWeakToIndex(normalisedName, isGenericToken) ||
      isEntirelyPlaceName(normalisedName)
    ) {
      continue;
    }

    const domains = buildDomains(brand.domains.map((d) => `https://${d}`));
    const aliases = buildAliases(brand.aliases, normalisedName, isGenericToken);

    const existingIdx = byNorm[normalisedName];
    const existing =
      existingIdx === undefined ? undefined : merchants[existingIdx];

    const statesCountries = Boolean(
      brand.countries && brand.countries.length > 0
    );

    const hasCommercialEvidence = domains.length > 0;

    if (existing) {
      const seenAliases = new Set<string>([
        existing.normalisedName,
        ...existing.aliases.map((alias) => alias.normalisedAlias),
      ]);

      const seenDomains = new Set(existing.domains);

      let enriched = false;

      for (const alias of aliases) {
        if (!seenAliases.has(alias.normalisedAlias)) {
          seenAliases.add(alias.normalisedAlias);
          existing.aliases.push(alias);
          enriched = true;
        }
      }

      for (const domain of domains) {
        if (!seenDomains.has(domain)) {
          seenDomains.add(domain);
          existing.domains.push(domain);
          enriched = true;
        }
      }

      if (statesCountries && brand.countries) {
        existing.countries = mergeCountryScopes([
          existing.countries,
          brand.countries,
        ]);
      }

      if (enriched) {
        wikidataMatched += 1;
      }
    } else if (hasCommercialEvidence) {
      merchants.push({
        aliases,
        category: null,
        countries: brand.countries ?? [],
        domains,
        id: `wd:${brand.id}`,
        name: brand.label,
        normalisedName,
        osmTag: null,
        source: "wikidata",
      });

      byNorm[normalisedName] = merchants.length - 1;
      wikidataNew += 1;
    }
  }

  return { wikidataMatched, wikidataNew };
};

const mergeCuratedSupplement = (
  nsiMerchants: DictionaryMerchant[],
  wikidataBrands: WikidataBrand[]
) => {
  const nsiByNorm: Record<string, number> = {};

  for (let index = 0; index < nsiMerchants.length; index += 1) {
    nsiByNorm[nsiMerchants[index].normalisedName] = index;
  }

  const canonicalBrandByLabel: Record<string, WikidataBrand> = {};

  for (const brand of wikidataBrands) {
    const key = brand.label.toLowerCase();

    if (!canonicalBrandByLabel[key]) {
      canonicalBrandByLabel[key] = brand;
    }
  }

  let curatedAdded = 0;
  let curatedOverridden = 0;

  for (const curated of CURATED_MERCHANTS) {
    const normalisedName = normaliseDescriptor(curated.name);

    if (normalisedName.length === 0) {
      continue;
    }

    const brandMatch = canonicalBrandByLabel[curated.name.toLowerCase()];
    const rawAliases = brandMatch?.aliases ?? [];
    const rawDomains = brandMatch?.domains ?? [];

    const seenNormalised = new Set<string>([normalisedName]);
    const aliases: DictionaryAlias[] = [];

    for (const rawAlias of rawAliases) {
      const normAlias = normaliseDescriptor(rawAlias);

      if (normAlias.length === 0 || seenNormalised.has(normAlias)) {
        continue;
      }

      seenNormalised.add(normAlias);
      aliases.push({ alias: rawAlias, normalisedAlias: normAlias });
    }

    const domains = buildDomains(rawDomains.map((d) => `https://${d}`));

    const merchant: DictionaryMerchant = {
      aliases,
      category: curated.category,
      countries: [],
      domains,
      id: `curated:${slugify(curated.name)}`,
      name: curated.name,
      normalisedName,
      osmTag: null,
      source: "curated",
    };

    const existingIdx = nsiByNorm[normalisedName];

    if (existingIdx === undefined) {
      nsiMerchants.push(merchant);
      curatedAdded += 1;
    } else {
      const existing = nsiMerchants[existingIdx];
      const mergedDomains = [...merchant.domains];
      const domainSet = new Set(mergedDomains);

      for (const domain of existing.domains) {
        if (!domainSet.has(domain)) {
          domainSet.add(domain);
          mergedDomains.push(domain);
        }
      }

      for (const alias of existing.aliases) {
        if (!seenNormalised.has(alias.normalisedAlias)) {
          seenNormalised.add(alias.normalisedAlias);
          aliases.push(alias);
        }
      }

      nsiMerchants[existingIdx] = {
        ...merchant,
        aliases,
        domains: mergedDomains,
      };

      curatedOverridden += 1;
    }
  }

  return { curatedAdded, curatedOverridden };
};

const resolveCollisions = (candidates: DictionaryMerchant[]) => {
  const groups: Record<string, DictionaryMerchant[]> = {};

  for (const candidate of candidates) {
    const key = candidate.normalisedName;

    if (!groups[key]) {
      groups[key] = [];
    }

    groups[key].push(candidate);
  }

  const merchants: DictionaryMerchant[] = [];
  let mergedCount = 0;

  for (const [, group] of Object.entries(groups)) {
    const [primary, ...rest] = group;

    if (!primary) {
      continue;
    }

    if (rest.length === 0) {
      merchants.push(primary);

      continue;
    }

    const { merged, absorbed } = mergeCollisionGroup([primary, ...rest]);
    merchants.push(merged);
    mergedCount += absorbed;
  }

  return { merchants, mergedCount };
};

const fetchNsiTarball = Effect.fnUntraced(function* fetchNsiTarball() {
  console.log(`Fetching NSI v${NSI_VERSION} tarball…`);

  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "nsiRequestFailed" },
      }),
    try: () => fetch(NSI_TARBALL_URL),
  });

  if (!response.ok) {
    return yield* new DictionaryBuildFailed({
      reason: {
        kind: "nsiTarballRejected",
        status: response.status,
        statusText: response.statusText,
      },
    });
  }

  const tarballBytes = yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "nsiRequestFailed" },
      }),
    try: () => response.arrayBuffer(),
  });

  console.log(
    `Downloaded ${(tarballBytes.byteLength / BYTES_PER_MEGABYTE).toFixed(1)} MB`
  );

  return tarballBytes;
});

const loadGenericWordRegexes = Effect.fnUntraced(
  function* loadGenericWordRegexes(tarballBytes: ArrayBuffer) {
    const gwJson = yield* extractFromTarball(
      tarballBytes,
      NSI_GENERIC_WORDS_MEMBER
    );

    if (gwJson.trim().length === 0) {
      return [];
    }

    /* SAFETY: genericWords.min.json is NSI's published artifact, whose only
       documented member is a genericWords array of regex source strings */
    const gwRoot = yield* Effect.try({
      catch: (cause) =>
        new DictionaryBuildFailed({
          reason: { cause, kind: "nsiJsonUndecodable" },
        }),
      try: () => JSON.parse(gwJson) as GenericWordsRoot,
    });

    return gwRoot.genericWords.map((pattern) => new RegExp(pattern, "iu"));
  }
);

const mergeWikidata = Effect.fnUntraced(function* mergeWikidata(
  merchants: DictionaryMerchant[],
  isGenericToken: (token: string) => boolean
) {
  const wikidataJson = yield* Effect.tryPromise({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "wikidataUnavailable" },
      }),
    try: () => readFile(WIKIDATA_PATH, "utf-8"),
  });

  /* SAFETY: wikidata-brands.json is this repository's own build artifact,
     written by fetch-wikidata-brands.ts as a WikidataBrand array */
  const brands = yield* Effect.try({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "wikidataUnavailable" },
      }),
    try: () => JSON.parse(wikidataJson) as WikidataBrand[],
  });

  const { wikidataMatched, wikidataNew } = yield* Effect.try({
    catch: (cause) =>
      new DictionaryBuildFailed({
        reason: { cause, kind: "wikidataUnavailable" },
      }),
    try: () => mergeWikidataBrands(merchants, brands, isGenericToken),
  });

  console.log(
    `Wikidata brands: ${wikidataMatched} enriched, ${wikidataNew} new entries`
  );

  return { brands, wikidataMatched, wikidataNew };
});

const signArtifact = Effect.fnUntraced(function* signArtifact() {
  if (!existsSync(PRIVATE_KEY_PATH)) {
    console.log("No signing key found — dictionary is unsigned.");

    return;
  }

  yield* Effect.try({
    catch: (cause) =>
      new DictionaryBuildFailed({ reason: { cause, kind: "signingFailed" } }),
    try: () => {
      const privateKey = readFileSync(PRIVATE_KEY_PATH, "utf-8");
      const artifactBytes = readFileSync(OUTPUT_PATH);
      const signature = sign(null, artifactBytes, privateKey);
      const signaturePath = `${OUTPUT_PATH}.sig`;
      writeFileSync(signaturePath, signature);
      console.log(
        `Dictionary signed: ${signaturePath} (${signature.length} bytes)`
      );
    },
  });
});

const buildMerchantDictionary = Effect.fnUntraced(
  function* buildMerchantDictionary() {
    const tarballBytes = yield* fetchNsiTarball();

    const nsiJson = yield* extractFromTarball(tarballBytes, NSI_JSON_MEMBER);

    /* SAFETY: nsi.min.json is the Name Suggestion Index's published artifact,
       whose documented top level is { _meta, nsi } */
    const nsiRoot = yield* Effect.try({
      catch: (cause) =>
        new DictionaryBuildFailed({
          reason: { cause, kind: "nsiJsonUndecodable" },
        }),
      try: () => JSON.parse(nsiJson) as NsiRoot,
    });

    const genericRegexes = yield* loadGenericWordRegexes(tarballBytes).pipe(
      Effect.catchTag("DictionaryBuildFailed", () =>
        Effect.sync(() => {
          console.log(
            "Warning: genericWords not found in tarball, using empty stop-list"
          );

          return [];
        })
      )
    );

    const isGenericToken = (token: string): boolean =>
      genericRegexes.some((regex) => regex.test(token));

    const { rawMerchants, scannedCount } = collectNsiCandidates(
      nsiRoot.nsi,
      isGenericToken
    );

    let placeDropped = 0;
    const afterPass2: DictionaryMerchant[] = [];

    for (const candidate of rawMerchants) {
      if (isEntirelyPlaceName(candidate.normalisedName)) {
        placeDropped += 1;

        continue;
      }

      afterPass2.push(candidate);
    }

    console.log(`Place-name filter: dropped ${placeDropped}`);

    const { merchants: nsiMerchants, mergedCount } =
      resolveCollisions(afterPass2);

    console.log(
      `Collision resolution: merged ${mergedCount} NSI rows (category-priority)`
    );

    const wikidata = yield* mergeWikidata(nsiMerchants, isGenericToken).pipe(
      Effect.catchTag("DictionaryBuildFailed", () =>
        Effect.sync(() => {
          console.log(
            "Warning: wikidata-brands.json not found, skipping Wikidata enrichment (run fetch-wikidata-brands.ts to generate it)"
          );

          return { brands: [], wikidataMatched: 0, wikidataNew: 0 };
        })
      )
    );

    const { curatedAdded, curatedOverridden } = mergeCuratedSupplement(
      nsiMerchants,
      wikidata.brands
    );

    console.log(
      `Curated supplement: ${curatedAdded} added, ${curatedOverridden} overrode NSI`
    );

    const merchants = nsiMerchants;
    merchants.sort((left, right) => left.id.localeCompare(right.id));

    let totalAliases = 0;
    let nsiCount = 0;
    let curatedCount = 0;
    let wikidataCount = 0;

    for (const merchant of merchants) {
      totalAliases += merchant.aliases.length;

      if (merchant.source === "curated") {
        curatedCount += 1;
      } else if (merchant.source === "wikidata") {
        wikidataCount += 1;
      } else {
        nsiCount += 1;
      }
    }

    const distinctCategories = new Set(
      merchants.map((merchant) => merchant.category)
    );

    const { gzippedBytes, rawBytes } = yield* writeArtifact(
      OUTPUT_PATH,
      merchants
    );

    yield* signArtifact().pipe(
      Effect.catchTag("DictionaryBuildFailed", ({ reason }) =>
        Effect.sync(() => {
          console.warn("Signing failed:", noticeFor(reason));
        })
      )
    );

    const scopedCount = merchants.filter(
      (merchant) => merchant.countries.length > 0
    ).length;

    console.log("\n─── Build Summary ───");
    console.log(`NSI version:        ${NSI_VERSION}`);
    console.log(`Items scanned:      ${scannedCount}`);
    console.log(`Raw NSI candidates: ${rawMerchants.length}`);
    console.log(`NSI kept:           ${nsiCount}`);
    console.log(`Wikidata matched:   ${wikidata.wikidataMatched}`);
    console.log(
      `Wikidata new:       ${wikidata.wikidataNew} (${wikidataCount} total)`
    );

    console.log(`Curated:            ${curatedCount}`);
    console.log(`Total merchants:    ${merchants.length}`);
    console.log(`Aliases kept:       ${totalAliases}`);
    console.log(`Distinct categories: ${distinctCategories.size}`);
    console.log(
      `Country-scoped:     ${scopedCount} (${merchants.length - scopedCount} unscoped)`
    );

    console.log(`Raw JSONL bytes:    ${rawBytes.toLocaleString()}`);
    console.log(`Gzipped bytes:      ${gzippedBytes.toLocaleString()}`);
    console.log(`Output:             ${OUTPUT_PATH}`);
  }
);

const abandonBuild = (
  cause: unknown,
  reason: DictionaryFailure
): Effect.Effect<void> =>
  Effect.sync(() => {
    if (isTransient(reason) && existsSync(OUTPUT_PATH)) {
      console.warn(
        `Merchant dictionary build failed (transient) — keeping existing merchants.jsonl.gz. Error: ${noticeFor(reason)}`
      );

      return;
    }

    console.error(`Build failed: ${noticeFor(reason)}`, cause);
    process.exit(BUILD_FAILED_EXIT_CODE);
  });

await Effect.runPromise(
  buildMerchantDictionary().pipe(
    Effect.catchTag("DictionaryBuildFailed", (failure) =>
      abandonBuild(failure, failure.reason)
    ),
    Effect.catchDefect((cause) =>
      abandonBuild(cause, { cause, kind: "unexpected" })
    )
  )
);
