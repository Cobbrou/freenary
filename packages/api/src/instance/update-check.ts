import { env } from "@freenary/env/server";

import { createReleaseCheck, RELEASES_URL } from "./release";

export const updateCheck = createReleaseCheck({
  enabled: env.FREENARY_UPDATE_CHECK,
  fetchReleases: (init) => fetch(RELEASES_URL, init),
  version: env.FREENARY_BUILD_VERSION ?? "",
});
