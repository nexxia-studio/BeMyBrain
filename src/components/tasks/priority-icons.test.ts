import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { contextColorClass } from "./context-chip-class";
import {
  isRowPriority,
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

const mist = color("mist").rgb;
// Les trois surfaces d'un badge : carte blanche, ligne `row` sur verre, colonne creusée `pill-track` sur brume.
const SURFACES: Record<string, Rgba["rgb"]> = {
  popover: color("popover").rgb,
  row: over(color("row-bg"), over(color("glass-bg"), mist)),
  "pill-track": over(color("pill-track"), mist),
};

describe("icônes et teintes de priorité", () => {
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
    "niveau %i : texte et icône à 4,5:1 au moins sur leur fond, sur les trois surfaces",
    (level) => {
      const bg = color(`${TOKEN[level]}-bg`);
      const fg = color(`${TOKEN[level]}-fg`).rgb;

      for (const surface of Object.values(SURFACES)) {
        expect(contrast(fg, over(bg, surface))).toBeGreaterThanOrEqual(4.5);
      }
    },
  );

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
