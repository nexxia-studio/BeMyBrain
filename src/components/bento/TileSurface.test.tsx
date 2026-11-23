import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import { TileSurface } from "./TileSurface";

// Calque du reflet (DESIGN.md § 7, ligne « Reflet ») : rendu par React dans chaque surface de verre de la
// grille, animé par GSAP à la fin de la révélation (src/components/signature/bento-reveal.tsx).

const css = readFileSync(
  path.join(process.cwd(), "src/app/globals.css"),
  "utf8",
);

function sheenUtility(): string {
  const match = /@utility sheen \{([\s\S]*?)\n\}/.exec(css);
  if (!match?.[1]) throw new Error("utilitaire sheen absent de globals.css");
  return match[1];
}

describe("surface de tuile", () => {
  it("rend un calque aria-hidden hors champ sous le contenu", () => {
    const { container } = render(
      <TileSurface className="glass p-tile">
        <p>contenu</p>
      </TileSurface>,
    );

    const surface = container.firstElementChild as HTMLElement;
    const layer = surface.firstElementChild as HTMLElement;
    // Surface : contexte d'empilement propre, le calque ne déborde pas.
    expect(surface.className.split(/\s+/)).toEqual(
      expect.arrayContaining(["relative", "isolate", "overflow-hidden"]),
    );
    // Premier enfant, avant le contenu ; invisible des lecteurs d'écran ; repère pour GSAP.
    expect(layer.hasAttribute("data-sheen")).toBe(true);
    expect(layer.getAttribute("aria-hidden")).toBe("true");
    expect(layer.className.split(/\s+/)).toContain("sheen");
    expect(layer.nextElementSibling?.textContent).toBe("contenu");
    // Aucun style en ligne : la position de repos vient de la classe.
    expect(layer.getAttribute("style")).toBeNull();

    const rules = sheenUtility();
    expect(rules).toMatch(/position:\s*absolute/);
    expect(rules).toMatch(/inset:\s*0/);
    expect(rules).toMatch(/z-index:\s*-1/);
    expect(rules).toMatch(/pointer-events:\s*none/);
    expect(rules).toMatch(/border-radius:\s*inherit/);
    expect(rules).toMatch(/transform:\s*translateX\(-110%\)/);
    expect(rules).toMatch(/will-change:\s*transform;/);
    // Mouvement réduit : aucun calque visible.
    expect(rules).toMatch(
      /@media \(prefers-reduced-motion: reduce\) \{\s*display:\s*none;/,
    );
  });

  it("garde les classes de la tuile", () => {
    const { container } = render(
      <TileSurface className="glass p-tile">x</TileSurface>,
    );

    expect(
      (container.firstElementChild as HTMLElement).className.split(/\s+/),
    ).toEqual(expect.arrayContaining(["glass", "p-tile"]));
  });
});
