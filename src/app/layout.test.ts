// @vitest-environment node
import { describe, expect, it, vi } from "vitest";

// next/font n'existe qu'au build de Next : polices factices.
vi.mock("next/font/google", () => ({
  Inter: () => ({ variable: "font-inter" }),
  Space_Grotesk: () => ({ variable: "font-space-grotesk" }),
}));

import { viewport } from "./layout";

describe("viewport de l'app", () => {
  it("Android redimensionne la page à l'ouverture du clavier (le tiroir d'ajout rapide reste visible)", () => {
    expect(viewport.interactiveWidget).toBe("resizes-content");
  });
});
