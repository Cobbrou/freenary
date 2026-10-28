import { createHash, hkdfSync, timingSafeEqual } from "node:crypto";

const TOKEN_DIGEST = "sha256";
const TOKEN_INFO = "freenary/instance-setup-token/v1";
const TOKEN_BYTES = 24;
const TOKEN_ENCODING = "base64url";

export const setupTokenOf = (secret: string): string =>
  Buffer.from(
    hkdfSync(TOKEN_DIGEST, secret, TOKEN_INFO, TOKEN_INFO, TOKEN_BYTES)
  ).toString(TOKEN_ENCODING);

const digestOf = (value: string): Buffer =>
  createHash(TOKEN_DIGEST).update(value).digest();

export const isSetupToken = (secret: string, candidate: string): boolean =>
  timingSafeEqual(digestOf(candidate.trim()), digestOf(setupTokenOf(secret)));
