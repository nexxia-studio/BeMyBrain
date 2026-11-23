import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  filterContext,
  quickAddTask,
  switchSide,
  t,
  trashTasks,
  uniqueTitle,
  userDay,
} from "./todo";

// Spec effets-de-verre, scénarios 1 à 7 : givre de chargement sans décalage (tableau de bord, liste, corbeille),
// givre au repos sous mouvement réduit, reflet une fois par session, démo retirée. Tourne dans les deux projets
// (barre latérale sur ordinateur, barre d'onglets sur mobile), sauf les scénarios 6 et 7 (sans variante mobile,
// tag @desktop).
//
// Chargement ralenti : `page.route` retient 2 s la requête RSC de la navigation côté client. Les préchargements
// (en-tête `next-router-prefetch`) passent tout de suite : Next a déjà en cache le `loading.tsx` de la route et
// l'affiche au clic, pendant que la vraie page attend.
test.use({ locale: "fr-FR" });
// Connexion, deux navigations ralenties et fenêtres d'observation du reflet : au-delà des 30 s par défaut.
test.setTimeout(60_000);

const RSC_DELAY_MS = 2_000;
const SIGNATURE_KEY_PREFIX = "bmb_signature_";
const REVEAL_MARKER = "bmb_signature_bento_reveal";
/**
 * Fenêtre d'observation d'un reflet qui ne doit pas jouer : entrée et révélation (≈ 1,2 s), départ 0,1 s après,
 * 2,2 s de balayage plus le décalage entre tuiles. Au-delà, un reflet lancé aurait forcément bougé.
 */
const SHEEN_WINDOW_MS = 5_000;
/** Écart toléré entre les positions du givre et du contenu (arrondis de sous-pixel). */
const POSITION_TOLERANCE_PX = 1;

type Box = { x: number; y: number; width: number };

/** Retient 2 s la requête RSC de navigation vers `pathname` ; laisse passer les préchargements. */
async function slowNavigation(page: Page, pathname: string) {
  await page.route(
    (url) => url.pathname === pathname,
    async (route: Route) => {
      const headers = route.request().headers();
      const isRsc = headers.rsc === "1";
      const isPrefetch = "next-router-prefetch" in headers;
      if (isRsc && !isPrefetch) {
        await new Promise((resolve) => setTimeout(resolve, RSC_DELAY_MS));
      }
      await route.continue();
    },
  );
}

/** Lien de la navigation principale visible (barre latérale sur ordinateur, onglets sur mobile). */
function navLink(page: Page, name: string): Locator {
  return page
    .getByRole("navigation", { name: fr.shell.navigation })
    .getByRole("link", { name, exact: true });
}

async function box(locator: Locator): Promise<Box> {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width };
  });
  return bounds;
}

function expectSameBox(actual: Box, expected: Box, what: string) {
  for (const key of ["x", "y", "width"] as const) {
    expect(
      Math.abs(actual[key] - expected[key]),
      `${what} : ${key} ${expected[key]} → ${actual[key]}`,
    ).toBeLessThanOrEqual(POSITION_TOLERANCE_PX);
  }
}

/** Relève les décalages de mise en page (Chromium) dès le chargement du document. */
async function watchLayoutShifts(page: Page) {
  await page.addInitScript(() => {
    const shifts: { value: number; startTime: number }[] = [];
    (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
    if (!PerformanceObserver.supportedEntryTypes?.includes("layout-shift")) {
      return;
    }
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        shifts.push({
          value: (entry as unknown as { value: number }).value,
          startTime: entry.startTime,
        });
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
}

/** Somme des décalages survenus après `since` (horloge `performance.now()` de la page), toutes causes comprises. */
async function layoutShiftSince(page: Page, since: number): Promise<number> {
  // Deux images : les dernières entrées sont livrées à l'observateur.
  return page.evaluate(async (from) => {
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
    const shifts = (
      window as unknown as { __shifts: { value: number; startTime: number }[] }
    ).__shifts;
    return shifts
      .filter((shift) => shift.startTime >= from)
      .reduce((sum, shift) => sum + shift.value, 0);
  }, since);
}

type FrostCase = {
  name: string;
  /** Page de départ, puis lien à cliquer vers la page ralentie. */
  from: string;
  path: string;
  click: (page: Page) => Locator;
  title: string;
  frostId: string;
  /** Première tuile du contenu réel. */
  tile: (page: Page) => Locator;
};

/** Contenu réel : l'élément qui suit l'en-tête de la page (tuile de la liste ou de la corbeille). */
const tileAfterHeader = (page: Page) =>
  page.getByRole("main").locator(":scope > header + *");

const FROST_CASES: FrostCase[] = [
  {
    name: "tableau de bord",
    from: "/tasks",
    path: "/dashboard",
    click: (page) => navLink(page, fr.shell.home),
    title: fr.dashboard.title,
    frostId: "dashboard-frost",
    tile: (page) => page.getByTestId("tile-today"),
  },
  {
    name: "liste des tâches",
    from: "/dashboard",
    path: "/tasks",
    click: (page) => navLink(page, fr.shell.tasks),
    title: fr.tasks.list.title,
    frostId: "tasks-frost",
    tile: tileAfterHeader,
  },
  {
    name: "corbeille",
    from: "/tasks",
    path: "/trash",
    click: (page) =>
      page.getByRole("main").getByRole("link", { name: fr.tasks.list.trash }),
    title: fr.trash.title,
    frostId: "trash-frost",
    tile: tileAfterHeader,
  },
];

/** Tuiles du givre (enfants directs du conteneur), puis leur voile (pas la cale de hauteur, inerte). */
const frostTiles = (page: Page, frostId: string) =>
  page.getByTestId(frostId).locator(":scope > div");
const frostVeils = (page: Page, frostId: string) =>
  page.getByTestId(frostId).locator(":scope > div > div:not([inert])");

test.describe("givre de chargement", () => {
  for (const c of FROST_CASES) {
    test(`${c.name} : le givre tient la place du contenu, sans décalage`, async ({
      page,
      browserName,
    }) => {
      await watchLayoutShifts(page);
      await signIn(page);
      await page.goto(c.from);
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      // Préchargement de la route (loading.tsx compris) terminé avant le clic.
      await page.waitForLoadState("networkidle");
      await slowNavigation(page, c.path);
      // `.first()` : sur /tasks, `tasks/loading.tsx` s'affiche aussi dans l'emplacement `@detail` (Next 16 pose le
      // chargement d'un dossier autour de chaque emplacement de son layout, docs/gotchas.md) : deux en-têtes et
      // deux givres pendant l'attente. On mesure la copie de la liste (`children`, rendue la première).
      // raccourci: doublon toléré ici — retirer les `.first()` quand le ticket `loading.tsx`/`error.tsx` de
      // `@detail` sera fait.
      const heading = page
        .getByRole("heading", { level: 1, name: c.title })
        .first();

      const clickedAt = await page.evaluate(() => performance.now());
      await c.click(page).click();

      const frost = page.getByTestId(c.frostId);
      await expect(frost.first()).toBeVisible();
      await expect(page.getByRole("main").first()).toHaveAttribute(
        "aria-busy",
        "true",
      );
      await expect(heading).toBeVisible();
      const titleDuringFrost = await box(heading);
      const tileDuringFrost = await box(frostTiles(page, c.frostId).first());

      await expect(frost).toHaveCount(0, { timeout: 15_000 });
      await expect(c.tile(page)).toBeVisible();
      await expect(page).toHaveURL(new RegExp(`${c.path}$`));
      const titleAfter = await box(heading);
      const tileAfter = await box(c.tile(page));
      const cls = await layoutShiftSince(page, clickedAt);

      test.info().annotations.push({
        type: "mesures",
        description: JSON.stringify({
          titleDuringFrost,
          titleAfter,
          tileDuringFrost,
          tileAfter,
          cls,
        }),
      });
      expectSameBox(titleAfter, titleDuringFrost, "titre");
      expectSameBox(tileAfter, tileDuringFrost, "première tuile");
      // layout-shift n'existe que dans Chromium (projet mobile en WebKit contre une preview HTTPS).
      if (browserName === "chromium") {
        expect(cls).toBeLessThan(0.01);
      } else {
        test.info().annotations.push({
          type: "CLS non mesuré",
          description: `${browserName} n'expose pas layout-shift`,
        });
      }
    });
  }

  test.describe("mouvement réduit", () => {
    test.use({ reducedMotion: "reduce" });

    test("le voile s'affiche directement à son niveau de repos @desktop", async ({
      page,
    }) => {
      await signIn(page);
      await page.goto("/tasks");
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
      await page.waitForLoadState("networkidle");
      await slowNavigation(page, "/dashboard");

      await navLink(page, fr.shell.home).click();
      const veils = frostVeils(page, "dashboard-frost");
      await expect(veils.first()).toBeAttached();
      // Lu d'un coup dès l'affichage : une animation en cours donnerait une opacité entre 1 et le repos (0,55, cran discret).
      const states = await veils.evaluateAll((elements) =>
        elements.map((element) => ({
          opacity: getComputedStyle(element).opacity,
          animations: element.getAnimations().length,
        })),
      );

      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(state).toEqual({ opacity: "0.55", animations: 0 });
      }
    });
  });
});

// Givre du tableau de bord, tuiles à la hauteur du contenu (QA-5), données changées entre deux affichages : du givre
// au contenu, l'ordre des tuiles, leur position horizontale et leur largeur ne changent pas, ni la position de la
// première rangée. Hauteur : non vérifiée ici. Les données changent d'un affichage à l'autre (limite acceptée (1)
// de la spec) et, depuis QA-6, les tuiles d'une rangée s'étirent à la plus haute : une tuile sans données suit la
// hauteur de sa rangée. Données inchangées → hauteurs au pixel : « hauteurs mémorisées » plus bas.
// Données réalistes créées par l'ajout rapide (titres longs, échéances, heures), mises à la corbeille à la fin :
// To-do à 0, 2 puis 5 tâches, côté Privé (paire de tuiles chiffre) et côté Pro.
// Précondition : le compte e2e n'a aucune tâche ouverte dans l'espace Trustup (To-do à 0).

/** Écart refusé : un pixel. En dessous, arrondis de sous-pixel (aucun n'a été observé). */
const GEOMETRY_TOLERANCE_PX = 0.5;

type TileBox = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

/** Boîtes des tuiles du givre (enfants directs du conteneur), dans l'ordre de la grille ; id sans préfixe. */
async function frostBoxes(page: Page): Promise<TileBox[]> {
  return frostTiles(page, "dashboard-frost").evaluateAll((tiles) =>
    tiles.map((tile) => {
      const rect = tile.getBoundingClientRect();
      return {
        id: ((tile as HTMLElement).dataset.testid ?? "").replace(
          "frost-tile-",
          "tile-",
        ),
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
}

/** Boîtes des vraies tuiles : enfants directs de la grille qui porte la tuile « Aujourd'hui ». */
async function contentBoxes(page: Page): Promise<TileBox[]> {
  return page.getByTestId("tile-today").evaluate((today) =>
    Array.from(today.parentElement?.children ?? [])
      .filter(
        (tile): tile is HTMLElement =>
          (tile as HTMLElement).dataset.testid?.startsWith("tile-") ?? false,
      )
      .map((tile) => {
        const rect = tile.getBoundingClientRect();
        return {
          id: tile.dataset.testid ?? "",
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        };
      }),
  );
}

/** Lignes de la tuile To-do du côté (0 quand la tuile montre son état vide). */
function sideTodoRows(page: Page, tileId: "privateTodo" | "proTodo"): Locator {
  return page
    .getByTestId(`tile-${tileId}`)
    .getByRole("list", { name: fr.dashboard.tiles.upcoming })
    .getByRole("listitem");
}

/** Depuis la liste, ouvre le tableau de bord avec un chargement ralenti ; boîtes du givre puis du contenu. */
async function frostThenContent(
  page: Page,
  check: () => Promise<void>,
): Promise<{ frost: TileBox[]; content: TileBox[] }> {
  await page.goto("/tasks");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await slowNavigation(page, "/dashboard");

  await navLink(page, fr.shell.home).click();
  await expect(page.getByTestId("dashboard-frost")).toBeVisible();
  const frost = await frostBoxes(page);
  await expect(page.getByTestId("dashboard-frost")).toHaveCount(0, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("tile-today")).toBeVisible();
  await check();
  const content = await contentBoxes(page);
  await page.unrouteAll({ behavior: "wait" });
  return { frost, content };
}

/**
 * Ordre, x et largeur au pixel pour toutes les tuiles ; y pour la première rangée (celle d'« Aujourd'hui »).
 * `check` vérifie le contenu attendu.
 */
async function expectFrostLayout(
  page: Page,
  what: string,
  check: () => Promise<void>,
) {
  const { frost, content } = await frostThenContent(page, check);

  test.info().annotations.push({
    type: `géométrie : ${what}`,
    description: JSON.stringify({ frost, content }),
  });
  expect(
    content.map((tile) => tile.id),
    `${what} : ordre des tuiles`,
  ).toEqual(frost.map((tile) => tile.id));
  const firstRowY = frost[0].y;
  content.forEach((tile, i) => {
    const keys: (keyof Omit<TileBox, "id">)[] = ["x", "width"];
    if (Math.abs(frost[i].y - firstRowY) < GEOMETRY_TOLERANCE_PX) {
      keys.push("y");
    }
    for (const key of keys) {
      expect(
        Math.abs(tile[key] - frost[i][key]),
        `${what}, ${tile.id} : ${key} ${frost[i][key]} (givre) → ${tile[key]} (contenu)`,
      ).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    }
  });
}

test.describe("givre du tableau de bord, tuiles à la hauteur du contenu", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await trashTasks(page, created.splice(0));
  });

  test("ordre, position horizontale et largeur de chaque tuile inchangés du givre au contenu, données changées", async ({
    page,
  }) => {
    // Neuf tâches créées par l'ajout rapide et quatre chargements ralentis.
    test.setTimeout(180_000);
    const longTitle = (base: string) =>
      uniqueTitle(
        `${base}, avec un intitulé assez long pour dépasser la largeur d'une tuile au téléphone`,
      );
    await signIn(page);
    await switchSide(page, "pro");
    await filterContext(page, "Trustup");
    await expect(page.getByTestId("tile-proTodo")).toBeVisible();

    // To-do à 0 (espace Trustup vide) : l'état vide compact de la tuile.
    await expectFrostLayout(page, "To-do à 0", async () => {
      await expect(sideTodoRows(page, "proTodo")).toHaveCount(0);
    });

    // To-do à 2 (espace Nexxia) et tuile « Aujourd'hui » peu remplie : aucun état de remplissage.
    await filterContext(page, "Nexxia");
    created.push(
      await quickAddTask(page, longTitle("Relancer le devis"), {
        date: userDay(-1),
        time: "09:30",
      }),
    );
    created.push(
      await quickAddTask(page, longTitle("Envoyer la proposition"), {
        date: userDay(0),
        time: "14:00",
      }),
    );
    await expectFrostLayout(page, "To-do à 2", async () => {
      await expect(sideTodoRows(page, "proTodo")).toHaveCount(2);
    });

    // To-do à 5 sur les deux espaces (pastilles d'espace sur la tuile et les lignes), « Aujourd'hui » pleine.
    created.push(
      await quickAddTask(page, longTitle("Préparer le comité"), {
        date: userDay(0),
      }),
    );
    for (const day of [1, 2, 3]) {
      created.push(
        await quickAddTask(page, longTitle(`Facturer le jalon ${day}`), {
          date: userDay(day),
          time: "11:00",
        }),
      );
    }
    await filterContext(page, t("shell.contexts.all", { count: 2 }));
    await expectFrostLayout(page, "To-do à 5", async () => {
      await expect(sideTodoRows(page, "proTodo")).toHaveCount(5);
      await expect(
        page
          .getByTestId("tile-today")
          .getByRole("list", { name: fr.dashboard.today.list })
          .getByRole("listitem"),
      ).toHaveCount(3);
    });

    // Côté Privé : paire de tuiles chiffre, To-do à 2.
    await page.goto("/dashboard");
    await switchSide(page, "private");
    for (const name of [
      "Prendre rendez-vous chez le dentiste",
      "Réserver le train",
    ]) {
      created.push(
        await quickAddTask(page, longTitle(name), { date: userDay(4) }),
      );
    }
    await expectFrostLayout(page, "côté Privé", async () => {
      await expect(page.getByTestId("tile-shopping")).toBeVisible();
      await expect(sideTodoRows(page, "privateTodo")).not.toHaveCount(0);
    });
  });
});

// Hauteurs mémorisées (QA-6) : au premier affichage, le navigateur relève la hauteur affichée de chaque tuile
// (étirement de la rangée compris) dans le cookie `bmb-dashboard-tiles` ; au chargement suivant, données
// inchangées, le givre la réserve : boîte de chaque tuile (x, y, largeur, hauteur) identique au pixel, du givre au
// contenu. Sans cookie : état compact (aucune hauteur réservée, chaque tuile givrée à la hauteur de sa cale, ou de
// la plus haute de sa rangée). Côté Privé : la paire de tuiles chiffre partage une rangée au téléphone ; sur
// ordinateur, « Aujourd'hui » et la To-do partagent la première. Aucune donnée créée ni supprimée.

const TILE_HEIGHTS_COOKIE = "bmb-dashboard-tiles";

/** Givre : variables de hauteur posées sur chaque tuile et hauteur de son état compact (cale invisible et bords). */
async function frostReservations(page: Page) {
  return frostTiles(page, "dashboard-frost").evaluateAll((tiles) =>
    tiles.map((tile) => {
      const strut = tile.querySelector(":scope > [inert]");
      const style = (tile as HTMLElement).style;
      return {
        vars: ["sm", "md", "lg"]
          .map((tier) => style.getPropertyValue(`--tile-h-${tier}`))
          .filter((value) => value !== ""),
        // Hauteur de l'état compact : la cale, plus les bords de la tuile.
        strutHeight:
          (strut?.getBoundingClientRect().height ?? 0) +
          parseFloat(getComputedStyle(tile).borderTopWidth) +
          parseFloat(getComputedStyle(tile).borderBottomWidth),
      };
    }),
  );
}

/** Rangées de la grille : indices des tuiles qui partagent le même y. */
function rowsOf(boxes: TileBox[]): number[][] {
  const rows: number[][] = [];
  boxes.forEach((box, i) => {
    const row = rows.find(
      (r) => Math.abs(boxes[r[0]].y - box.y) < GEOMETRY_TOLERANCE_PX,
    );
    if (row) row.push(i);
    else rows.push([i]);
  });
  return rows;
}

/** Hauteur de chaque vraie tuile sans l'étirement de sa rangée (alignement remis au début le temps d'une mesure). */
async function naturalHeights(page: Page): Promise<Record<string, number>> {
  return page.getByTestId("tile-today").evaluate((today) => {
    const tiles = Array.from(today.parentElement?.children ?? []).filter(
      (tile): tile is HTMLElement =>
        tile instanceof HTMLElement && "tile" in tile.dataset,
    );
    for (const tile of tiles)
      tile.style.setProperty("align-self", "flex-start");
    const heights = Object.fromEntries(
      tiles.map((tile) => [
        `tile-${tile.dataset.tile}`,
        tile.getBoundingClientRect().height,
      ]),
    );
    for (const tile of tiles) tile.style.removeProperty("align-self");
    return heights;
  });
}

/** Valeur du cookie des hauteurs (null s'il n'existe pas). */
async function tileHeightsCookie(page: Page): Promise<string | null> {
  const cookies = await page.context().cookies();
  return cookies.find((c) => c.name === TILE_HEIGHTS_COOKIE)?.value ?? null;
}

test.describe("givre du tableau de bord : hauteurs mémorisées", () => {
  test("sans cookie, état compact ; données inchangées, boîte de chaque tuile identique au pixel du givre au contenu, étirement compris", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await signIn(page);
    await page.goto("/dashboard");
    await switchSide(page, "private");
    // Bascule enregistrée avant de quitter la page (aria-busy levé, côté Privé rendu par le serveur).
    await expect(page.getByTestId("tile-shopping")).toBeVisible();
    await page.waitForLoadState("networkidle");

    // Sans cookie : aucune hauteur réservée, chaque tuile givrée a la hauteur de sa cale ou de la plus haute de sa
    // rangée (état compact). La liste est rechargée après l'effacement : son préchargement du givre (qui lit le
    // cookie) se refait sans relevé. Le premier affichage qui suit écrit le relevé.
    await page.goto("/tasks");
    await page.context().clearCookies({ name: TILE_HEIGHTS_COOKIE });
    await page.reload();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    expect(await tileHeightsCookie(page)).toBeNull();
    await page.waitForLoadState("networkidle");
    await slowNavigation(page, "/dashboard");
    await navLink(page, fr.shell.home).click();
    await expect(page.getByTestId("dashboard-frost")).toBeVisible();
    const compactBoxes = await frostBoxes(page);
    const compact = await frostReservations(page);
    await expect(page.getByTestId("dashboard-frost")).toHaveCount(0, {
      timeout: 15_000,
    });
    await page.unrouteAll({ behavior: "wait" });
    for (const reservation of compact) expect(reservation.vars).toEqual([]);
    for (const row of rowsOf(compactBoxes)) {
      const tallest = Math.max(...row.map((i) => compact[i].strutHeight));
      for (const i of row) {
        expect(
          Math.abs(compactBoxes[i].height - tallest),
          `sans cookie, ${compactBoxes[i].id} : hauteur ${compactBoxes[i].height}, cale la plus haute de la rangée ${tallest}`,
        ).toBeLessThan(GEOMETRY_TOLERANCE_PX);
      }
    }

    // Premier affichage : le relevé est écrit (côté Privé, palier courant).
    await expect
      .poll(() => tileHeightsCookie(page))
      .toMatch(/^private\.(sm|md|lg):today-\d+/);

    // Rechargement ralenti, données inchangées : le givre réserve la hauteur relevée.
    const { frost, content } = await frostThenContent(page, async () => {
      await expect(page.getByTestId("tile-shopping")).toBeVisible();
    });
    const cookie = await tileHeightsCookie(page);
    const natural = await naturalHeights(page);

    test.info().annotations.push({
      type: "géométrie : hauteurs mémorisées",
      description: JSON.stringify({ cookie, frost, content, natural }),
    });
    expect(content.map((tile) => tile.id)).toEqual(
      frost.map((tile) => tile.id),
    );
    content.forEach((tile, i) => {
      for (const key of ["x", "y", "width", "height"] as const) {
        expect(
          Math.abs(tile[key] - frost[i][key]),
          `${tile.id} : ${key} ${frost[i][key]} (givre) → ${tile[key]} (contenu)`,
        ).toBeLessThan(GEOMETRY_TOLERANCE_PX);
      }
    });
    // Largeurs inchangées depuis l'état compact (l'ordre aussi).
    expect(frost.map((tile) => tile.id)).toEqual(
      compactBoxes.map((tile) => tile.id),
    );
    frost.forEach((tile, i) => {
      expect(Math.abs(tile.width - compactBoxes[i].width)).toBeLessThan(
        GEOMETRY_TOLERANCE_PX,
      );
    });
    // Étirement compris dans le relevé. Ordinateur : une rangée réunit plusieurs tuiles dont l'une est étirée
    // (« Aujourd'hui » et la To-do), au pixel ci-dessus. Téléphone : seule la paire de tuiles chiffre partage une
    // rangée ; ses deux phrases ont la même hauteur, rien n'y est étiré : on vérifie qu'elle partage sa rangée.
    const rows = rowsOf(content);
    if ((page.viewportSize()?.width ?? 0) >= 1024) {
      const stretched = rows.filter(
        (row) =>
          row.length > 1 &&
          row.some((i) => content[i].height - natural[content[i].id] >= 1),
      );
      expect(
        stretched.length,
        "aucune rangée de plusieurs tuiles avec une tuile étirée",
      ).toBeGreaterThan(0);
    } else {
      const pair = rows.find((row) => row.length > 1);
      expect(pair?.map((i) => content[i].id)).toEqual([
        "tile-shopping",
        "tile-budget",
      ]);
    }
  });
});

// Liste et corbeille : haut de page immobile (QA-3). Le givre est générique (un en-tête de section, six lignes à la
// hauteur d'une ligne dont le titre tient sur une ligne) ; l'en-tête de page, le filtre d'espace, l'interrupteur
// « Terminées », le premier en-tête de section et la première ligne gardent leur boîte (x, y, largeur, hauteur)
// au pixel près. Le bas de la liste peut s'ajuster (titres sur deux lignes) : il n'est pas vérifié.
// Données réalistes créées par l'ajout rapide, côté Pro (deux espaces : le filtre d'espace est dans l'en-tête sous
// 1024 px ; le compte e2e y porte parfois d'autres tâches, on ne suppose pas une liste vide) : plusieurs
// sections, titres longs. Première ligne : une tâche au titre court en retard de dix ans (première de « En
// retard »), d'abord rangée dans un espace (pastille visible), puis une autre hors espace (sans pastille) : la
// légende a la même hauteur dans les deux cas. Corbeille : les tâches y sont mises, celle rangée dans un espace en
// dernier (première ligne, la plus récente).

type Probe = {
  what: string;
  during: (page: Page) => Locator;
  after: (page: Page) => Locator;
};

type FullBox = { x: number; y: number; width: number; height: number };

async function fullBox(locator: Locator): Promise<FullBox> {
  return locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
  });
}

/** Contenu de la page (premier `<main>` : pendant l'attente, `@detail` en porte une copie, docs/gotchas.md). */
const mainOf = (page: Page) => page.getByRole("main").first();

const headerProbe: Probe = {
  what: "en-tête de page",
  during: (page) => mainOf(page).locator(":scope > header"),
  after: (page) => mainOf(page).locator(":scope > header"),
};

const firstSection = (page: Page) => mainOf(page).getByRole("region").first();

const TASKS_PROBES: Probe[] = [
  headerProbe,
  {
    what: "filtre d'espace",
    during: (page) => mainOf(page).getByTestId("page-header-filter"),
    after: (page) => mainOf(page).getByTestId("page-header-filter"),
  },
  {
    what: "interrupteur « Terminées »",
    during: (page) => mainOf(page).getByRole("switch", { includeHidden: true }),
    after: (page) => mainOf(page).getByRole("switch"),
  },
  {
    what: "premier en-tête de section",
    during: (page) =>
      mainOf(page).getByTestId("tasks-frost-section-header").first(),
    after: (page) =>
      firstSection(page).getByRole("heading", { level: 2 }).locator(".."),
  },
  {
    what: "première ligne",
    during: (page) => mainOf(page).getByTestId("tasks-frost-row").first(),
    after: (page) => firstSection(page).getByRole("listitem").first(),
  },
];

const TRASH_PROBES: Probe[] = [
  headerProbe,
  {
    what: "première ligne",
    during: (page) => mainOf(page).getByTestId("trash-frost-row").first(),
    after: (page) => mainOf(page).getByRole("listitem").first(),
  },
];

/**
 * Depuis `from`, ouvre `path` avec un chargement ralenti ; relève la boîte de chaque repère pendant le givre puis
 * une fois le contenu arrivé, et les compare au pixel. `check` vérifie le contenu attendu.
 */
async function expectTopStill(
  page: Page,
  c: {
    what: string;
    from: string;
    path: string;
    click: (page: Page) => Locator;
    frostId: string;
    probes: Probe[];
    check: () => Promise<void>;
  },
) {
  await page.goto(c.from);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");
  await slowNavigation(page, c.path);

  await c.click(page).click();
  await expect(page.getByTestId(c.frostId).first()).toBeVisible();
  const during = await Promise.all(
    c.probes.map((p) => fullBox(p.during(page))),
  );
  await expect(page.getByTestId(c.frostId)).toHaveCount(0, { timeout: 15_000 });
  await expect(page).toHaveURL(new RegExp(`${c.path}$`));
  await c.check();
  const after = await Promise.all(c.probes.map((p) => fullBox(p.after(page))));
  await page.unrouteAll({ behavior: "wait" });

  test.info().annotations.push({
    type: `haut de page : ${c.what}`,
    description: JSON.stringify(
      c.probes.map((p, i) => ({
        what: p.what,
        during: during[i],
        after: after[i],
      })),
    ),
  });
  c.probes.forEach((probe, i) => {
    for (const key of ["x", "y", "width", "height"] as const) {
      expect(
        Math.abs(after[i][key] - during[i][key]),
        `${c.what}, ${probe.what} : ${key} ${during[i][key]} (givre) → ${after[i][key]} (contenu)`,
      ).toBeLessThan(GEOMETRY_TOLERANCE_PX);
    }
  });
}

test.describe("liste et corbeille : haut de page immobile", () => {
  const created: string[] = [];

  test.afterEach(async ({ page }) => {
    await trashTasks(page, created.splice(0));
  });

  test("en-tête, filtre, interrupteur, premier en-tête de section et première ligne (avec et sans pastille d'espace) gardent leur boîte au pixel près", async ({
    page,
  }) => {
    // Sept tâches créées puis mises à la corbeille, trois chargements ralentis.
    test.setTimeout(240_000);
    const longTitle = (base: string) =>
      uniqueTitle(
        `${base}, avec un intitulé assez long pour passer sur deux lignes dans la liste, au téléphone comme sur ordinateur`,
      );
    const allSpaces = t("shell.contexts.all", { count: 2 });
    await signIn(page);
    await page.goto("/tasks");
    await switchSide(page, "pro");
    // Première ligne rangée dans un espace : créée sous le filtre Nexxia, affichée avec sa pastille sous « Les deux ».
    await filterContext(page, "Nexxia");
    const withChip = uniqueTitle("TVA");
    const withChipId = await quickAddTask(page, withChip, {
      date: userDay(-3650),
    });
    created.push(withChipId);
    await filterContext(page, allSpaces);
    const longs = [
      await quickAddTask(page, longTitle("Relancer le devis de la toiture"), {
        date: userDay(-2),
      }),
      await quickAddTask(page, longTitle("Préparer la réunion de chantier"), {
        date: userDay(0),
        time: "18:30",
      }),
      await quickAddTask(page, longTitle("Envoyer la facture du jalon 2"), {
        date: userDay(1),
      }),
      await quickAddTask(page, longTitle("Mettre à jour le planning"), {
        date: userDay(6),
      }),
      await quickAddTask(page, longTitle("Classer les notes de frais")),
    ];
    created.push(...longs);
    const firstRow = () => firstSection(page).getByRole("listitem").first();

    await expectTopStill(page, {
      what: "liste, première ligne avec pastille d'espace",
      from: "/dashboard",
      path: "/tasks",
      click: (p) => navLink(p, fr.shell.tasks),
      frostId: "tasks-frost",
      probes: TASKS_PROBES,
      check: async () => {
        await expect(
          firstSection(page).getByRole("heading", { level: 2 }),
        ).toHaveText(fr.tasks.list.sections.overdue);
        await expect(firstRow()).toContainText(withChip);
        await expect(
          firstRow().getByText("Nexxia", { exact: true }),
        ).toBeVisible();
        await expect(mainOf(page).getByRole("region")).not.toHaveCount(1);
      },
    });

    // Première ligne sans pastille : une tâche hors espace, plus en retard encore.
    const withoutChip = uniqueTitle("Loyer");
    const withoutChipId = await quickAddTask(page, withoutChip, {
      date: userDay(-3651),
    });
    created.push(withoutChipId);
    await expectTopStill(page, {
      what: "liste, première ligne sans pastille",
      from: "/dashboard",
      path: "/tasks",
      click: (p) => navLink(p, fr.shell.tasks),
      frostId: "tasks-frost",
      probes: TASKS_PROBES,
      check: async () => {
        await expect(firstRow()).toContainText(withoutChip);
        await expect(firstRow()).not.toContainText("Nexxia");
      },
    });

    // Corbeille : les longues d'abord, la tâche rangée dans un espace en dernier (la plus récente, première ligne,
    // pastilles de côté et d'espace).
    await trashTasks(page, [...longs, withoutChipId]);
    await trashTasks(page, [withChipId]);
    await expectTopStill(page, {
      what: "corbeille",
      from: "/tasks",
      path: "/trash",
      click: (p) => mainOf(p).getByRole("link", { name: fr.tasks.list.trash }),
      frostId: "trash-frost",
      probes: TRASH_PROBES,
      check: async () => {
        await expect(mainOf(page).getByRole("listitem").first()).toContainText(
          withChip,
        );
        await expect(mainOf(page).getByRole("listitem")).not.toHaveCount(1);
      },
    });
  });
});

// Reflet (scénarios 1 à 3) : un échantillonneur, posé avant chaque document, relève à chaque image le style en
// ligne `transform` de chaque calque `[data-sheen]` (seul GSAP en pose un).
async function watchSheens(page: Page) {
  await page.addInitScript(() => {
    type SheenWindow = Window & { __sheenMoves: string[][] };
    const owner = window as unknown as SheenWindow;
    owner.__sheenMoves = [];
    const sample = () => {
      document
        .querySelectorAll<HTMLElement>("[data-sheen]")
        .forEach((sheen, index) => {
          const transform = sheen.style.transform;
          if (transform === "") return;
          const moves = (owner.__sheenMoves[index] ??= []);
          if (moves.at(-1) !== transform) moves.push(transform);
        });
      requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

const sheenMoves = (page: Page) =>
  page.evaluate(
    () => (window as unknown as { __sheenMoves: string[][] }).__sheenMoves,
  );
const resetSheenMoves = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __sheenMoves: string[][] }).__sheenMoves = [];
  });

/** État des calques : style en ligne, affichage et décalage horizontal calculé rapporté à la largeur. */
const sheenStates = (page: Page) =>
  page.locator("[data-sheen]").evaluateAll((sheens) =>
    sheens.map((sheen) => {
      const style = getComputedStyle(sheen);
      const matrix = new DOMMatrixReadOnly(
        style.transform === "none" ? undefined : style.transform,
      );
      const width = (sheen as HTMLElement).offsetWidth;
      return {
        inline: (sheen as HTMLElement).style.transform,
        display: style.display,
        offset: width > 0 ? Math.round((matrix.m41 / width) * 100) : null,
      };
    }),
  );

const revealMarker = (page: Page) =>
  page.evaluate((key) => sessionStorage.getItem(key), REVEAL_MARKER);

/** Session neuve : efface les marqueurs des moments, puis recharge le tableau de bord. */
async function freshSession(page: Page) {
  // La connexion arrive sur le tableau de bord, qui joue (ou tranche) le moment après `signIn` : attendre son
  // marqueur, sinon il serait reposé après l'effacement et le rechargement ne jouerait rien.
  await expect.poll(() => revealMarker(page)).not.toBeNull();
  await page.evaluate((prefix) => {
    for (const key of Object.keys(sessionStorage)) {
      if (key.startsWith(prefix)) sessionStorage.removeItem(key);
    }
  }, SIGNATURE_KEY_PREFIX);
  await page.reload();
  await expect(page.getByTestId("tile-today")).toBeVisible();
}

/** Observe la page `ms` millisecondes, image par image (absence de mouvement, pas une attente d'interface). */
const observeFor = (page: Page, ms: number) =>
  page.evaluate(
    (duration) =>
      new Promise<void>((resolve) => {
        const end = performance.now() + duration;
        const tick = () =>
          performance.now() >= end ? resolve() : requestAnimationFrame(tick);
        requestAnimationFrame(tick);
      }),
    ms,
  );

test.describe("reflet à l'ouverture du tableau de bord", () => {
  test("session neuve : le reflet balaie les tuiles de verre puis revient hors champ, sans rejeu à l'aller-retour", async ({
    page,
  }) => {
    await watchSheens(page);
    await signIn(page);

    await freshSession(page);

    await expect(page.locator("[data-sheen]").first()).toBeAttached();
    // Un calque au moins a reçu plusieurs positions successives : il s'est déplacé.
    await expect
      .poll(
        async () =>
          Math.max(0, ...(await sheenMoves(page)).map((m) => m.length)),
        {
          timeout: 10_000,
        },
      )
      .toBeGreaterThan(2);
    // Fin du balayage : plus aucun style en ligne, la classe remet chaque calque à −110 %.
    await expect
      .poll(
        async () => (await sheenStates(page)).every((s) => s.inline === ""),
        {
          timeout: 10_000,
        },
      )
      .toBe(true);
    for (const state of await sheenStates(page)) {
      expect(state.offset).toBe(-110);
    }

    await resetSheenMoves(page);
    await navLink(page, fr.shell.tasks).click();
    await expect(
      page.getByRole("heading", { level: 1, name: fr.tasks.list.title }),
    ).toBeVisible();
    await navLink(page, fr.shell.home).click();
    await expect(page.getByTestId("tile-today")).toBeVisible();
    await observeFor(page, SHEEN_WINDOW_MS);

    expect(await sheenMoves(page)).toEqual([]);
    expect(await page.locator("[data-sheen]").count()).toBeGreaterThan(0);
  });

  test.describe("mouvement réduit", () => {
    test.use({ reducedMotion: "reduce" });

    test("aucun calque visible ni animé", async ({ page }) => {
      await watchSheens(page);
      await signIn(page);
      await freshSession(page);
      await resetSheenMoves(page);
      // Le moment s'est chargé et a tranché (marqueur posé même sous mouvement réduit).
      await expect.poll(() => revealMarker(page)).not.toBeNull();

      await observeFor(page, SHEEN_WINDOW_MS);

      const states = await sheenStates(page);
      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(state.display).toBe("none");
        expect(state.inline).toBe("");
      }
      expect(await sheenMoves(page)).toEqual([]);
    });
  });
});

// Scénario 7 : la démo de l'essai iPhone est retirée (tâche 9) ; connecté, son adresse et ses routes lentes
// n'existent plus.
test.describe("démo fermée", () => {
  for (const path of [
    "/demo/effets-de-verre",
    "/demo/effets-de-verre/lent/tableau-de-bord",
    "/demo/effets-de-verre/lent/taches",
  ]) {
    test(`${path} répond 404 @desktop`, async ({ page }) => {
      await signIn(page);

      const response = await page.goto(path);

      expect(response?.status()).toBe(404);
    });
  }
});
