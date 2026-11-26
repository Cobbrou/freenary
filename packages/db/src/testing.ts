import { afterAll } from "bun:test";
import { readdir, readFile } from "node:fs/promises";

const HOST = "127.0.0.1";
const MAX_CONNECTIONS = 20;
const MIGRATIONS = new URL("../prisma/migrations/", import.meta.url);

const freePort = (): number => {
  const probe = Bun.listen({
    hostname: HOST,
    port: 0,
    socket: { data: () => Promise.resolve() },
  });

  probe.stop();

  return probe.port;
};

const port = freePort();
const exitCodeBeforeTests = process.exitCode ?? 0;

afterAll(() => {
  process.exitCode = exitCodeBeforeTests;
});

process.env.DATABASE_URL = `postgresql://postgres@${HOST}:${port}/postgres`;

const readMigrations = async (): Promise<string[]> => {
  const entries = await readdir(MIGRATIONS, { withFileTypes: true });

  const folders = entries.flatMap((entry) =>
    entry.isDirectory() ? [entry.name] : []
  );

  return await Promise.all(
    folders
      .toSorted()
      .map((folder) =>
        readFile(new URL(`${folder}/migration.sql`, MIGRATIONS), "utf-8")
      )
  );
};

const start = async (): Promise<void> => {
  const [{ PGlite }, { citext }, { PGLiteSocketServer }, migrations] =
    await Promise.all([
      import("@electric-sql/pglite"),
      import("@electric-sql/pglite/contrib/citext"),
      import("@electric-sql/pglite-socket"),
      readMigrations(),
    ]);

  const db = await PGlite.create({ extensions: { citext } });

  await db.exec(migrations.join("\n"));

  await new PGLiteSocketServer({
    db,
    host: HOST,
    maxConnections: MAX_CONNECTIONS,
    port,
  }).start();
};

let started: Promise<void> | undefined;

export const startTestDatabase = (): Promise<void> => {
  started ??= start();

  return started;
};
