// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it, vi } from "vitest";

// BRAIN-50, spec « Points d'accès à la base » : tout accès à la base passe par createPool et la nouvelle
// tentative de runTransaction. Verrou : aucun pool ni base Drizzle créés ailleurs que dans src/db, hors tests.

const ROOT = join(import.meta.dirname, "../..");
const SCANNED = ["src", "scripts", "e2e"];
const SOURCE = /\.(?:[cm]?[jt]sx?)$/;
// Seuls fichiers de code autorisés à créer un pool ou une base Drizzle.
const ALLOWED = new Set([
  "src/db/pool.ts",
  "src/db/client.ts",
  "src/db/admin.ts",
  "src/db/transaction-retry.ts",
]);

/** Fichiers de test : jamais dans un bundle ni lancés par l'app (Vitest, ou enfants tsx de tests/factories). */
function isTestFile(path: string): boolean {
  return path.startsWith("tests/") || /\.test\.[cm]?[jt]sx?$/.test(path);
}

function listSources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), {
    recursive: true,
    withFileTypes: true,
  })
    .filter((entry) => entry.isFile() && SOURCE.test(entry.name))
    .map((entry) =>
      relative(ROOT, join(entry.parentPath, entry.name)).split(sep).join("/"),
    );
}

const rootSources = readdirSync(ROOT, { withFileTypes: true })
  .filter((entry) => entry.isFile() && SOURCE.test(entry.name))
  .map((entry) => entry.name);
const files = [...SCANNED.flatMap(listSources), ...rootSources];
const productionFiles = files.filter((path) => !isTestFile(path));

function offenders(pattern: RegExp, candidates: string[]): string[] {
  return candidates.filter((path) =>
    pattern.test(readFileSync(join(ROOT, path), "utf8")),
  );
}

describe("inventaire des pools (BRAIN-50)", () => {
  it("lit bien le code de l'app et des scripts", () => {
    expect(productionFiles).toEqual(
      expect.arrayContaining([
        "src/db/pool.ts",
        "src/db/admin.ts",
        "scripts/seed.ts",
      ]),
    );
  });

  it("aucun new Pool( hors src/db/{pool,client,admin,transaction-retry}.ts et des tests", () => {
    const found = offenders(
      /\bnew\s+Pool\s*\(/,
      productionFiles.filter((path) => !ALLOWED.has(path)),
    );

    expect(found).toEqual([]);
  });

  it("aucun drizzle( hors src/db/{pool,client,admin,transaction-retry}.ts et des tests", () => {
    const found = offenders(
      /\bdrizzle\s*\(/,
      productionFiles.filter((path) => !ALLOWED.has(path)),
    );

    expect(found).toEqual([]);
  });

  it("plus aucune mention d'adminDb dans le code, les scripts ni les tests de la base", () => {
    // tests/lint garde des imports fictifs d'adminDb : ils vérifient la frontière eslint sur le chemin db/admin.
    const testDb = [
      ...listSources("tests/db"),
      ...listSources("tests/factories"),
    ].filter((path) => path !== "tests/db/pool-inventory.test.ts");

    const found = offenders(/\badminDb\b/, [...files, ...testDb]);

    expect(found).toEqual([]);
  });

  it("src/db/admin.ts n'exporte que withAdminTx et endAdminPool, et son import n'ouvre aucun pool", async () => {
    vi.resetModules();
    const createPool = vi.fn();
    vi.doMock("@/db/pool", () => ({ createPool }));

    const admin = await import("@/db/admin");

    expect(Object.keys(admin).toSorted()).toEqual([
      "endAdminPool",
      "withAdminTx",
    ]);
    expect(createPool).not.toHaveBeenCalled();
    vi.doUnmock("@/db/pool");
  });
});
