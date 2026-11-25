import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { CHIP_SHAPE_CLASSES, contextColorClass } from "./context-chip-class";
import {
  isRowPriority,
  PRIORITY_BADGE_CLASSES,
  PRIORITY_ICONS,
  PRIORITY_TINT_CLASSES,
  type PriorityLevel,
} from "./priority-icons";

// Verrou des teintes de priorité (DESIGN.md § 2 et § 5, décision d'Antoine du 2026-11-25) : les valeurs sont
// lues dans globals.css, les contrastes recalculés ici (WCAG 2.x), sur les trois surfaces où un badge se pose.
const css = readFileSync(join(process.cwd(), "src/app/globals.css"), "utf8");
const root = css.slice(
  css.indexOf(":root {"),
  css.indexOf("\n}\n", css.indexOf(":root {")),
);

const LEVELS = [1, 2, 3, 4] as const satisfies readonly PriorityLevel[];
const TOKEN: Record<PriorityLevel, string> = {
  1: "priority-urgent",
  2: "priority-high",
  3: "priority-medium",
  4: "priority-low",
};

type Rgba = { rgb: [number, number, number]; alpha: number };

/** Valeur d'une variable de `:root` (mobile), `var(--x)` suivi jusqu'à une couleur. */
function rootValue(name: string): string {
  const value = root.match(new RegExp(`\\n\\s*--${name}:\\s*([^;]+);`))?.[1];
  if (value === undefined) {
    throw new Error(`--${name} absent de :root`);
  }
  const ref = value.match(/^var\(--([a-z0-9-]+)\)$/)?.[1];
  return ref === undefined ? value.trim() : rootValue(ref);
}

function color(name: string): Rgba {
  const value = rootValue(name);
  const hex = value.match(/^#([0-9a-f]{6})$/i)?.[1];
  if (hex !== undefined) {
    return {
      rgb: [0, 2, 4].map((i) =>
        parseInt(hex.slice(i, i + 2), 16),
      ) as Rgba["rgb"],
      alpha: 1,
    };
  }
  const rgb = value.match(/^rgb\((\d+) (\d+) (\d+)(?: \/ ([\d.]+))?\)$/);
  if (rgb === null) {
    throw new Error(`--${name} : format de couleur inattendu`);
  }
  return {
    rgb: [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])],
    alpha: rgb[4] === undefined ? 1 : Number(rgb[4]),
  };
}

/** `top` posé sur `under` (opaque). */
function over(top: Rgba, under: Rgba["rgb"]): Rgba["rgb"] {
  return top.rgb.map((channel, i) =>
    Math.round(channel * top.alpha + under[i] * (1 - top.alpha)),
  ) as Rgba["rgb"];
}

function luminance(rgb: Rgba["rgb"]): number {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: Rgba["rgb"], b: Rgba["rgb"]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

// OKLab (Björn Ottosson) : clarté, teinte et écart perçu entre deux couleurs.
function oklab(rgb: Rgba["rgb"]): [number, number, number] {
  const [r, g, b] = rgb.map((channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function hue(rgb: Rgba["rgb"]): number {
  const [, a, b] = oklab(rgb);
  return ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
}

function hueGap(a: Rgba["rgb"], b: Rgba["rgb"]): number {
  const gap = Math.abs(hue(a) - hue(b));
  return Math.min(gap, 360 - gap);
}

function distance(a: Rgba["rgb"], b: Rgba["rgb"]): number {
  const [x, y] = [oklab(a), oklab(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}

const mist = color("mist").rgb;
// Cœur du halo bleu mobile (90 % sur la brume) : le fond le plus sombre de l'app (DESIGN.md § 2).
const haloCore = over({ rgb: color("halo-blue").rgb, alpha: 0.9 }, mist);
// Les trois surfaces d'un badge : carte blanche, ligne `row` sur verre, colonne creusée `pill-track` sur brume.
const SURFACES: Record<string, Rgba["rgb"]> = {
  popover: color("popover").rgb,
  row: over(color("row-bg"), over(color("glass-bg"), mist)),
  "pill-track": over(color("pill-track"), mist),
  // Pires cas : les mêmes surfaces au cœur du halo bleu.
  "row au cœur du halo": over(
    color("row-bg"),
    over(color("glass-bg"), haloCore),
  ),
  "pill-track au cœur du halo": over(color("pill-track"), haloCore),
};

describe("icônes et teintes de priorité", () => {
  it("chaque niveau 1 à 4 a une icône distincte : la couleur ne porte jamais seule l'information", () => {
    const icons = LEVELS.map((level) => PRIORITY_ICONS[level]);

    expect(icons.every((icon) => icon !== undefined)).toBe(true);
    expect(new Set(icons).size).toBe(4);
  });

  it("chaque niveau 1 à 4 a une icône et une teinte distinctes, 0 n'a rien", () => {
    expect(new Set(LEVELS.map((level) => PRIORITY_ICONS[level])).size).toBe(4);
    expect(
      new Set(LEVELS.map((level) => PRIORITY_TINT_CLASSES[level])).size,
    ).toBe(4);
    for (const level of LEVELS) {
      expect(PRIORITY_ICONS[level]).toBeDefined();
      expect(PRIORITY_TINT_CLASSES[level]).toBe(
        `bg-${TOKEN[level]} text-${TOKEN[level]}-foreground`,
      );
    }

    expect(Object.keys(PRIORITY_ICONS)).toEqual(["1", "2", "3", "4"]);
    expect(Object.keys(PRIORITY_TINT_CLASSES)).toEqual(["1", "2", "3", "4"]);
    expect(isRowPriority(0)).toBe(false);
  });

  it("chaque token cité existe dans globals.css, mappé comme les pastilles d'espace", () => {
    for (const level of LEVELS) {
      const token = TOKEN[level];
      expect(css).toMatch(new RegExp(`--${token}-bg:\\s*rgb\\(`));
      expect(css).toMatch(new RegExp(`--${token}-fg:\\s*#[0-9a-f]{6};`));
      expect(css).toContain(`--color-${token}: var(--${token}-bg);`);
      expect(css).toContain(`--color-${token}-foreground: var(--${token}-fg);`);
    }
  });

  it.each(LEVELS)(
    "niveau %i : texte et icône à 4,5:1 au moins sur leur fond, sur chaque surface, cœur du halo compris",
    (level) => {
      const bg = color(`${TOKEN[level]}-bg`);
      const fg = color(`${TOKEN[level]}-fg`).rgb;

      const ratios = Object.values(SURFACES).map((surface) =>
        contrast(fg, over(bg, surface)),
      );

      expect(ratios).toHaveLength(5);
      expect(Math.min(...ratios)).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("le jaune de « Moyenne » porte une encre brun-olive foncée, à 4,5:1 au moins sur chaque surface", () => {
    const bg = color("priority-medium-bg");
    const fg = color("priority-medium-fg").rgb;

    // Un fond jaune est le plus clair des quatre : l'encre doit être foncée, pas un jaune.
    expect(hue(over(bg, SURFACES.popover))).toBeGreaterThan(90);
    expect(hue(over(bg, SURFACES.popover))).toBeLessThan(110);
    expect(oklab(fg)[0]).toBeLessThan(0.45);
    for (const surface of Object.values(SURFACES)) {
      expect(contrast(fg, over(bg, surface))).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("l'échelle se lit rouge, orangé, jaune, vert : teintes des fonds dans cet ordre", () => {
    const hues = LEVELS.map((level) =>
      hue(over(color(`${TOKEN[level]}-bg`), SURFACES.popover)),
    );

    // Rouge rosé autour de 0° (compté au-delà de 340° ou sous 30°), puis teintes croissantes jusqu'au vert.
    expect(hues[0] > 340 || hues[0] < 30).toBe(true);
    expect(hues[1]).toBeGreaterThan(45);
    expect(hues[2]).toBeGreaterThan(hues[1] + 15);
    expect(hues[3]).toBeGreaterThan(hues[2] + 40);
    expect(hues[3]).toBeLessThan(180);
  });

  it("le fond orangé de « Haute » ne se confond pas avec la pastille d'espace chaude", () => {
    const high = color("priority-high-bg");
    const warm = color("chip-warm-bg");

    // Seuil : 0,015 en OKLab, l'écart le plus faible déjà admis entre deux fonds voisins de la charte
    // (pastilles neutre et chaude : 0,025 sur blanc). En dessous, deux fonds pastel côte à côte se lisent
    // comme un seul. La forme fait le reste (badge carré à icône, pastille à nom).
    for (const name of ["popover", "row", "pill-track"]) {
      const surface = SURFACES[name];
      expect(
        distance(over(high, surface), over(warm, surface)),
      ).toBeGreaterThanOrEqual(0.015);
    }
  });

  it("le rouge de « Urgente » n'est pas la braise : plus rosé, plus sombre", () => {
    const ember = color("ember").rgb;
    const fg = color("priority-urgent-fg").rgb;

    // Seuil : 20° de teinte, de quoi lire un rouge rosé à côté d'un brun orangé ; la braise (43°) reste le
    // texte du retard et des erreurs, sans fond.
    expect(hueGap(fg, ember)).toBeGreaterThanOrEqual(20);
    expect(hue(fg)).toBeLessThan(hue(ember));
    expect(distance(fg, ember)).toBeGreaterThanOrEqual(0.06);
  });

  it("le badge de priorité a sa forme propre, jamais celle d'une pastille d'espace", () => {
    expect(PRIORITY_BADGE_CLASSES).not.toContain("rounded-full");
    expect(PRIORITY_BADGE_CLASSES).toContain("rounded-sm");
    expect(PRIORITY_BADGE_CLASSES).toContain("size-5");
    expect(CHIP_SHAPE_CLASSES).toContain("rounded-full");
  });

  it("les quatre fonds diffèrent deux à deux et des trois fonds de pastille d'espace", () => {
    const chips = Object.keys(contextColorClass).map(
      (name) => `chip-${name}-bg`,
    );
    const names = [...LEVELS.map((level) => `${TOKEN[level]}-bg`), ...chips];

    expect(chips).toHaveLength(3);
    for (const surface of Object.values(SURFACES)) {
      const rendered = names.map((name) =>
        over(color(name), surface).join(","),
      );
      expect(new Set(rendered).size).toBe(names.length);
    }
  });

  it("aucune encre de teinte n'est la braise, l'indigo profond ni l'encre", () => {
    const reserved = ["ember", "indigo-deep", "ink"].map((name) =>
      color(name).rgb.join(","),
    );

    for (const level of LEVELS) {
      expect(reserved).not.toContain(color(`${TOKEN[level]}-fg`).rgb.join(","));
    }
  });
});
