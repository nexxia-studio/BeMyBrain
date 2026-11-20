import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import { TILE_SIZE_CLASSES } from "@/components/bento/tile-sizes";

import messages from "../../../../messages/fr.json";

vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "dashboard") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));

import DashboardLoading from "./loading";

async function renderLoading() {
  const { container } = render(await DashboardLoading());
  const frost = screen.getByTestId("dashboard-frost");
  const tiles = Array.from(frost.children) as HTMLElement[];
  return { container, frost, tiles };
}

function hasClasses(element: HTMLElement, classes: string) {
  return classes.split(" ").every((name) => element.classList.contains(name));
}

describe("chargement du tableau de bord", () => {
  it("affiche le titre, un statut chargement et des tuiles givrées", async () => {
    const { frost, tiles } = await renderLoading();

    expect(
      screen.getByRole("heading", { level: 1, name: messages.dashboard.title }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      messages.dashboard.loading,
    );
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(frost.getAttribute("aria-hidden")).toBe("true");
    expect(frost.textContent).toBe("");
    expect(tiles.length).toBeGreaterThanOrEqual(2);
    tiles.slice(1).forEach((tile, i) => {
      expect(tile.querySelector(".frost")).not.toBeNull();
      expect(tile.style.getPropertyValue("--frost-index")).toBe(String(i + 1));
    });
  });

  it("plus aucune ligne de squelette", async () => {
    const { container } = await renderLoading();

    expect(screen.queryByTestId("dashboard-skeleton")).toBeNull();
    expect(container.querySelectorAll("span")).toHaveLength(0);
    expect(
      container.querySelectorAll(".bg-on-primary-surface, .bg-track, .bg-row"),
    ).toHaveLength(0);
  });

  it("la tuile pleine n'a pas de voile", async () => {
    const {
      tiles: [solid],
    } = await renderLoading();

    expect(solid.classList.contains("bg-primary")).toBe(true);
    expect(solid.classList.contains("glass")).toBe(false);
    expect(solid.childElementCount).toBe(0);
  });

  it("les tuiles reprennent les classes de taille de la grille", async () => {
    const { frost, tiles } = await renderLoading();

    // Même conteneur que BentoGrid ; « Aujourd'hui » puis la To-do du côté, toutes deux larges.
    expect(hasClasses(frost, "flex flex-wrap gap-grid")).toBe(true);
    expect(hasClasses(tiles[0], TILE_SIZE_CLASSES.wide)).toBe(true);
    expect(hasClasses(tiles[1], TILE_SIZE_CLASSES.wide)).toBe(true);
    for (const tile of tiles) {
      expect(tile.classList.contains("min-w-0")).toBe(true);
      expect(
        Object.values(TILE_SIZE_CLASSES).some((classes) =>
          hasClasses(tile, classes),
        ),
      ).toBe(true);
    }
  });
});
