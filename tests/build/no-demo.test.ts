// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";

import { describe, expect, it } from "vitest";

// Démos fermées (BRAIN-33, tâche 9 des effets de verre ; spec, scénario 7). Lancé par `pnpm test:build`, après
// `next build` : vérifie le code source et la build. Seules les démos temporaires listées ici sont admises ;
// tout autre dossier, route ou raccourci de démo est refusé.
// /demo/kanban (BRAIN-46) : retirée à la dernière tâche de docs/features/todo-kanban/plan.md, qui vide cette liste.
const ALLOWED_DEMOS: readonly string[] = ["/demo/kanban"];

const ROOT = process.cwd();
const DEMO_DIR = "src/app/(app)/demo";
const read = (path: string) => readFileSync(join(ROOT, path), "utf8");

const allowedSegments = ALLOWED_DEMOS.map((route) =>
  route.slice("/demo/".length),
);
const allowedDirs = allowedSegments.map((segment) =>
  join(DEMO_DIR, segment),
);

function sourceFiles(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(ROOT, join(entry.parentPath, entry.name)));
}

const src = sourceFiles("src").map((file) => ({
  file,
  text: readFileSync(join(ROOT, file), "utf8"),
}));

function filesMatching(pattern: RegExp): string[] {
  return src.filter(({ text }) => pattern.test(text)).map(({ file }) => file);
}

/** Fichier d'une démo admise : elle seule peut parler d'elle-même (garde, raccourci). */
function inAllowedDemo(file: string): boolean {
  return allowedDirs.some((dir) => file.startsWith(dir + sep));
}

function isAllowedRoute(route: string): boolean {
  return ALLOWED_DEMOS.some(
    (allowed) => route === allowed || route.startsWith(`${allowed}/`),
  );
}

describe("démos fermées, sauf les démos temporaires listées", () => {
  it("aucun dossier sous src/app/(app)/demo hors des démos admises", () => {
    const dirs = existsSync(join(ROOT, DEMO_DIR))
      ? readdirSync(join(ROOT, DEMO_DIR))
      : [];

    expect(dirs.filter((name) => !allowedSegments.includes(name))).toEqual([]);
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
    expect(filesMatching(/isGlassDemoEnabled|glass-demo/)).toEqual([]);
  });

  it("garde demo-access seulement dans une démo admise", () => {
    expect(
      filesMatching(/demo-access/).filter((file) => !inAllowedDemo(file)),
    ).toEqual([]);
  });

  it("aucune route /demo/ hors des démos admises ni cookie d'intensité du givre dans src/", () => {
    const routes = src.flatMap(({ file, text }) =>
      [...text.matchAll(/\/demo\/[A-Za-z0-9_-]*/g)]
        .map(([route]) => route)
        .filter((route) => !isAllowedRoute(route))
        .map((route) => `${file} : ${route}`),
    );

    expect(routes).toEqual([]);
    expect(filesMatching(/glass-demo-frost|FROST_LEVEL/)).toEqual([]);
  });

  it("un seul chemin pour le cookie des hauteurs : plus de chemin passé par la page", () => {
    expect(
      filesMatching(/tileHeightsPath|SLOW_DASHBOARD_PATH|renderDashboard/),
    ).toEqual([]);
  });

  it("raccourci lié à une démo seulement dans une démo admise", () => {
    expect(
      filesMatching(/raccourci:[^\n]*d[ée]mo/i).filter(
        (file) => !inAllowedDemo(file),
      ),
    ).toEqual([]);
  });

  it("aucune route /demo dans la build hors des démos admises", () => {
    const routes = Object.values(
      JSON.parse(read(".next/app-path-routes-manifest.json")) as Record<
        string,
        string
      >,
    );

    expect(routes.length).toBeGreaterThan(0);
    expect(
      routes.filter(
        (route) => route.startsWith("/demo") && !isAllowedRoute(route),
      ),
    ).toEqual([]);
  });
});
