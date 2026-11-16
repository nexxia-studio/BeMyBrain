import { describe, expect, it } from "vitest";

import { paletteDurations } from "./palette-motion";

describe("durées de la palette", () => {
  it("ouvre en 0,2 s et ferme en 0,15 s sans préférence", () => {
    expect(paletteDurations(false)).toEqual({ enter: 0.2, exit: 0.15 });
  });

  it("ne dépasse pas 0,15 s en mouvement réduit (DESIGN.md § 7)", () => {
    const { enter, exit } = paletteDurations(true);
    expect(enter).toBeLessThanOrEqual(0.15);
    expect(exit).toBeLessThanOrEqual(0.15);
  });
});
