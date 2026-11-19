import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

import { describe, expect, it } from "vitest";

// Spec todo-unifiee : le fuseau ne s'écrit que dans getUserTimeZone (et son test).
const ROOT = join(__dirname, "..", "..");
const ALLOWED = [
  "src/modules/core/time-zone.ts",
  "src/modules/core/time-zone.test.ts",
];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(?:ts|tsx|js|jsx|mjs|cjs|json)$/.test(entry.name) ? [path] : [];
  });
}

function filesWritingAZone(): string[] {
  return listSourceFiles(join(ROOT, "src"))
    .filter((path) => readFileSync(path, "utf8").includes("Europe/"))
    .map((path) => relative(ROOT, path).split("\\").join("/"));
}

describe("fuseau en une seule source", () => {
  it("le parcours voit bien le fuseau de time-zone.ts", () => {
    expect(filesWritingAZone()).toContain("src/modules/core/time-zone.ts");
  });

  it("aucun `Europe/` dans src/ hors time-zone.ts", () => {
    expect(filesWritingAZone().filter((f) => !ALLOWED.includes(f))).toEqual([]);
  });
});
