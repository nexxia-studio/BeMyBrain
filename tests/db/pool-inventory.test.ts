// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
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

    try {
      const admin = await import("@/db/admin");

      expect(Object.keys(admin).toSorted()).toEqual([
        "endAdminPool",
        "withAdminTx",
      ]);
      expect(createPool).not.toHaveBeenCalled();
    } finally {
      vi.doUnmock("@/db/pool");
      vi.resetModules();
    }
  });
});

// Pilotes de drizzle-orm : sous-dossiers qui exposent un `driver.js` (neon-serverless, neon-http, node-postgres,
// postgres-js, pglite…). Lus dans node_modules : un pilote ajouté par une mise à jour est couvert d'office.
const DRIZZLE_DRIVERS = new Set(
  readdirSync(join(ROOT, "node_modules/drizzle-orm"), { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isDirectory() &&
        existsSync(join(entry.parentPath, entry.name, "driver.js")),
    )
    .map((entry) => entry.name),
);

/** Paquet de pilote de base : Neon, pg, postgres, ou un pilote de drizzle-orm. */
function isDriverSpecifier(specifier: string): boolean {
  if (/^@neondatabase\//.test(specifier)) return true;
  if (/^(?:pg|postgres)(?:\/|$)/.test(specifier)) return true;
  const drizzle = /^drizzle-orm\/([^/]+)/.exec(specifier);
  return drizzle !== null && DRIZZLE_DRIVERS.has(drizzle[1]);
}

/** Clause d'import faite uniquement de types (`type X`, `{ type A, type B }`) : effacée à la compilation. */
function isTypeOnlyClause(clause: string): boolean {
  if (/^type\s/.test(clause)) return true;
  const named = /^\{([^}]*)\}$/.exec(clause.trim());
  return (
    named !== null &&
    named[1]
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean)
      .every((part) => part.startsWith("type "))
  );
}

/** Imports de pilote qui chargent du code : statiques (import/export … from, import "x"), dynamiques, require. */
function driverImports(code: string): string[] {
  const found: string[] = [];
  for (const match of code.matchAll(
    /\b(?:import|export)\s+(?:([^;"'`]*?)\s+from\s*)?["']([^"']+)["']/g,
  )) {
    const [, clause, specifier] = match;
    if (clause !== undefined && isTypeOnlyClause(clause)) continue;
    if (isDriverSpecifier(specifier)) found.push(specifier);
  }
  for (const match of code.matchAll(
    /\b(?:import|require)\s*\(\s*["'`]([^"'`]+)["'`]/g,
  )) {
    if (isDriverSpecifier(match[1])) found.push(match[1]);
  }
  return found;
}

// Seuls fichiers autorisés à charger un pilote : ceux qui créent le pool et la base Drizzle.
const DRIVER_ALLOWED = new Set([
  "src/db/pool.ts",
  "src/db/admin.ts",
  "src/db/transaction-retry.ts",
]);
const NEW_CLIENT = /\bnew\s+Client\s*\(/;
const NEON_HTTP_CALL = /(?<![\w.$])neon\s*\(/;

describe("inventaire des pilotes de base (BRAIN-50)", () => {
  it("le détecteur voit les imports statiques, dynamiques et require, et ignore les imports de type", () => {
    const code = [
      'import { Pool } from "@neondatabase/serverless";',
      'import pg from "pg";',
      'export { drizzle } from "drizzle-orm/node-postgres";',
      'import "postgres";',
      'const a = await import("drizzle-orm/neon-http");',
      'const b = require("pg/lib/client");',
      'import type { PoolClient } from "@neondatabase/serverless";',
      'import { type NeonDatabase } from "drizzle-orm/neon-serverless";',
      'import { sql } from "drizzle-orm";',
      'import { pgTable } from "drizzle-orm/pg-core";',
      'import { defineConfig } from "drizzle-kit";',
    ].join("\n");

    const found = driverImports(code);

    expect(found.toSorted()).toEqual(
      [
        "@neondatabase/serverless",
        "pg",
        "drizzle-orm/node-postgres",
        "postgres",
        "drizzle-orm/neon-http",
        "pg/lib/client",
      ].toSorted(),
    );
    for (const driver of [
      "neon-serverless",
      "neon-http",
      "node-postgres",
      "postgres-js",
    ])
      expect(DRIZZLE_DRIVERS.has(driver)).toBe(true);
  });

  it("couvre src, scripts et ses sous-dossiers (ci, repro), e2e et les fichiers de configuration à la racine", () => {
    expect(productionFiles).toEqual(
      expect.arrayContaining([
        "drizzle.config.ts",
        "next.config.ts",
        "vitest.config.mts",
        "eslint.config.mjs",
      ]),
    );
    // Lecture récursive : les sous-dossiers de scripts (ci/, repro/) sont lus.
    expect(productionFiles).toContain("scripts/ci/neon-branch.mjs");
    // Le détecteur lit le vrai code : il voit le pilote du seul fichier qui crée le pool.
    expect(
      driverImports(readFileSync(join(ROOT, "src/db/pool.ts"), "utf8")),
    ).toEqual(["@neondatabase/serverless"]);
  });

  it("drizzle.config.ts n'importe que drizzle-kit, sans pilote (drizzle-kit a son propre pilote, hors périmètre)", () => {
    const code = readFileSync(join(ROOT, "drizzle.config.ts"), "utf8");

    expect(code).toMatch(/from\s*["']drizzle-kit["']/);
    expect(driverImports(code)).toEqual([]);
  });

  it("aucun import de pilote hors src/db/{pool,admin,transaction-retry}.ts et des tests", () => {
    const found = productionFiles
      .filter((path) => !DRIVER_ALLOWED.has(path))
      .flatMap((path) =>
        driverImports(readFileSync(join(ROOT, path), "utf8")).map(
          (specifier) => `${path} → ${specifier}`,
        ),
      );

    expect(found).toEqual([]);
  });

  it("aucun new Client( ni neon( hors src/db/{pool,client,admin,transaction-retry}.ts et des tests", () => {
    const candidates = productionFiles.filter((path) => !ALLOWED.has(path));

    expect(offenders(NEW_CLIENT, candidates)).toEqual([]);
    expect(offenders(NEON_HTTP_CALL, candidates)).toEqual([]);
  });
});
