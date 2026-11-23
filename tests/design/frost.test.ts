import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Verrou du givre de chargement (DESIGN.md § 5 « États de chargement — givre », § 11).
const FROST_LEVEL_VARS = ["--frost-from", "--frost-to", "--frost-rest"];
const ALLOWED_COLORS = ["--halo-blue", "--halo-lilac"];
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");

/** Bloc entre accolades qui suit `start` (accolades imbriquées comprises). */
function blockAfter(source: string, start: string): string {
  const at = source.indexOf(start);
  expect(at, `${start} introuvable`).toBeGreaterThanOrEqual(0);
  const open = source.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    if (source[i] === "{") depth++;
    if (source[i] === "}") depth--;
    if (depth === 0) return source.slice(open + 1, i);
  }
  throw new Error("bloc non fermé");
}

const keyframes = blockAfter(css, "@keyframes frost-clear");
const root = blockAfter(css, ":root {");
const utility = blockAfter(css, "@utility frost");
const reducedMotion = blockAfter(
  utility,
  "@media (prefers-reduced-motion: reduce)",
);

describe("givre de chargement (globals.css)", () => {
  it("frost-clear n'anime que opacity", () => {
    const properties = [...keyframes.matchAll(/([a-z-]+)\s*:/g)].map(
      (m) => m[1],
    );
    expect(properties.length).toBeGreaterThan(0);
    expect(new Set(properties)).toEqual(new Set(["opacity"]));
    expect(keyframes).toMatch(/from\s*\{\s*opacity:\s*1;?\s*\}/);
    expect(keyframes).toMatch(
      /to\s*\{\s*opacity:\s*var\(--frost-rest\);?\s*\}/,
    );
  });

  it("pas d'infinite", () => {
    expect(utility).not.toMatch(/infinite/);
    expect(keyframes).not.toMatch(/infinite/);
  });

  it("fill-mode both, durée et décalage inchangés", () => {
    expect(utility).toMatch(/animation:\s*frost-clear\s[^;]*\bboth\b/);
    expect(utility).toMatch(
      /animation-delay:\s*calc\(var\(--frost-index,\s*0\)\s*\*\s*var\(--frost-stagger\)\)/,
    );
    expect(css).toMatch(/--frost-duration:\s*1\.3s;/);
    expect(css).toMatch(/--frost-stagger:\s*0\.18s;/);
  });

  it("défauts du cran sur :root = cran discret, retenu pour toute l'app (halos purs, repos 0,55)", () => {
    expect(root).toMatch(/--frost-rest:\s*0\.55;/);
    expect(root).toMatch(/--frost-from:\s*var\(--halo-blue\);/);
    expect(root).toMatch(/--frost-to:\s*var\(--halo-lilac\);/);
  });

  it("frost et frost-clear lisent les variables du cran sans les redéfinir", () => {
    for (const name of FROST_LEVEL_VARS) {
      expect(utility).not.toMatch(new RegExp(`${name}\\s*:`));
      expect(keyframes).not.toMatch(new RegExp(`${name}\\s*:`));
    }
    expect(utility).toMatch(
      /linear-gradient\(\s*135deg,\s*var\(--frost-from\),\s*var\(--frost-to\)\s*\)/,
    );
  });

  it("sous prefers-reduced-motion, opacité de repos sans animation", () => {
    expect(reducedMotion).toMatch(/animation:\s*none/);
    expect(reducedMotion).toMatch(/opacity:\s*var\(--frost-rest\)/);
  });

  it("couleurs du voile = var(--halo-blue|--halo-lilac|--primary|--popover) seulement", () => {
    const definitions = [
      utility,
      ...FROST_LEVEL_VARS.map((name) => {
        const match = root.match(new RegExp(`${name}:([^;]+);`));
        expect(match, `${name} absente de :root`).not.toBeNull();
        return match![1];
      }),
    ];
    for (const source of definitions) {
      expect(source).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
      const colors = [...source.matchAll(/var\((--[a-z-]+)/g)]
        .map((m) => m[1])
        .filter((name) => !name.startsWith("--frost-"));
      for (const color of colors) {
        expect(ALLOWED_COLORS).toContain(color);
      }
    }
  });

  it("jamais de backdrop-filter dans le voile", () => {
    expect(utility).not.toMatch(/backdrop-filter/);
    expect(keyframes).not.toMatch(/backdrop-filter/);
  });

  it("tant qu'un voile est affiché, le document n'ancre pas son défilement : le haut de page ne saute pas à l'arrivée du contenu", () => {
    const anchor = blockAfter(css, "html:has(.frost)");

    expect(anchor).toMatch(/overflow-anchor:\s*none/);
  });
});
