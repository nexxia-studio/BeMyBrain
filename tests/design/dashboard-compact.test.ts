import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

// Verrous de QA-5 d'effets-de-verre (décisions d'Antoine du 2026-11-23) : plus d'état de remplissage dans les
// tuiles du tableau de bord, plus de césure automatique dans l'interface.
const read = (path: string) => readFileSync(join(process.cwd(), path), "utf8");

describe("tuiles à la hauteur du contenu, sans césure", () => {
  it("plus d'état de remplissage : ni TileRest, ni phrase « Rien d'autre … » (FR, EN)", () => {
    expect(
      existsSync(join(process.cwd(), "src/components/bento/TileRest.tsx")),
    ).toBe(false);
    for (const locale of ["fr", "en"]) {
      const messages = JSON.parse(read(`messages/${locale}.json`));
      expect(messages.dashboard.today).not.toHaveProperty("nothingElse");
      expect(messages.dashboard.tiles).not.toHaveProperty("nothingElse");
    }
  });

  it("aucune césure automatique : ni hyphens: auto dans globals.css, ni règle dans DESIGN.md", () => {
    expect(read("src/app/globals.css")).not.toMatch(/hyphens\s*:\s*auto/);
    expect(read("DESIGN.md")).not.toMatch(/hyphens: auto/);
  });
});

// QA-6 : hauteurs relevées réservées par le givre. Les paliers (`--tile-tier`, lu par le relevé) et la hauteur
// appliquée par palier (`.tile-reserve`) sont posés dans les blocs mêmes qui règlent la grille (`--space-grid`) :
// une seule source des seuils, jamais recopiée en JavaScript.
describe("paliers des hauteurs mémorisées", () => {
  const css = read("src/app/globals.css");
  /** Corps du premier bloc qui commence par `opening` (accolades équilibrées). */
  const blockAfter = (opening: string) => {
    const start = css.indexOf(opening);
    expect(start).toBeGreaterThan(-1);
    let depth = 0;
    for (let i = css.indexOf("{", start); i < css.length; i += 1) {
      if (css[i] === "{") depth += 1;
      if (css[i] === "}") depth -= 1;
      if (depth === 0) return css.slice(start, i + 1);
    }
    throw new Error("bloc non fermé");
  };

  it.each([
    ["mobile (:root)", ":root {\n  color-scheme: light;", "sm"],
    ["tablette (≥ 640 px)", "@media (min-width: 640px) {", "md"],
    ["ordinateur (≥ 1024 px)", "@media (min-width: 1024px) {", "lg"],
  ])("%s : palier et hauteur réservée posés avec l'espacement de la grille", (_, opening, tier) => {
    const block = blockAfter(opening);

    expect(block).toMatch(/--space-grid:/);
    expect(block).toContain(`--tile-tier: ${tier};`);
    if (tier !== "sm") {
      expect(block).toMatch(
        new RegExp(`\\.tile-reserve \\{\\s*height: var\\(--tile-h-${tier}, auto\\);`),
      );
    }
  });

  it("hors palier : hauteur du palier mobile, sinon celle du contenu (cale), débord coupé", () => {
    const block = blockAfter(".tile-reserve {");

    expect(block).toContain("height: var(--tile-h-sm, auto);");
    expect(block).toContain("overflow: hidden;");
  });
});
