import { render, screen } from "@testing-library/react";
import { createTranslator, NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TileCompactEmpty } from "@/components/bento/TileCompactEmpty";
import {
  BENTO_GRID_CLASSES,
  GLASS_TILE_BODY_CLASSES,
  tileClasses,
  TODAY_TILE_BODY_CLASSES,
  TODAY_TILE_CLASSES,
} from "@/components/bento/tile-sizes";
import { TodayHead } from "@/components/bento/TodayHead";
import { getUserTimeZone } from "@/modules/core/time-zone";
import { buildDashboard } from "@/modules/dashboard/tiles";

import messages from "../../../../messages/fr.json";

const loadSideSpaces = vi.hoisted(() => vi.fn());
const pageHeaderProps = vi.hoisted(() => vi.fn());
/** Cookies de la requête (`cookies()` de Next) : nom → valeur brute. */
const requestCookies = vi.hoisted(() => new Map<string, string>());

vi.mock("@/lib/context-filter", () => ({ loadSideSpaces }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      requestCookies.has(name)
        ? { name, value: requestCookies.get(name) }
        : undefined,
  }),
}));
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

function withIntl(children: ReactNode) {
  return (
    <NextIntlClientProvider
      locale="fr"
      messages={messages}
      timeZone={getUserTimeZone()}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** Cale de hauteur d'une tuile givrée : son seul enfant qui n'est pas le voile. */
function strutOf(tile: HTMLElement) {
  const struts = Array.from(tile.children).filter(
    (child) => !child.classList.contains("frost"),
  ) as HTMLElement[];
  expect(struts).toHaveLength(1);
  return struts[0];
}

async function renderLoading() {
  const { container } = render(withIntl(await DashboardLoading()));
  const frost = screen.getByTestId("dashboard-frost");
  const tiles = Array.from(frost.children) as HTMLElement[];
  return { container, frost, tiles };
}

function hasClasses(element: HTMLElement, classes: string) {
  return classes.split(" ").every((name) => element.classList.contains(name));
}

beforeEach(() => {
  vi.clearAllMocks();
  requestCookies.clear();
  loadSideSpaces.mockResolvedValue(PRIVATE_SIDE);
});

const TILES_COOKIE = "bmb-dashboard-tiles";
const heightVars = (tile: HTMLElement) =>
  Object.fromEntries(
    ["sm", "md", "lg"]
      .map((tier) => [
        `--tile-h-${tier}`,
        tile.style.getPropertyValue(`--tile-h-${tier}`),
      ])
      .filter(([, value]) => value !== ""),
  );

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

  it("aucun squelette : le seul contenu d'une tuile givrée est une cale invisible et inerte", async () => {
    const { tiles } = await renderLoading();

    for (const tile of tiles) {
      const strut = strutOf(tile);
      expect(strut.classList.contains("invisible")).toBe(true);
      expect(strut.hasAttribute("inert")).toBe(true);
    }
  });

  it("la tuile pleine n'a pas de voile", async () => {
    const {
      tiles: [solid],
    } = await renderLoading();

    expect(solid.classList.contains("bg-primary")).toBe(true);
    expect(solid.classList.contains("glass")).toBe(false);
    expect(solid.querySelector(".frost")).toBeNull();
  });

  it.each([
    ["Privé, avec la paire de tuiles chiffre", PRIVATE_SIDE],
    ["Pro", PRO_SIDE],
  ])(
    "les tuiles givrées suivent la grille du côté %s, aux classes de place des vraies tuiles (tile-sizes.ts)",
    async (_, side) => {
      loadSideSpaces.mockResolvedValue(side);
      const expected = buildDashboard(side).tiles.map((tile) => tile.size);

      const { frost, tiles } = await renderLoading();
      const [solid, ...glass] = tiles;

      expect(hasClasses(frost, BENTO_GRID_CLASSES)).toBe(true);
      expect(hasClasses(solid, TODAY_TILE_CLASSES)).toBe(true);
      expect(glass).toHaveLength(expected.length);
      glass.forEach((tile, i) => {
        expect(hasClasses(tile, tileClasses(expected[i]))).toBe(true);
      });
      // Repères de l'e2e (ordre des tuiles du givre au contenu).
      expect(tiles.map((tile) => tile.dataset.testid)).toEqual([
        "frost-tile-today",
        ...buildDashboard(side).tiles.map((tile) => `frost-tile-${tile.id}`),
      ]);
    },
  );

  it("aucune hauteur fixe dans le givre : ni sur les tuiles, ni dans leurs cales", async () => {
    const { frost } = await renderLoading();

    const classes = [frost, ...frost.querySelectorAll("*")].flatMap((element) =>
      Array.from(element.classList),
    );
    expect(
      classes.filter(
        (name) => /(^|:)(min-|max-)?h-/.test(name) && name !== "min-h-11",
      ),
    ).toEqual([]);
  });

  it.each([
    ["Privé", PRIVATE_SIDE],
    ["Pro", PRO_SIDE],
  ])(
    "côté %s : chaque tuile de verre givrée a la hauteur de l'état vide compact de sa tuile (TileCompactEmpty, source partagée)",
    async (_, side) => {
      loadSideSpaces.mockResolvedValue(side);
      const dashboardTiles = buildDashboard(side).tiles;

      const {
        tiles: [, ...glass],
      } = await renderLoading();

      glass.forEach((tile, i) => {
        const strut = strutOf(tile);
        expect(hasClasses(strut, GLASS_TILE_BODY_CLASSES)).toBe(true);
        const shared = render(
          withIntl(<TileCompactEmpty tile={dashboardTiles[i]} />),
        ).container;
        expect(strut.innerHTML).toBe(shared.innerHTML);
      });
    },
  );

  it.each([
    ["un côté avec espaces", PRIVATE_SIDE, messages.dashboard.today.introClear],
    [
      "un côté sans espace",
      { side: "private", contexts: [], selected: [] },
      messages.dashboard.today.introNoSpace,
    ],
  ])(
    "%s : la tuile pleine givrée a la hauteur de son état vide compact (TodayHead, source partagée)",
    async (_, side, intro) => {
      loadSideSpaces.mockResolvedValue(side);

      const {
        tiles: [solid],
      } = await renderLoading();

      const strut = strutOf(solid);
      expect(hasClasses(strut, TODAY_TILE_BODY_CLASSES)).toBe(true);
      const shared = render(withIntl(<TodayHead intro={intro} strut />)).container;
      expect(strut.innerHTML).toBe(shared.innerHTML);
    },
  );

  it("sans relevé : chaque tuile givrée réserve sa place (tile-reserve) sans variable de hauteur, la cale donne l'état compact", async () => {
    const { tiles } = await renderLoading();

    for (const tile of tiles) {
      expect(tile.classList.contains("tile-reserve")).toBe(true);
      expect(heightVars(tile)).toEqual({});
    }
  });

  it("relevé dans le cookie : chaque tuile givrée reçoit les hauteurs de son côté, une variable par palier", async () => {
    requestCookies.set(
      TILES_COOKIE,
      "private.sm:today-31240_privateTodo-48000_home-15050~private.lg:today-28000~pro.sm:today-99900_proTodo-50000",
    );

    const { tiles } = await renderLoading();
    const byId = Object.fromEntries(
      tiles.map((tile) => [tile.dataset.testid, heightVars(tile)]),
    );

    expect(byId["frost-tile-today"]).toEqual({
      "--tile-h-sm": "312.4px",
      "--tile-h-lg": "280px",
    });
    expect(byId["frost-tile-privateTodo"]).toEqual({ "--tile-h-sm": "480px" });
    expect(byId["frost-tile-home"]).toEqual({ "--tile-h-sm": "150.5px" });
    expect(byId["frost-tile-health"]).toEqual({});
    // --frost-index garde sa place à côté des hauteurs.
    expect(tiles[1].style.getPropertyValue("--frost-index")).toBe("1");
  });

  it("côté Pro : lit le relevé Pro, jamais celui de l'autre côté", async () => {
    loadSideSpaces.mockResolvedValue(PRO_SIDE);
    requestCookies.set(
      TILES_COOKIE,
      "private.sm:today-31240~pro.md:today-40000_proTodo-50000",
    );

    const { tiles } = await renderLoading();

    expect(heightVars(tiles[0])).toEqual({ "--tile-h-md": "400px" });
    expect(heightVars(tiles[1])).toEqual({ "--tile-h-md": "500px" });
  });

  it("cookie hostile : rien du cookie n'entre dans un style, seules les entrées valides comptent", async () => {
    requestCookies.set(
      TILES_COOKIE,
      "private.sm:today-1px;background:url(https://x.test/a)_home-calc(100vh)_health-var(--x)_budget--5_shopping-99999999~private.md:privateTodo-30000",
    );

    const { frost, tiles } = await renderLoading();

    const styles = [frost, ...frost.querySelectorAll("*")]
      .map((element) => element.getAttribute("style") ?? "")
      .join(" ");
    expect(styles).not.toMatch(/url|calc|var\(--x|background|-5|99999999/);
    const reserved = tiles.filter(
      (tile) => Object.keys(heightVars(tile)).length > 0,
    );
    expect(reserved.map((tile) => tile.dataset.testid)).toEqual([
      "frost-tile-privateTodo",
    ]);
  });

  it("cookie trop long : ignoré en entier", async () => {
    const valid = "private.sm:today-31240";
    requestCookies.set(TILES_COOKIE, `${valid}~${"x".repeat(1100)}`);

    const { tiles } = await renderLoading();

    for (const tile of tiles) expect(heightVars(tile)).toEqual({});
  });

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
