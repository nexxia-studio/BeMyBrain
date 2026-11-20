import {
  expect,
  type Locator,
  type Page,
  type Route,
  test,
} from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";

// Spec effets-de-verre, scénarios 1 à 6 : givre de chargement sans décalage (tableau de bord, liste, corbeille),
// givre au repos sous mouvement réduit, reflet une fois par session. Tourne dans les deux projets (barre latérale
// sur ordinateur, barre d'onglets sur mobile), sauf le scénario 6 (sans variante mobile, tag @desktop).
//
// Chargement ralenti sans la démo (fermée sous `next start`) : la requête RSC de la navigation côté client est
// retenue 2 s par `page.route`. Les préchargements (en-tête `next-router-prefetch`) passent tout de suite : Next
// a déjà en cache le `loading.tsx` de la route et l'affiche au clic, pendant que la vraie page attend.
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

/** Tuiles du givre (enfants directs du conteneur), puis leur voile. */
const frostTiles = (page: Page, frostId: string) =>
  page.getByTestId(frostId).locator(":scope > div");
const frostVeils = (page: Page, frostId: string) =>
  page.getByTestId(frostId).locator(":scope > div > div");

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
      // Lu d'un coup dès l'affichage : une animation en cours donnerait une opacité entre 1 et 0,45.
      const states = await veils.evaluateAll((elements) =>
        elements.map((element) => ({
          opacity: getComputedStyle(element).opacity,
          animations: element.getAnimations().length,
        })),
      );

      expect(states.length).toBeGreaterThan(0);
      for (const state of states) {
        expect(state).toEqual({ opacity: "0.45", animations: 0 });
      }
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
