import { describe, expect, it } from "vitest";

import {
  TILE_HEIGHT_CLASSES,
  TILE_SIZE_CLASSES,
  tileClasses,
  TODAY_TILE_CLASSES,
  TODAY_TILE_HEIGHT_CLASSES,
} from "./tile-sizes";

const SIZES = ["wide", "standard", "figure"] as const;

/** Une hauteur fixe par palier d'écran : téléphone (sans préfixe), tablette (`sm:`), ordinateur (`lg:`). */
function heightsByBreakpoint(classes: string) {
  const names = classes.split(" ");
  return {
    base: names.filter((name) => /^min-h-\d/.test(name)),
    sm: names.filter((name) => /^sm:min-h-\d/.test(name)),
    lg: names.filter((name) => /^lg:min-h-\d/.test(name)),
  };
}

describe("tailles et hauteurs des tuiles", () => {
  it.each(SIZES)(
    "la tuile %s a une hauteur et une seule par palier d'écran",
    (size) => {
      const heights = heightsByBreakpoint(TILE_HEIGHT_CLASSES[size]);

      expect(heights.base).toHaveLength(1);
      expect(heights.sm).toHaveLength(1);
      expect(heights.lg).toHaveLength(1);
    },
  );

  it("la tuile pleine « Aujourd'hui » a sa propre hauteur, une par palier d'écran", () => {
    const heights = heightsByBreakpoint(TODAY_TILE_HEIGHT_CLASSES);

    expect(heights.base).toHaveLength(1);
    expect(heights.sm).toHaveLength(1);
    expect(heights.lg).toHaveLength(1);
  });

  it("la base de largeur ne porte plus de hauteur : elle vit dans les classes de hauteur", () => {
    for (const size of SIZES) {
      expect(TILE_SIZE_CLASSES[size]).not.toMatch(/min-h|(^|\s)h-/);
    }
  });

  it("classes complètes : largeur puis hauteur, pour les vraies tuiles comme pour le givre", () => {
    expect(tileClasses("figure")).toBe(
      `min-w-0 ${TILE_SIZE_CLASSES.figure} ${TILE_HEIGHT_CLASSES.figure}`,
    );
    expect(TODAY_TILE_CLASSES).toBe(
      `min-w-0 ${TILE_SIZE_CLASSES.wide} ${TODAY_TILE_HEIGHT_CLASSES}`,
    );
  });
});
