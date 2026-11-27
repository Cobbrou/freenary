import { afterAll, describe, expect, it } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { readVariableFiles } from "./files";

const folder = mkdtempSync(path.join(tmpdir(), "env-files-"));
const secretFile = path.join(folder, "secret");

writeFileSync(secretFile, "from-the-file\n");

afterAll(() => {
  rmSync(folder, { force: true, recursive: true });
});

describe("readVariableFiles", () => {
  it("reads <NAME> from <NAME>_FILE, without the trailing newline", () => {
    const source: Record<string, string | undefined> = {
      SECRET_FILE: secretFile,
    };

    expect(readVariableFiles(source, ["SECRET"])).toEqual([]);
    expect(source.SECRET).toBe("from-the-file");
  });

  it("keeps a variable set directly when no file is given", () => {
    const source: Record<string, string | undefined> = { SECRET: "direct" };

    expect(readVariableFiles(source, ["SECRET"])).toEqual([]);
    expect(source.SECRET).toBe("direct");
  });

  it("refuses a variable set both directly and from a file", () => {
    const source: Record<string, string | undefined> = {
      SECRET: "direct",
      SECRET_FILE: secretFile,
    };

    expect(readVariableFiles(source, ["SECRET"])).toEqual([
      "SECRET_FILE: SECRET is set too. Set only one of them.",
    ]);

    expect(source.SECRET).toBe("direct");
  });

  it("treats an empty variable as unset", () => {
    const source: Record<string, string | undefined> = {
      SECRET: "",
      SECRET_FILE: secretFile,
    };

    expect(readVariableFiles(source, ["SECRET"])).toEqual([]);
    expect(source.SECRET).toBe("from-the-file");
  });

  it("refuses a path that is not a file", () => {
    const missing = path.join(folder, "missing");
    const source: Record<string, string | undefined> = {
      OTHER_FILE: folder,
      SECRET_FILE: missing,
    };

    expect(readVariableFiles(source, ["SECRET", "OTHER"])).toEqual([
      `SECRET_FILE: ${missing} is not a readable file.`,
      `OTHER_FILE: ${folder} is not a readable file.`,
    ]);
  });
});
