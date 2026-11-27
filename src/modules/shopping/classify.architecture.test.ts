// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..", "..");
// Seuls décideurs du rayon : classify.ts, et mutations.ts (déplacement manuel d'un article).
const ALLOWED = new Set(["modules/shopping/classify.ts", "modules/shopping/mutations.ts"]);

function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? files(join(dir, e.name)) : /\.(ts|tsx)$/.test(e.name) ? [join(dir, e.name)] : [],
  );
}

const candidates = files(SRC)
  .map((f) => ({ f, rel: relative(SRC, f).split("\\").join("/") }))
  .filter(({ rel }) => !ALLOWED.has(rel))
  // le dictionnaire, son test et le jeu de référence se décrivent eux-mêmes ; les tests ne décident rien
  .filter(({ rel }) => !rel.startsWith("modules/shopping/aisles/") && !/\.test\.tsx?$/.test(rel));

describe("classifyAisle reste le seul décideur du rayon", () => {
  it("aucun autre fichier de src/ n'écrit aisle_key", () => {
    const writers = candidates
      .filter(({ f }) => /\baisle_key\b|\baisleKey\b/.test(readFileSync(f, "utf8")))
      .map(({ rel }) => rel);
    // le schéma Drizzle déclare la colonne : seul fichier admis à la nommer sans la décider
    expect(writers.filter((r) => !r.startsWith("db/schema/"))).toEqual([]);
  });

  it("aucun autre fichier de src/ n'importe le dictionnaire", () => {
    const importers = candidates
      .filter(({ f }) => /from\s+["'][^"']*aisles\/(dictionary|reference-set)["']/.test(readFileSync(f, "utf8")))
      .map(({ rel }) => rel);
    expect(importers).toEqual([]);
  });
});
