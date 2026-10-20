import { env } from "@freenary/env/web";

import { DOCS_SITE_URL } from "./links";

const RELEASED_VERSION = /^(?<major>\d+)\.(?<minor>\d+)\.\d+$/u;
const UNRELEASED_DOCS_VERSION = "next";

export const docsUrl = (): string => {
  const released = RELEASED_VERSION.exec(
    env.VITE_FREENARY_VERSION ?? ""
  )?.groups;

  const version = released
    ? `${released.major}.${released.minor}`
    : UNRELEASED_DOCS_VERSION;

  return `${DOCS_SITE_URL}/docs/${version}`;
};
