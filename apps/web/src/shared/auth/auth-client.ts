import { apiKeyClient } from "@better-auth/api-key/client";
import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient, twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { getServerUrl } from "../config/server-url";

const AUTH_MOUNT_PATH = "/api/auth";

export const authClient = createAuthClient({
  baseURL: new URL(AUTH_MOUNT_PATH, getServerUrl()).toString(),
  plugins: [
    emailOTPClient(),
    twoFactorClient(),
    passkeyClient(),
    apiKeyClient(),
  ],
});
