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

// Une écriture de la colonne : clé d'objet passée à values()/set(), affectation d'une propriété, ou SQL brut.
const KEY = "(?:aisle_key|aisleKey)";
const WRITE = new RegExp(
  `\\b(?:values|set)\\s*\\(\\s*(?:\\[?\\s*)?\\{[^;]*?\\b${KEY}\\s*[:,}]` +
    `|\\.${KEY}\\s*=(?!=)` +
    `|\\b(?:insert\\s+into|update|set)\\b[^;]*?\\b${KEY}\\b`,
  "is",
);
const DICTIONARY_IMPORT = /from\s+["'][^"']*(?:aisles\/(?:dictionary|reference-set)|\/classify)["']/;

export const writesAisleKey = (source: string) => WRITE.test(source);
export const importsClassifier = (source: string) => DICTIONARY_IMPORT.test(source);

describe("détecteurs", () => {
  it("repèrent une écriture de aisle_key et un import du classement", () => {
    expect(writesAisleKey("await db.insert(items).values({ label, aisleKey: x })")).toBe(true);
    expect(writesAisleKey("tx.update(t).set({ aisle_key: k })")).toBe(true);
    expect(writesAisleKey("item.aisleKey = pick()")).toBe(true);
    expect(importsClassifier('import { classifyAisle } from "@/modules/shopping/classify";')).toBe(true);
    expect(importsClassifier('import { DICTIONARY } from "./aisles/dictionary"')).toBe(true);
  });
  it("laissent passer une lecture", () => {
    expect(writesAisleKey("select({ aisleKey: items.aisleKey }).from(items)")).toBe(false);
    expect(writesAisleKey("if (item.aisleKey === other) return item.aisleKey")).toBe(false);
    expect(importsClassifier('import type { AisleKey } from "./aisles"')).toBe(false);
  });
});

describe("classifyAisle reste le seul décideur du rayon", () => {
  it("aucun autre fichier de src/ n'écrit aisle_key", () => {
    const writers = candidates
      .filter(({ f }) => writesAisleKey(readFileSync(f, "utf8")))
      .map(({ rel }) => rel);
    // le schéma Drizzle déclare la colonne : seul fichier admis à l'affecter sans la décider
    expect(writers.filter((r) => !r.startsWith("db/schema/"))).toEqual([]);
  });

  it("aucun autre fichier de src/ n'importe le classement ni le dictionnaire", () => {
    const importers = candidates
      .filter(({ f }) => importsClassifier(readFileSync(f, "utf8")))
      .map(({ rel }) => rel);
    expect(importers).toEqual([]);
  });
});
