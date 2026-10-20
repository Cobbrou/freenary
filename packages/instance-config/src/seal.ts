import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";

import { Data, Result } from "effect";

const SEAL_ALGORITHM = "aes-256-gcm";
const SEAL_KEY_BYTES = 32;
const SEAL_IV_BYTES = 12;
const SEAL_DIGEST = "sha256";
const SEAL_INFO = "freenary/instance-setting/v1";
const SEAL_SEPARATOR = ".";
const SEAL_ENCODING = "base64url";

export class SealedValueUnreadable extends Data.TaggedError(
  "SealedValueUnreadable"
)<{
  readonly key: string;
}> {
  override get message(): string {
    return `The stored value of ${this.key} does not open with the current BETTER_AUTH_SECRET.`;
  }
}

const sealingKey = (secret: string): Buffer =>
  Buffer.from(
    hkdfSync(SEAL_DIGEST, secret, SEAL_INFO, SEAL_INFO, SEAL_KEY_BYTES)
  );

export const seal = (
  secret: string,
  key: string,
  plaintext: string
): string => {
  const iv = randomBytes(SEAL_IV_BYTES);
  const cipher = createCipheriv(SEAL_ALGORITHM, sealingKey(secret), iv);

  cipher.setAAD(Buffer.from(key));

  const body = Buffer.concat([
    cipher.update(plaintext, "utf-8"),
    cipher.final(),
  ]);

  return [
    iv.toString(SEAL_ENCODING),
    cipher.getAuthTag().toString(SEAL_ENCODING),
    body.toString(SEAL_ENCODING),
  ].join(SEAL_SEPARATOR);
};

export const unseal = (
  secret: string,
  key: string,
  sealed: string
): Result.Result<string, SealedValueUnreadable> =>
  Result.try({
    catch: () => new SealedValueUnreadable({ key }),
    try: () => {
      const [iv, authTag, body] = sealed.split(SEAL_SEPARATOR);
      const decipher = createDecipheriv(
        SEAL_ALGORITHM,
        sealingKey(secret),
        Buffer.from(iv ?? "", SEAL_ENCODING)
      );

      decipher.setAAD(Buffer.from(key));
      decipher.setAuthTag(Buffer.from(authTag ?? "", SEAL_ENCODING));

      return (
        decipher.update(
          Buffer.from(body ?? "", SEAL_ENCODING),
          undefined,
          "utf-8"
        ) + decipher.final("utf-8")
      );
    },
  });
