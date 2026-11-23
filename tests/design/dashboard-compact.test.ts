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
