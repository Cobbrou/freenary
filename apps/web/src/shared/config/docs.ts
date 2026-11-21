import { DOCS_SITE_URL, GITHUB_REPO_URL } from "./links";

const UPDATE_GUIDE_PATH = "/how-to/update-freenary";

export const docsUrl = (): string => `${DOCS_SITE_URL}/docs`;

export const updateGuideUrl = (): string => `${docsUrl()}${UPDATE_GUIDE_PATH}`;

export const releaseNotesUrl = (release: string): string =>
  `${GITHUB_REPO_URL}/releases/tag/v${release}`;
