import { writeFile } from "node:fs/promises";
import path from "node:path";

import { Data, Duration, Effect, Match, Option, Schedule } from "effect";

import { CURATED_MERCHANTS } from "./lib/curated-merchants";

interface WikidataBrand {
  aliases: string[];
  countries: string[];
  domains: string[];
  id: string;
  label: string;
}

interface SparqlResults {
  results: {
    bindings: Record<string, { value: string }>[];
  };
}

interface EntityEntry {
  countries: Set<string>;
  domains: Set<string>;
  label: string;
}

type SparqlFailure =
  | { readonly kind: "rejected"; readonly status: number }
  | { readonly kind: "serviceBusy"; readonly status: number }
  | { readonly kind: "transportFailed"; readonly cause: unknown };

type RetryableSparqlFailure = Exclude<SparqlFailure, { kind: "rejected" }>;

class SparqlQueryFailed extends Data.TaggedError("SparqlQueryFailed")<{
  readonly reason: SparqlFailure;
}> {}

const ENDPOINT = "https://query.wikidata.org/sparql";

const OUTPUT_PATH = path.resolve(
  import.meta.dirname,
  "../data/wikidata-brands.json"
);

const USER_AGENT = "freenary-merchant-build/1.0 (https://freenary.com)";
const DELAY_MS = 1500;

const TOO_MANY_REQUESTS = 429;
const SERVER_ERROR = 500;
const SPARQL_RETRIES = 2;
const SPARQL_ATTEMPTS = SPARQL_RETRIES + 1;
const RETRY_BASE_MS = 5000;
const RETRY_DELAY_FACTOR = 2;

const CURATED_WIKIDATA_BATCH_SIZE = 10;

const ALIAS_BATCH_SIZE = 400;
const ALIAS_BATCH_PROGRESS_EVERY = 10;
const ALIAS_LANGUAGES = '("en", "fr")';
const ROWS_PER_CURATED_NAME = 50;
const ENTITY_ROW_LIMIT = 10_000;

const WWW_PREFIX = /^www\./u;

const ENTITY_TYPES = {
  Q1060829: "franchise",
  Q1589009: "startup company",
  Q161726: "multinational corporation",
  Q167037: "corporation",
  Q210167: "video game developer",
  Q2659904: "government-owned company",
  Q3918: "university",
  Q431289: "brand",
  Q4830453: "business",
  Q507619: "chain store",
  Q6881511: "enterprise",
  Q783794: "company",
  Q891723: "public company",
} as const satisfies Record<string, string>;

const describe = (cause: unknown): string =>
  cause instanceof Error ? cause.message : String(cause);

const parseUrl = Option.liftThrowable(
  (url: string) => new URL(url.startsWith("http") ? url : `https://${url}`)
);

const extractDomain = (url: string): Option.Option<string> =>
  parseUrl(url).pipe(
    Option.map((parsed) =>
      parsed.hostname.toLowerCase().replace(WWW_PREFIX, "")
    )
  );

const chunk = <A>(items: readonly A[], size: number): A[][] => {
  const batches: A[][] = [];

  for (let start = 0; start < items.length; start += size) {
    batches.push(items.slice(start, start + size));
  }

  return batches;
};

const retryDelay = (recurrence: number): Duration.Duration =>
  Duration.millis(RETRY_BASE_MS * RETRY_DELAY_FACTOR ** recurrence);

const retryNotice = (
  reason: RetryableSparqlFailure,
  label: string,
  delay: Duration.Duration
): string =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      serviceBusy: ({ status }) =>
        `  HTTP ${status} on ${label}, retry in ${Duration.toSeconds(delay)}s…`,
      transportFailed: ({ cause }) =>
        `  Network error on ${label}, retry in ${Duration.toSeconds(delay)}s: ${describe(cause)}`,
    })
  );

const giveUpNotice = (reason: SparqlFailure, label: string): string =>
  Match.value(reason).pipe(
    Match.discriminatorsExhaustive("kind")({
      rejected: ({ status }) => `  Unexpected HTTP ${status} on ${label}`,
      serviceBusy: ({ status }) =>
        `  Failed ${label} after ${SPARQL_ATTEMPTS} attempts: HTTP ${status}`,
      transportFailed: ({ cause }) => `  Failed ${label}: ${describe(cause)}`,
    })
  );

const retryBackoff = (label: string) =>
  Schedule.recurs(SPARQL_RETRIES).pipe(
    Schedule.setInputType<SparqlQueryFailed>(),
    Schedule.addDelay(({ output }) => Effect.succeed(retryDelay(output))),
    Schedule.tap(({ input, output }) => {
      const { reason } = input;

      return reason.kind === "rejected"
        ? Effect.void
        : Effect.sync(() => {
            console.log(retryNotice(reason, label, retryDelay(output)));
          });
    })
  );

const requestSparql = Effect.fnUntraced(function* requestSparql(query: string) {
  const response = yield* Effect.tryPromise({
    catch: (cause) =>
      new SparqlQueryFailed({ reason: { cause, kind: "transportFailed" } }),
    try: () =>
      fetch(ENDPOINT, {
        body: `query=${encodeURIComponent(query)}`,
        headers: {
          Accept: "application/sparql-results+json",
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": USER_AGENT,
        },
        method: "POST",
      }),
  });

  if (
    response.status === TOO_MANY_REQUESTS ||
    response.status >= SERVER_ERROR
  ) {
    return yield* new SparqlQueryFailed({
      reason: { kind: "serviceBusy", status: response.status },
    });
  }

  if (!response.ok) {
    return yield* new SparqlQueryFailed({
      reason: { kind: "rejected", status: response.status },
    });
  }

  /* SAFETY: WDQS answered 2xx to a SPARQL query it accepted, so the body is
     the SPARQL 1.1 results JSON shape its content type declares */
  return yield* Effect.tryPromise({
    catch: (cause) =>
      new SparqlQueryFailed({ reason: { cause, kind: "transportFailed" } }),
    try: async () => (await response.json()) as SparqlResults,
  });
});

const runQuery = (
  query: string,
  label: string
): Effect.Effect<Option.Option<SparqlResults>> =>
  requestSparql(query).pipe(
    Effect.retry({
      schedule: retryBackoff(label),
      times: SPARQL_RETRIES,
      while: ({ reason }) => reason.kind !== "rejected",
    }),
    Effect.map(Option.some),
    Effect.catchTag("SparqlQueryFailed", ({ reason }) =>
      Effect.sync(() => {
        console.log(giveUpNotice(reason, label));

        return Option.none<SparqlResults>();
      })
    )
  );

const fetchEntitiesByType = Effect.fnUntraced(function* fetchEntitiesByType(
  typeQid: string,
  typeName: string
) {
  const query = `SELECT ?item ?itemLabel ?website ?countryCode WHERE {
  ?item wdt:P31 wd:${typeQid} .
  ?item wdt:P856 ?website .
  ?item rdfs:label ?itemLabel . FILTER(LANG(?itemLabel) = "en")
  OPTIONAL { ?item wdt:P17/wdt:P297 ?countryCode }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q4167410 }
} LIMIT ${ENTITY_ROW_LIMIT}`;

  const rows = yield* runQuery(query, `type ${typeQid} (${typeName})`);
  const entries = new Map<string, EntityEntry>();

  if (Option.isNone(rows)) {
    return entries;
  }

  for (const row of rows.value.results.bindings) {
    const qid = row.item.value.split("/").pop() ?? row.item.value;
    const label = row.itemLabel.value;
    const domain = extractDomain(row.website.value);
    const countryCode = row.countryCode?.value.toUpperCase();

    let entry = entries.get(qid);

    if (!entry) {
      entry = { countries: new Set(), domains: new Set(), label };
      entries.set(qid, entry);
    }

    if (Option.isSome(domain)) {
      entry.domains.add(domain.value);
    }

    if (countryCode) {
      entry.countries.add(countryCode);
    }
  }

  return entries;
});

const mergeEntitiesByType = Effect.fnUntraced(function* mergeEntitiesByType(
  merged: Map<string, EntityEntry>
) {
  console.log(
    `\nPhase 1: fetching entities by type (${Object.keys(ENTITY_TYPES).length} types)…`
  );

  for (const [typeQid, typeName] of Object.entries(ENTITY_TYPES)) {
    const entities = yield* fetchEntitiesByType(typeQid, typeName);

    let newCount = 0;

    for (const [qid, entry] of entities) {
      const existing = merged.get(qid);

      if (existing) {
        for (const domain of entry.domains) {
          existing.domains.add(domain);
        }

        for (const country of entry.countries) {
          existing.countries.add(country);
        }
      } else {
        merged.set(qid, {
          countries: new Set(entry.countries),
          domains: new Set(entry.domains),
          label: entry.label,
        });

        newCount += 1;
      }
    }

    console.log(
      `  ${typeQid} (${typeName}): ${entities.size} entities, ${newCount} new (total: ${merged.size})`
    );

    yield* Effect.sleep(DELAY_MS);
  }

  console.log(`\nPhase 1 complete: ${merged.size} unique entities`);
});

const fetchCuratedFromWikidata = Effect.fnUntraced(
  function* fetchCuratedFromWikidata(
    names: string[],
    merged: Map<string, EntityEntry>
  ) {
    console.log(
      `\nPhase 1b: querying Wikidata for ${names.length} curated merchant names…`
    );

    const batches = chunk(names, CURATED_WIKIDATA_BATCH_SIZE);

    for (const [index, batch] of batches.entries()) {
      const valuesClause = batch
        .map((name) => `"${name.replaceAll('"', '\\"')}"@en`)
        .join(" ");

      const query = `SELECT ?item ?itemLabel ?website ?countryCode WHERE {
  VALUES ?searchLabel { ${valuesClause} }
  ?item rdfs:label ?searchLabel .
  OPTIONAL { ?item wdt:P856 ?website }
  OPTIONAL { ?item wdt:P17/wdt:P297 ?countryCode }
  FILTER NOT EXISTS { ?item wdt:P31 wd:Q5 }
}
ORDER BY ?item ?website
LIMIT ${batch.length * ROWS_PER_CURATED_NAME}`;

      const batchNum = index + 1;
      const rows = yield* runQuery(
        query,
        `curated batch ${batchNum}/${batches.length}`
      );

      if (Option.isSome(rows)) {
        let batchNew = 0;

        for (const row of rows.value.results.bindings) {
          const itemVal = row.item;
          const labelVal = row.itemLabel;

          if (!(itemVal && labelVal)) {
            continue;
          }

          const qid = itemVal.value.split("/").pop() ?? itemVal.value;
          const label = labelVal.value;
          const domain = Option.fromNullishOr(row.website).pipe(
            Option.flatMap((website) => extractDomain(website.value))
          );

          let entry = merged.get(qid);

          if (!entry) {
            entry = { countries: new Set(), domains: new Set(), label };
            merged.set(qid, entry);
            batchNew += 1;
          }

          if (Option.isSome(domain)) {
            entry.domains.add(domain.value);
          }

          const countryCode = row.countryCode?.value.toUpperCase();

          if (countryCode) {
            entry.countries.add(countryCode);
          }
        }

        console.log(
          `  Batch ${batchNum}/${batches.length}: ${batch.length} names, ${batchNew} new entities`
        );
      }

      if (batchNum < batches.length) {
        yield* Effect.sleep(DELAY_MS);
      }
    }

    console.log(
      `Phase 1b complete: ${merged.size} total entities after curated lookup`
    );
  }
);

const fetchAliasesBatch = Effect.fnUntraced(function* fetchAliasesBatch(
  qids: string[]
) {
  const values = qids.map((qid) => `wd:${qid}`).join(" ");
  const query = `SELECT ?item (GROUP_CONCAT(DISTINCT ?altLabel; separator="|") AS ?aliases) WHERE {
  VALUES ?item { ${values} }
  ?item skos:altLabel ?altLabel . FILTER(LANG(?altLabel) IN ${ALIAS_LANGUAGES})
} GROUP BY ?item`;

  const rows = yield* runQuery(query, `aliases batch (${qids.length} items)`);
  const aliasesByQid = new Map<string, string[]>();

  if (Option.isNone(rows)) {
    return aliasesByQid;
  }

  for (const row of rows.value.results.bindings) {
    const qid = row.item.value.split("/").pop() ?? row.item.value;
    const aliasStr = row.aliases?.value ?? "";

    if (aliasStr.length > 0) {
      const aliases = aliasStr.split("|").flatMap((alias) => {
        const trimmed = alias.trim();

        return trimmed.length > 0 ? [trimmed] : [];
      });

      if (aliases.length > 0) {
        aliasesByQid.set(qid, aliases);
      }
    }
  }

  return aliasesByQid;
});

const collectAliases = Effect.fnUntraced(function* collectAliases(
  qids: string[]
) {
  const allAliases = new Map<string, string[]>();
  const batches = chunk(qids, ALIAS_BATCH_SIZE);

  console.log(
    `\nPhase 2: fetching aliases (${batches.length} batches of ${ALIAS_BATCH_SIZE})…`
  );

  for (const [index, batch] of batches.entries()) {
    const batchNum = index + 1;
    const aliases = yield* fetchAliasesBatch(batch);

    for (const [qid, aliasList] of aliases) {
      allAliases.set(qid, aliasList);
    }

    if (
      batchNum % ALIAS_BATCH_PROGRESS_EVERY === 0 ||
      batchNum === batches.length
    ) {
      console.log(
        `  Batch ${batchNum}/${batches.length}: ${allAliases.size} entities with aliases`
      );
    }

    if (batchNum < batches.length) {
      yield* Effect.sleep(DELAY_MS);
    }
  }

  return allAliases;
});

const assembleBrands = (
  merged: Map<string, EntityEntry>,
  allAliases: Map<string, string[]>
): WikidataBrand[] => {
  const brands: WikidataBrand[] = [];

  for (const [qid, entry] of merged) {
    const entityAliases = allAliases.get(qid) ?? [];

    brands.push({
      aliases: entityAliases
        .filter((alias) => alias !== entry.label)
        .toSorted(),
      countries: [...entry.countries].toSorted(),
      domains: [...entry.domains].toSorted(),
      id: qid,
      label: entry.label,
    });
  }

  return brands.toSorted((left, right) => left.id.localeCompare(right.id));
};

const fetchWikidataBrands = Effect.fnUntraced(function* fetchWikidataBrands() {
  const merged = new Map<string, EntityEntry>();
  yield* mergeEntitiesByType(merged);

  yield* fetchCuratedFromWikidata(
    CURATED_MERCHANTS.map((merchant) => merchant.name),
    merged
  );

  const allAliases = yield* collectAliases([...merged.keys()]);
  const sorted = assembleBrands(merged, allAliases);

  yield* Effect.promise(() =>
    writeFile(OUTPUT_PATH, JSON.stringify(sorted, null, 2), "utf-8")
  );

  const frenchCount = sorted.filter((brand) =>
    brand.countries.includes("FR")
  ).length;

  console.log(`\nWrote ${sorted.length} brands to ${OUTPUT_PATH}`);
  console.log(`French-linked brands (P17 = FR): ${frenchCount}`);
});

await Effect.runPromise(
  fetchWikidataBrands().pipe(
    Effect.catchDefect((cause) =>
      Effect.sync(() => {
        console.warn(
          `Warning: Wikidata brand fetch failed, continuing without it: ${describe(cause)}`
        );
      })
    )
  )
);
