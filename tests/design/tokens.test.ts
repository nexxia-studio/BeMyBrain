import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { THEME_COLOR } from "@/lib/theme";

// Verrou de la charte (DESIGN.md) : globals.css porte les tokens clés, et aucune couleur
// hors de la référence validée (docs/design/references/dashboard-*.dc.html).
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
const design = readFileSync(join(process.cwd(), "DESIGN.md"), "utf8");

// Couleurs de base de la référence (les alphas sont libres : rgb(r g b / a)).
const REFERENCE_RGB = new Set([
  "232,236,245", // #E8ECF5 brume
  "175,192,244", // #AFC0F4 halo bleu
  "214,198,242", // #D6C6F2 halo lilas
  "188,226,236", // #BCE2EC halo aqua
  "27,32,51", // #1B2033 encre
  "83,90,114", // #535A72 encre secondaire
  "61,79,214", // #3D4FD6 indigo
  "43,58,168", // #2B3AA8 indigo profond
  "138,56,16", // #8A3810 braise
  "232,116,59", // #E8743B braise claire
  "38,48,92", // #26305C teinte des ombres
  "255,255,255", // blanc
]);

function hexToRgb(hex: string): string {
  const value = hex.slice(1);
  const full =
    value.length === 3
      ? value
          .split("")
          .map((c) => c + c)
          .join("")
      : value.slice(0, 6);
  return [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16)).join(",");
}

function declaredColors(source: string): string[] {
  const withoutComments = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const hexes = [...withoutComments.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map(
    ([hex]) => hexToRgb(hex),
  );
  const rgbs = [
    ...withoutComments.matchAll(
      /rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)[^)]*\)/g,
    ),
  ].map(([, r, g, b]) => `${r},${g},${b}`);
  return [...hexes, ...rgbs];
}

describe("charte dans globals.css", () => {
  it.each([
    "--background",
    "--foreground",
    "--primary",
    "--primary-foreground",
    "--muted-foreground",
    "--ring",
    "--destructive",
    "--link",
    "--glass-bg",
    "--glass-blur",
    "--glass-saturate",
    "--glass-border",
    "--shadow-glass",
    "--shadow-today",
    "--radius-tile",
    "--radius-bar",
    "--space-grid",
    "--font-sans",
    "--font-heading",
    "--text-display",
    "--text-eyebrow",
    "--halo-blue",
    "--halo-lilac",
    "--z-tabbar",
    "--on-primary-lead",
  ])("définit le token %s", (token) => {
    expect(css).toMatch(new RegExp(`${token}\\s*:`));
  });

  it("n'utilise aucune couleur hors de la référence validée", () => {
    const outside = declaredColors(css).filter(
      (rgb) => !REFERENCE_RGB.has(rgb),
    );
    expect(outside).toEqual([]);
  });

  it("ne garde ni les neutres oklch du scaffold ni de valeurs sombres inventées", () => {
    expect(css).not.toMatch(/oklch\(/);
    expect(css).not.toMatch(/\.dark\s*\{/);
  });

  it("coupe les animations sous prefers-reduced-motion", () => {
    expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  });

  it("raccorde Inter et Space Grotesk, sans les polices du scaffold", () => {
    expect(layout).toMatch(/\bInter\b/);
    expect(layout).toMatch(/\bSpace_Grotesk\b/);
    expect(layout).not.toMatch(/Geist/);
    expect(css).not.toMatch(/raccourci:/);
  });

  it("la palette de DESIGN.md et celle de globals.css sont identiques", () => {
    const documented = [
      ...design.matchAll(/^\| `(--[a-z-]+)` \| `(#[0-9A-Fa-f]{6})` \|/gm),
    ].map(([, name, hex]) => [name, hex.toLowerCase()]);

    const implemented = documented.map(([name]) => [
      name,
      css.match(new RegExp(`${name}\\s*:\\s*(#[0-9a-fA-F]{6})`))?.[1]?.toLowerCase(),
    ]);

    expect(documented).toHaveLength(11);
    expect(implemented).toEqual(documented);
  });

  it("la couleur de thème de la PWA est la brume de la charte", () => {
    const mist = css.match(/--mist\s*:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(mist).toBeDefined();
    expect(THEME_COLOR.toLowerCase()).toBe(mist?.toLowerCase());
  });
});
