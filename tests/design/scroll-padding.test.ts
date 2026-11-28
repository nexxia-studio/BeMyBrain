import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync("src/app/globals.css", "utf8");
const field = readFileSync("src/components/shopping/QuickAddField.tsx", "utf8");

describe("scroll-padding du champ d'ajout collant", () => {
  it("la page réserve sous le focus la hauteur du champ (et de la barre d'onglets sous 1024 px)", () => {
    expect(css).toMatch(
      /html:has\(\[data-quick-add\]\)\s*\{\s*scroll-padding-bottom:\s*var\(--toast-above-field\);/,
    );
    expect(css).toMatch(
      /@media \(min-width: 1024px\)\s*\{\s*scroll-padding-bottom:\s*var\(--toast-above-field-lg\);/,
    );
  });

  it("le champ porte le repère data-quick-add", () => {
    expect(field).toContain('data-quick-add=""');
  });
});
