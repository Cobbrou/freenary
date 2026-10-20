import { generateKeyPairSync } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const PRIVATE_KEY_PATH = path.resolve(
  import.meta.dirname,
  "../data/dictionary.key"
);

const OWNER_READ_WRITE_ONLY = 0o600;

const FORCE_OVERWRITE_FLAG = "--force";

if (
  existsSync(PRIVATE_KEY_PATH) &&
  !process.argv.includes(FORCE_OVERWRITE_FLAG)
) {
  console.error(
    `Key already exists at ${PRIVATE_KEY_PATH}. Pass ${FORCE_OVERWRITE_FLAG} to overwrite.`
  );

  process.exit(1);
}

const { publicKey, privateKey } = generateKeyPairSync("ed25519", {
  privateKeyEncoding: { format: "pem", type: "pkcs8" },
  publicKeyEncoding: { format: "pem", type: "spki" },
});

mkdirSync(path.dirname(PRIVATE_KEY_PATH), { recursive: true });

writeFileSync(PRIVATE_KEY_PATH, privateKey, { mode: OWNER_READ_WRITE_ONLY });

chmodSync(PRIVATE_KEY_PATH, OWNER_READ_WRITE_ONLY);

console.log("Private key written to:", PRIVATE_KEY_PATH);

console.log("\nPublic key (embed in verify.ts):\n");

console.log(publicKey);
