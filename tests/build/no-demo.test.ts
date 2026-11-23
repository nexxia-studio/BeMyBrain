// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Fermeture de la démo des effets de verre (BRAIN-33, tâche 9 ; spec, scénario 7). Lancé par `pnpm test:build`,
// après `next build` : vérifie le code source et la build (aucune route /demo, donc 404 en build comme en dev).
const ROOT = process.cwd();
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => join(entry.parentPath, entry.name));
}

const src = sourceFiles("src").map((file) => ({
  file,
  text: readFileSync(file, "utf8"),
}));

function filesMatching(pattern: RegExp): string[] {
  return src.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

describe("démo des effets de verre retirée", () => {
  it("aucun fichier sous src/app/(app)/demo", () => {
    expect(existsSync(join(ROOT, "src/app/(app)/demo"))).toBe(false);
  });

  it.each(["fr", "en"])(
    "aucune clé glassDemo dans messages/%s.json",
    (locale) => {
      expect(
        Object.keys(JSON.parse(read(`messages/${locale}.json`))),
      ).not.toContain("glassDemo");
    },
  );

  it("aucune référence à isGlassDemoEnabled ni glass-demo dans src/", () => {
    expect(filesMatching(/isGlassDemoEnabled|glass-demo|demo-access/)).toEqual(
      [],
    );
  });

  it("aucune route /demo/ ni cookie d'intensité du givre dans src/", () => {
    expect(filesMatching(/\/demo\/|glass-demo-frost|FROST_LEVEL/)).toEqual([]);
  });

  it("un seul chemin pour le cookie des hauteurs : plus de chemin passé par la page", () => {
    expect(
      filesMatching(/tileHeightsPath|SLOW_DASHBOARD_PATH|renderDashboard/),
    ).toEqual([]);
  });

  it("aucun raccourci lié à la démo dans src/", () => {
    expect(filesMatching(/raccourci:[^\n]*d[ée]mo/i)).toEqual([]);
  });

  it("aucune route /demo dans la build", () => {
    const routes = Object.values(
      JSON.parse(read(".next/app-path-routes-manifest.json")) as Record<
        string,
        string
      >,
    );
    expect(routes.length).toBeGreaterThan(0);
    expect(routes.filter((route) => route.startsWith("/demo"))).toEqual([]);
  });
});
