import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Verrou du givre de chargement (DESIGN.md § 5 « États de chargement — givre », § 11).
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

  it("fill-mode both", () => {
    expect(utility).toMatch(/animation:\s*frost-clear\s[^;]*\bboth\b/);
    expect(utility).toMatch(
      /animation-delay:\s*calc\(var\(--frost-index,\s*0\)\s*\*\s*var\(--frost-stagger\)\)/,
    );
    expect(css).toMatch(/--frost-rest:\s*0\.45;/);
    expect(css).toMatch(/--frost-duration:\s*1\.3s;/);
    expect(css).toMatch(/--frost-stagger:\s*0\.18s;/);
  });

  it("sous prefers-reduced-motion, opacité de repos sans animation", () => {
    expect(reducedMotion).toMatch(/animation:\s*none/);
    expect(reducedMotion).toMatch(/opacity:\s*var\(--frost-rest\)/);
  });

  it("couleurs du voile = var(--halo-blue|--halo-lilac|--popover) seulement", () => {
    expect(utility).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(|hsl\(|oklch\(/i);
    const vars = new Set(
      [...utility.matchAll(/var\((--[a-z-]+)/g)].map((m) => m[1]),
    );
    const colors = [...vars].filter((name) => !name.startsWith("--frost-"));
    expect(new Set(colors)).toEqual(
      new Set(["--halo-blue", "--halo-lilac", "--popover"]),
    );
    expect(utility).toMatch(
      /linear-gradient\(\s*135deg,\s*color-mix\(in srgb, var\(--halo-blue\) 75%, var\(--popover\)\),\s*color-mix\(in srgb, var\(--halo-lilac\) 75%, var\(--popover\)\)\s*\)/,
    );
  });

  it("jamais de backdrop-filter dans le voile", () => {
    expect(utility).not.toMatch(/backdrop-filter/);
    expect(keyframes).not.toMatch(/backdrop-filter/);
  });
});
