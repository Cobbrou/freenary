import { env } from "@freenary/env/web";

import { DOCS_SITE_URL, GITHUB_REPO_URL } from "./links";

const RELEASED_VERSION = /^(?<major>\d+)\.(?<minor>\d+)\.\d+$/u;
const UNRELEASED_DOCS_VERSION = "next";
const UPDATE_GUIDE_PATH = "/run/updates-and-backups";

export const docsUrl = (
  version: string = env.VITE_FREENARY_VERSION ?? ""
): string => {
  const released = RELEASED_VERSION.exec(version)?.groups;

  const docsVersion = released
    ? `${released.major}.${released.minor}`
    : UNRELEASED_DOCS_VERSION;

  return `${DOCS_SITE_URL}/docs/${docsVersion}`;
};

export const updateGuideUrl = (release: string): string =>
  `${docsUrl(release)}${UPDATE_GUIDE_PATH}`;

export const releaseNotesUrl = (release: string): string =>
  `${GITHUB_REPO_URL}/releases/tag/v${release}`;
