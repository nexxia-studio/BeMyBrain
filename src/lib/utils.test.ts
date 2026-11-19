import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { cn } from "./utils";

describe("cn", () => {
  it("garde une taille de texte de la charte à côté d'une couleur", () => {
    expect(cn("text-small", "text-foreground")).toBe(
      "text-small text-foreground",
    );
    expect(cn("text-tab text-muted-foreground")).toBe(
      "text-tab text-muted-foreground",
    );
  });

  it("une taille de la charte remplace la précédente", () => {
    expect(cn("text-small", "text-body")).toBe("text-body");
    expect(cn("text-eyebrow text-caption")).toBe("text-caption");
  });

  it("une couleur de la charte reste une couleur", () => {
    expect(cn("text-foreground", "text-link")).toBe("text-link");
    expect(
      cn("text-chip text-primary-foreground", "text-muted-foreground"),
    ).toBe("text-chip text-muted-foreground");
  });

  it("reconnaît chaque taille déclarée dans @theme (globals.css)", () => {
    const css = readFileSync(
      join(process.cwd(), "src/app/globals.css"),
      "utf8",
    );
    const sizes = [...css.matchAll(/^\s*--text-([a-z-]+):/gm)]
      .map((match) => match[1])
      .filter((name) => !name.includes("--"));
    expect(sizes.length).toBeGreaterThan(10);
    for (const size of sizes) {
      expect(cn(`text-${size}`, "text-foreground")).toBe(
        `text-${size} text-foreground`,
      );
    }
  });
});
