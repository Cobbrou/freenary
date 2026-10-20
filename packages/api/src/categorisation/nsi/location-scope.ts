const ISO_3166_2_SUBDIVISION = /^(?<countryCode>[a-z]{2})-[a-z0-9]{2,3}$/u;

const NSI_COUNTRY_PREFIXED_GEOJSON_REGION_FILE =
  /^(?<countryCode>[a-z]{2})-[a-z0-9]+\.geojson$/u;

const WELL_FORMED_REGION_SUBTAG = /^[a-z]{2}$/u;

const NSI_CODE_FOR_METROPOLITAN_FRANCE = "fx";
const ISO_COUNTRY_BEHIND_METROPOLITAN_FRANCE = "FR";

const regionNames = new Intl.DisplayNames(["en"], { type: "region" });

const namesAnIsoRegion = (upperCaseCode: string): boolean =>
  regionNames.of(upperCaseCode) !== upperCaseCode;

const countryCodeOf = (token: string): string =>
  (
    ISO_3166_2_SUBDIVISION.exec(token) ??
    NSI_COUNTRY_PREFIXED_GEOJSON_REGION_FILE.exec(token)
  )?.groups?.["countryCode"] ?? token;

export const resolveNsiCountries = (
  include: readonly unknown[] = []
): string[] => {
  const countries = new Set<string>();

  for (const includeMember of include) {
    const token = String(includeMember).toLowerCase();
    const code = countryCodeOf(token);

    if (code === NSI_CODE_FOR_METROPOLITAN_FRANCE) {
      countries.add(ISO_COUNTRY_BEHIND_METROPOLITAN_FRANCE);

      continue;
    }

    if (!WELL_FORMED_REGION_SUBTAG.test(code)) {
      continue;
    }

    const upperCaseCode = code.toUpperCase();

    if (namesAnIsoRegion(upperCaseCode)) {
      countries.add(upperCaseCode);
    }
  }

  return [...countries].toSorted();
};
