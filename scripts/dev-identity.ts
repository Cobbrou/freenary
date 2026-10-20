export interface DevIdentityInput {
  branch?: string | null;
  dir?: string | null;
  slugOverride?: string | null;
}

export interface DevIdentity {
  slug: string;
  composeProjectName: string;
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
const HOST_SUFFIX = "freenary.localhost";
const SCHEME = "http";

const NON_LABEL_RUN = /[^a-z0-9]+/gu;
const EDGE_DASHES = /^-+|-+$/gu;
const TRAILING_DASHES = /-+$/gu;

const toDnsLabel = (raw: string | null | undefined): string => {
  if (!raw) {
    return "";
  }

  return raw
    .toLowerCase()
    .replace(NON_LABEL_RUN, "-")
    .replace(EDGE_DASHES, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(TRAILING_DASHES, "");
};

export const deriveDevIdentity = (input: DevIdentityInput): DevIdentity => {
  const slug =
    toDnsLabel(input.slugOverride) ||
    toDnsLabel(input.branch) ||
    toDnsLabel(input.dir) ||
    DEFAULT_SLUG;

  const webHost = `web.${slug}.${HOST_SUFFIX}`;
  const serverHost = `server.${slug}.${HOST_SUFFIX}`;
  const docsHost = `docs.${slug}.${HOST_SUFFIX}`;
  const mailHost = `mail.${slug}.${HOST_SUFFIX}`;
  const parentDomainOfWebAndServerHosts = `.${slug}.${HOST_SUFFIX}`;

  return {
    betterAuthUrl: `${SCHEME}://${serverHost}`,
    composeProjectName: `${PROJECT_PREFIX}-${slug}`,
    cookieDomain: parentDomainOfWebAndServerHosts,
    corsOrigin: `${SCHEME}://${webHost}`,
    docsHost,
    docsUrl: `${SCHEME}://${docsHost}`,
    mailHost,
    mailUrl: `${SCHEME}://${mailHost}`,
    serverHost,
    slug,
    viteServerUrl: `${SCHEME}://${serverHost}`,
    webHost,
  };
};
