export type DevScheme = "http" | "https";

export interface DevIdentityInput {
  branch?: string | null;
  dir?: string | null;
  slugOverride?: string | null;
  domain?: string | null;
  scheme?: DevScheme;
}

export interface DevIdentity {
  slug: string;
  composeProjectName: string;
  scheme: DevScheme;
  webHost: string;
  serverHost: string;
  docsHost: string;
  mailHost: string;
  corsOrigin: string;
  betterAuthUrl: string;
  viteServerUrl: string;
  cookieDomain: string;
  docsUrl: string;
  mailUrl: string;
}

const DEFAULT_SLUG = "dev";
const MAX_SLUG_LENGTH = 40;
const PROJECT_PREFIX = "freenary";
const PROJECT_LABEL = "freenary";
const KIRI_DOMAIN = "kiri.localhost";
const DEFAULT_SCHEME: DevScheme = "https";

const NON_LABEL_RUN = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;
const TRAILING_DASHES = /-+$/gu;
const EDGE_DOTS = /^\.+|\.+$/gu;

const toDnsLabel = (raw: string | null | undefined): string => {
  if (!raw) {
    return "";
  }

  return raw
    .toLowerCase()
    .replaceAll(NON_LABEL_RUN, "-")
    .replaceAll(EDGE_DASHES, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replaceAll(TRAILING_DASHES, "");
};

const toDomain = (raw: string | null | undefined): string =>
  raw?.trim().toLowerCase().replaceAll(EDGE_DOTS, "") ?? "";

export const deriveDevIdentity = (input: DevIdentityInput): DevIdentity => {
  const slug =
    toDnsLabel(input.slugOverride) ||
    toDnsLabel(input.branch) ||
    toDnsLabel(input.dir) ||
    DEFAULT_SLUG;

  const domain = toDomain(input.domain) || KIRI_DOMAIN;
  const scheme = input.scheme ?? DEFAULT_SCHEME;
  const parentOfEveryHost = `${slug}.${PROJECT_LABEL}.${domain}`;

  const webHost = `web.${parentOfEveryHost}`;
  const serverHost = `server.${parentOfEveryHost}`;
  const docsHost = `docs.${parentOfEveryHost}`;
  const mailHost = `mail.${parentOfEveryHost}`;

  return {
    betterAuthUrl: `${scheme}://${serverHost}`,
    composeProjectName: `${PROJECT_PREFIX}-${slug}`,
    cookieDomain: `.${parentOfEveryHost}`,
    corsOrigin: `${scheme}://${webHost}`,
    docsHost,
    docsUrl: `${scheme}://${docsHost}`,
    mailHost,
    mailUrl: `${scheme}://${mailHost}`,
    scheme,
    serverHost,
    slug,
    viteServerUrl: `${scheme}://${serverHost}`,
    webHost,
  };
};
