import { carriesApiKey, requestCredential } from "@freenary/auth";
import type { ApiKeyRefusal } from "@freenary/auth";

export const BEARER_CHALLENGE = 'Bearer realm="freenary"';

const API_KEY_REFUSALS = {
  invalid: () =>
    new Response("invalid_api_key", {
      headers: {
        "WWW-Authenticate": `${BEARER_CHALLENGE}, error="invalid_token"`,
      },
      status: 401,
    }),
  "rate-limited": () => new Response("rate_limited", { status: 429 }),
} satisfies Record<ApiKeyRefusal, () => Response>;

export const apiKeyRefusalResponse = (refusal: ApiKeyRefusal): Response =>
  API_KEY_REFUSALS[refusal]();

export const refusedApiKeyResponse = async (
  headers: Headers
): Promise<Response | null> => {
  if (!carriesApiKey(headers)) {
    return null;
  }

  const credential = await requestCredential(headers);

  return credential.kind === "api-key-refused"
    ? apiKeyRefusalResponse(credential.refusal)
    : null;
};
