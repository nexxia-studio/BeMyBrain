import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ALLOWED = "src/db/user-db.ts";
const FORBIDDEN = [
  /set_config/i,
  /request\.jwt\.claims/i,
  /SET\s+ROLE/i,
  /SET\s+SESSION\s+AUTHORIZATION/i,
];

// Code de production seulement : les tests posent les claims à la main (règle tests.md).
function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|mts|js|mjs)$/.test(entry.name) &&
      !/\.test\.(ts|tsx)$/.test(entry.name)
      ? [relative(process.cwd(), path)]
      : [];
  });
}

describe("injection d'identité unique", () => {
  it("set_config, request.jwt.claims, SET ROLE et SET SESSION AUTHORIZATION n'apparaissent que dans src/db/user-db.ts", () => {
    const files = sourceFiles("src");

    const offenders = files.filter((file) => {
      const content = readFileSync(file, "utf8");
      return file !== ALLOWED && FORBIDDEN.some((re) => re.test(content));
    });

    expect(offenders).toEqual([]);
  });
});
