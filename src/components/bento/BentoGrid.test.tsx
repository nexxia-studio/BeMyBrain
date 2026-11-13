import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  BENTO_REVEAL_SIGNATURE_KEY,
  DASHBOARD_INTRO_SIGNATURE_KEY,
  EMPTY_STATE_SIGNATURE_KEY,
  SIDE_SWITCH_SIGNATURE_KEY,
  SIDE_SWITCH_TILES_SIGNATURE_KEY,
  SIGNATURE_PENDING_ATTRIBUTE,
} from "@/components/signature/signature-keys";

// Les moments GSAP sont testés à part (src/components/signature/) : ici, la grille seule.
vi.mock("next/dynamic", () => ({ default: () => () => null }));

function stubReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: reduce ? query.includes(": reduce") : false,
    media: query,
  }));
}

async function renderGrid() {
  // Décision « au chargement du document » : module neuf à chaque test.
  vi.resetModules();
  const { BentoGrid } = await import("./BentoGrid");
  return render(
    <BentoGrid side="private">
      <div data-signature="reveal" />
    </BentoGrid>,
  );
}

const html = () => document.documentElement;

beforeEach(() => {
  sessionStorage.clear();
  html().removeAttribute(SIGNATURE_PENDING_ATTRIBUTE);
  stubReducedMotion(false);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("grille bento", () => {
  it("masque les cibles des moments en attente dès le montage (arrivée par navigation côté client)", async () => {
    await renderGrid();

    expect(html().getAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(
      "intro reveal empty",
    );
  });

  it("ne masque rien quand l'entrée a déjà été jouée dans la session", async () => {
    for (const key of [
      DASHBOARD_INTRO_SIGNATURE_KEY,
      BENTO_REVEAL_SIGNATURE_KEY,
      EMPTY_STATE_SIGNATURE_KEY,
    ]) {
      sessionStorage.setItem(key, "1");
    }

    await renderGrid();

    expect(html().hasAttribute(SIGNATURE_PENDING_ATTRIBUTE)).toBe(false);
  });

  it("consomme le fondu des tuiles si la pilule a déjà glissé avant l'affichage de la grille", async () => {
    sessionStorage.setItem(SIDE_SWITCH_SIGNATURE_KEY, "1");

    await renderGrid();

    expect(
      sessionStorage.getItem(SIDE_SWITCH_TILES_SIGNATURE_KEY),
    ).not.toBeNull();
  });

  it("rend ses tuiles", async () => {
    const { container } = await renderGrid();

    expect(container.querySelectorAll('[data-signature="reveal"]')).toHaveLength(
      1,
    );
  });
});
