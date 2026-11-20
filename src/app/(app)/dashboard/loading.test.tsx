import { render, screen } from "@testing-library/react";
import { createTranslator } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TILE_SIZE_CLASSES } from "@/components/bento/tile-sizes";
import { buildDashboard } from "@/modules/dashboard/tiles";

import messages from "../../../../messages/fr.json";

const loadSideSpaces = vi.hoisted(() => vi.fn());
const pageHeaderProps = vi.hoisted(() => vi.fn());

vi.mock("@/lib/context-filter", () => ({ loadSideSpaces }));
vi.mock("next-intl/server", () => ({
  getTranslations: async (namespace: "dashboard") =>
    createTranslator({ locale: "fr", messages, namespace }),
}));
// En-tête de page : composant serveur asynchrone (testé à part), remplacé ici par son seul titre.
vi.mock("@/components/shell/PageHeader", () => ({
  PageHeader: (props: { title: string }) => {
    pageHeaderProps(props);
    return <h1>{props.title}</h1>;
  },
}));

import DashboardLoading from "./loading";

const PERSO = {
  id: "1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d",
  name: "Perso",
  color: "neutral",
} as const;
const TRUSTUP = {
  id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b",
  name: "Trustup",
  color: "warm",
} as const;
const NEXXIA = {
  id: "9a8b7c6d-5e4f-4a3b-9c2d-1e0f9a8b7c6d",
  name: "Nexxia",
  color: "indigo",
} as const;

const PRIVATE_SIDE = {
  side: "private",
  contexts: [PERSO],
  selected: [PERSO.id],
} as const;
const PRO_SIDE = {
  side: "pro",
  contexts: [TRUSTUP, NEXXIA],
  selected: [TRUSTUP.id, NEXXIA.id],
} as const;

async function renderLoading() {
  const { container } = render(await DashboardLoading());
  const frost = screen.getByTestId("dashboard-frost");
  const tiles = Array.from(frost.children) as HTMLElement[];
  return { container, frost, tiles };
}

function hasClasses(element: HTMLElement, classes: string) {
  return classes.split(" ").every((name) => element.classList.contains(name));
}

beforeEach(() => {
  vi.clearAllMocks();
  loadSideSpaces.mockResolvedValue(PRIVATE_SIDE);
});

describe("chargement du tableau de bord", () => {
  it("affiche le titre par l'en-tête de page, un statut chargement et des tuiles givrées", async () => {
    const { frost, tiles } = await renderLoading();

    expect(pageHeaderProps).toHaveBeenCalledWith({
      title: messages.dashboard.title,
      filterInert: true,
    });
    expect(
      screen.getByRole("heading", { level: 1, name: messages.dashboard.title }),
    ).toBeTruthy();
    expect(screen.getByRole("status").textContent).toBe(
      messages.dashboard.loading,
    );
    expect(screen.getByRole("main").getAttribute("aria-busy")).toBe("true");
    expect(frost.getAttribute("aria-hidden")).toBe("true");
    expect(frost.textContent).toBe("");
    tiles.slice(1).forEach((tile, i) => {
      expect(tile.querySelector(".frost")).not.toBeNull();
      expect(tile.style.getPropertyValue("--frost-index")).toBe(String(i + 1));
    });
  });

  it("pendant le chargement, le filtre d'espace est présent mais inerte et masqué (place réservée)", async () => {
    await renderLoading();

    expect(pageHeaderProps).toHaveBeenCalledWith(
      expect.objectContaining({ filterInert: true }),
    );
    expect(pageHeaderProps).not.toHaveBeenCalledWith(
      expect.objectContaining({ contextFilter: false }),
    );
  });

  it("plus aucune ligne de squelette", async () => {
    const { container } = await renderLoading();

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

  it.each([
    ["Privé, avec la paire de tuiles chiffre", PRIVATE_SIDE],
    ["Pro", PRO_SIDE],
  ])(
    "les tuiles givrées suivent la grille du côté %s, à ses classes de taille",
    async (_, side) => {
      loadSideSpaces.mockResolvedValue(side);
      const expected = buildDashboard(side).tiles.map((tile) => tile.size);

      const { frost, tiles } = await renderLoading();
      const [solid, ...glass] = tiles;

      expect(hasClasses(frost, "flex flex-wrap gap-grid")).toBe(true);
      expect(hasClasses(solid, `min-w-0 ${TILE_SIZE_CLASSES.wide}`)).toBe(true);
      expect(glass).toHaveLength(expected.length);
      glass.forEach((tile, i) => {
        expect(
          hasClasses(tile, `min-w-0 ${TILE_SIZE_CLASSES[expected[i]]}`),
        ).toBe(true);
      });
    },
  );

  it("sans espace sur le côté, seule la tuile pleine est rendue", async () => {
    loadSideSpaces.mockResolvedValue({
      side: "private",
      contexts: [],
      selected: [],
    });

    const { tiles } = await renderLoading();

    expect(tiles).toHaveLength(1);
    expect(tiles[0].classList.contains("bg-primary")).toBe(true);
  });
});
