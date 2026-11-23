import { describe, expect, it } from "vitest";

import * as tileSizes from "./tile-sizes";
import {
  BENTO_GRID_CLASSES,
  TILE_SIZE_CLASSES,
  tileClasses,
  TODAY_TILE_CLASSES,
} from "./tile-sizes";

const SIZES = ["wide", "standard", "figure"] as const;

/** Classes qui imposent une hauteur, à tous les paliers d'écran. */
const heightClasses = (classes: string) =>
  classes.split(/\s+/).filter((name) => /(^|:)(min-|max-)?h-/.test(name));

describe("tailles des tuiles (QA-5 : hauteur du contenu)", () => {
  it("plus aucune table de hauteurs fixes", () => {
    expect(tileSizes).not.toHaveProperty("TILE_HEIGHT_CLASSES");
    expect(tileSizes).not.toHaveProperty("TODAY_TILE_HEIGHT_CLASSES");
  });

  it.each(SIZES)("la tuile %s n'a aucune classe de hauteur", (size) => {
    expect(heightClasses(TILE_SIZE_CLASSES[size])).toEqual([]);
    expect(heightClasses(tileClasses(size))).toEqual([]);
  });

  it("la tuile pleine « Aujourd'hui » n'a aucune classe de hauteur", () => {
    expect(heightClasses(TODAY_TILE_CLASSES)).toEqual([]);
  });

  it("classes de place : largeur seule, pour les vraies tuiles comme pour le givre", () => {
    expect(tileClasses("figure")).toBe(`min-w-0 ${TILE_SIZE_CLASSES.figure}`);
    expect(TODAY_TILE_CLASSES).toBe(`min-w-0 ${TILE_SIZE_CLASSES.wide}`);
  });

  it("grille : rangées flex-wrap, tuiles d'une rangée étirées à la plus haute (alignées en bas), sans hauteur fixe", () => {
    const classes = BENTO_GRID_CLASSES.split(" ");

    expect(classes).toEqual(
      expect.arrayContaining(["flex", "flex-wrap", "gap-grid"]),
    );
    expect(classes.filter((name) => /^(items|content|self)-/.test(name))).toEqual(
      [],
    );
    expect(heightClasses(BENTO_GRID_CLASSES)).toEqual([]);
  });
});
