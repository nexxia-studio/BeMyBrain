// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import fr from "../../messages/fr.json";
import manifest from "./manifest";

const design = readFileSync(join(process.cwd(), "DESIGN.md"), "utf8");

// Largeur et hauteur lues dans l'en-tête IHDR d'un PNG (octets 16 à 23).
function pngSize(path: string): string {
  const header = readFileSync(path);
  return `${header.readUInt32BE(16)}x${header.readUInt32BE(20)}`;
}

// Type de couleur IHDR (octet 25) : 4 et 6 portent un canal alpha.
function pngHasAlpha(path: string): boolean {
  return [4, 6].includes(readFileSync(path).readUInt8(25));
}

describe("manifeste de la PWA", () => {
  it("le manifeste déclare standalone, une icône 192, une 512 et une maskable", () => {
    const result = manifest();

    expect(result.display).toBe("standalone");
    expect(result.start_url).toBe("/dashboard");
    expect(result.scope).toBe("/");
    expect(result.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sizes: "192x192", type: "image/png" }),
      ]),
    );
  });

  it("déclare une icône 512 d'usage courant, sans purpose ou en any", () => {
    const icons = manifest().icons ?? [];

    const any512 = icons.filter(
      ({ sizes, type, purpose }) =>
        sizes === "512x512" &&
        type === "image/png" &&
        (purpose === undefined || purpose === "any"),
    );

    expect(any512).toHaveLength(1);
  });

  it("déclare une icône maskable 512 distincte de l'icône courante", () => {
    const icons = manifest().icons ?? [];

    const maskable = icons.filter(
      ({ sizes, purpose }) => sizes === "512x512" && purpose === "maskable",
    );
    const any512 = icons.find(
      ({ sizes, purpose }) => sizes === "512x512" && purpose !== "maskable",
    );

    expect(maskable).toHaveLength(1);
    expect(maskable[0].src).not.toBe(any512?.src);
  });

  it("chaque icône déclarée existe dans public/ à la taille annoncée", () => {
    const icons = manifest().icons ?? [];

    const actual = icons.map(({ src }) => {
      const path = join(process.cwd(), "public", src);
      return existsSync(path) ? pngSize(path) : "absente";
    });

    expect(actual).toEqual(icons.map(({ sizes }) => sizes));
  });

  it("theme_color et background_color égalent les tokens de DESIGN.md", () => {
    const documented = design.match(
      /`theme_color` et `background_color` : `(#[0-9A-Fa-f]{6})`/,
    )?.[1];

    const result = manifest();

    expect(documented).toBeDefined();
    expect(result.theme_color?.toLowerCase()).toBe(documented?.toLowerCase());
    expect(result.background_color?.toLowerCase()).toBe(
      documented?.toLowerCase(),
    );
  });

  it("nom et description viennent des messages fr", () => {
    const result = manifest();

    expect(result.lang).toBe("fr");
    expect(result.name).toBe(fr.app.name);
    expect(result.short_name).toBe(fr.app.name);
    expect(result.description).toBe(fr.app.description);
  });

  it("l'icône Apple fait 180 × 180 et n'a pas de transparence", () => {
    const path = join(process.cwd(), "public/icons/apple-touch-icon.png");

    const size = pngSize(path);

    expect(size).toBe("180x180");
    expect(pngHasAlpha(path)).toBe(false);
  });
});
