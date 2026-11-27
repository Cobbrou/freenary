import { readFileSync } from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

dotenv.config({
  path: "../../apps/server/.env",
});

const databaseUrlFile = process.env.DATABASE_URL_FILE;

if (databaseUrlFile && process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_FILE: DATABASE_URL is set too. Set only one.");
}

const databaseUrlIfConfigured =
  (databaseUrlFile
    ? readFileSync(databaseUrlFile, "utf-8").replace(/\r?\n$/u, "")
    : process.env.DATABASE_URL) || undefined;

export default defineConfig({
  datasource: {
    url: databaseUrlIfConfigured,
  },
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  schema: path.join("prisma", "schema"),
});
