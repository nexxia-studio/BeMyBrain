import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";

// Démo du kanban (BRAIN-46, demo-plan.md, D3 à D5) : la page se charge sans avertissement ni erreur en console
// (hydratation comprise), une carte change de colonne à la souris (ordinateur) et au doigt, par dépôt sur un
// onglet (mobile, onglets sous 768 px), le doigt ne saisit une carte qu'après l'appui de 250 ms, et un glisser
// ne fait ni sauter ni reculer le tableau (colonnes au-delà de 768 px) ni la page (onglets). D5 : un tap court
// ou un clic ouvre le détail ; un appui long, un défilement ou un glisser ne l'ouvrent jamais.
// Serveur : `pnpm dev` seulement. La garde ferme la page sur tout build de production hors Vercel (`next
// start` répond 404, vérifié par `demo-kanban-fermee.spec.ts`).
// Gestes tactiles : vrais événements tactiles du navigateur par le protocole Chromium (`Input.dispatchTouchEvent`),
// seuls à déclencher aussi le défilement natif. Projet mobile en local = Chromium avec l'émulation iPhone.
// raccourci: fichier retiré avec la démo, à la dernière tâche du plan todo-kanban.
test.use({ locale: "fr-FR" });

const DEMO = fr.kanbanDemo;
const STATUS = fr.tasks.detail.status;

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

/** Relève tout avertissement ou erreur de la console, et toute erreur non attrapée de la page. */
function watchConsole(page: Page): string[] {
  const messages: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "warning" || message.type() === "error") {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => {
    messages.push(`pageerror: ${error.message}`);
  });
  return messages;
}

/** Ouvre la démo et attend l'hydratation : dnd-kit ne monte sa région d'annonces qu'une fois côté client. */
async function openDemo(page: Page): Promise<void> {
  const response = await page.goto("/demo/kanban");
  expect(response?.status()).toBe(200);
  await expect(
    page.getByRole("heading", { level: 1, name: DEMO.title }),
  ).toBeVisible();
  await expect(page.locator('[id^="DndLiveRegion-"]')).toBeAttached();
}

/**
 * Opacité calculée de la ligne « Ajouter une sous-tâche » (le `label` qui porte le champ). Au repos : 1, sinon
 * le texte d'invite et l'icône « + » tombent sous 4,5:1 (`:has(:read-only)` est vrai pour tout élément non
 * modifiable, pas seulement pour un champ en lecture seule).
 */
function addRowOpacity(field: Locator): Promise<string> {
  return field.evaluate((el) => getComputedStyle(el.closest("label")!).opacity);
}

/**
 * Contraste (WCAG) du texte d'invite du champ sur ce qui est réellement affiché derrière lui : fonds et opacités
 * de tous ses ancêtres composés, couleurs lues par un canevas (toute notation CSS, `oklch` comprise).
 */
function placeholderContrast(field: Locator): Promise<number> {
  return field.evaluate((input) => {
    type Rgba = [number, number, number, number];
    const context = document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true })!;
    const rgba = (color: string): Rgba => {
      context.clearRect(0, 0, 1, 1);
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data;
      return [r, g, b, a / 255];
    };
    const over = (top: Rgba, under: Rgba): Rgba => [
      top[0] * top[3] + under[0] * (1 - top[3]),
      top[1] * top[3] + under[1] * (1 - top[3]),
      top[2] * top[3] + under[2] * (1 - top[3]),
      1,
    ];
    const chain: Element[] = [];
    for (let el: Element | null = input; el !== null; el = el.parentElement) {
      chain.unshift(el);
    }
    // Chaque élément est un groupe : son fond puis son contenu, fondus dans ce qui est derrière à son opacité.
    const paint = (index: number, backdrop: Rgba, withText: boolean): Rgba => {
      const style = getComputedStyle(chain[index]);
      const surface = over(rgba(style.backgroundColor), backdrop);
      let content = surface;
      if (index < chain.length - 1) {
        content = paint(index + 1, surface, withText);
      } else if (withText) {
        const placeholder = getComputedStyle(input, "::placeholder").color;
        content = over(rgba(placeholder), surface);
      }
      return over(
        [content[0], content[1], content[2], Number(style.opacity)],
        backdrop,
      );
    };
    const luminance = (color: Rgba): number => {
      const [r, g, b] = color.slice(0, 3).map((channel) => {
        const value = channel / 255;
        return value <= 0.04045
          ? value / 12.92
          : ((value + 0.055) / 1.055) ** 2.4;
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const white: Rgba = [255, 255, 255, 1];
    const text = luminance(paint(0, white, true));
    const surface = luminance(paint(0, white, false));
    return (Math.max(text, surface) + 0.05) / (Math.min(text, surface) + 0.05);
  });
}

function column(page: Page, id: string): Locator {
  return page.locator(`[data-board-column="${id}"]`);
}

function card(scope: Page | Locator, id: string): Locator {
  return scope.locator(`[data-board-card="${id}"]`);
}

function overlay(page: Page): Locator {
  return page.locator("[data-board-overlay]");
}

async function chooseSetting(
  page: Page,
  group: string,
  option: string,
): Promise<void> {
  const settings = page.locator("details").filter({
    has: page.getByText(DEMO.settings.label, { exact: true }),
  });
  if (!(await settings.evaluate((el) => (el as HTMLDetailsElement).open))) {
    await settings.getByText(DEMO.settings.label, { exact: true }).click();
  }
  const button = page
    .getByRole("group", { name: group })
    .getByRole("button", { name: option, exact: true });
  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
}

async function center(locator: Locator): Promise<{ x: number; y: number }> {
  await locator.scrollIntoViewIfNeeded();
  const box = await locator.boundingBox();
  if (!box) throw new Error("élément sans boîte");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Doigt posé, déplacé et levé par de vrais événements tactiles (Chromium). */
class Finger {
  private constructor(private readonly cdp: CDPSession) {}

  static async on(page: Page): Promise<Finger> {
    return new Finger(await page.context().newCDPSession(page));
  }

  async down(point: { x: number; y: number }): Promise<void> {
    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [point],
    });
  }

  /** Glisse en petits pas, comme un doigt. */
  async move(
    from: { x: number; y: number },
    to: { x: number; y: number },
    steps = 12,
  ): Promise<void> {
    for (let step = 1; step <= steps; step++) {
      await this.cdp.send("Input.dispatchTouchEvent", {
        type: "touchMove",
        touchPoints: [
          {
            x: from.x + ((to.x - from.x) * step) / steps,
            y: from.y + ((to.y - from.y) * step) / steps,
          },
        ],
      });
    }
  }

  async up(): Promise<void> {
    await this.cdp.send("Input.dispatchTouchEvent", {
      type: "touchEnd",
      touchPoints: [],
    });
  }
}

test("la démo se charge sans avertissement ni erreur en console, hydratation comprise", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);

  await openDemo(page);
  // Plus aucune requête en vol (morceaux JS différés compris) : leurs messages éventuels sont relevés.
  await page.waitForLoadState("networkidle");

  expect(messages).toEqual([]);
});

test("@mobile sous 768 px, une colonne à la fois sous la barre d'onglets", async ({
  page,
}) => {
  await signIn(page);

  await openDemo(page);

  await expect(page.getByRole("tablist")).toBeVisible();
  await expect(page.locator("[data-board-column]:visible")).toHaveCount(1);
  await expect(page.getByRole("tabpanel")).toHaveAttribute(
    "data-board-column",
    "backlog",
  );
});

test("@desktop au-delà de 768 px, les colonnes côte à côte, sans onglets", async ({
  page,
}) => {
  await signIn(page);

  await openDemo(page);

  await expect(page.getByRole("tablist")).toBeHidden();
  await expect(page.locator("[data-board-column]:visible")).toHaveCount(5);
  await expect(page.getByRole("tabpanel")).toHaveCount(0);
});

test("@desktop une carte glissée à la souris de « À faire » vers « À planifier » y apparaît et y reste une fois enregistrée", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  await chooseSetting(page, DEMO.settings.latency, DEMO.settings.latencyThree);
  const status = page.getByRole("status").filter({ hasText: DEMO.saved });
  const from = await center(card(page, "unstarted-1"));
  const to = await center(card(column(page, "backlog"), "backlog-1"));

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();

  await expect(card(column(page, "backlog"), "unstarted-1")).toBeVisible();
  await expect(card(column(page, "unstarted"), "unstarted-1")).toHaveCount(0);
  // Latence simulée de 3 s (marge sous une machine chargée) : la carte est déjà déposée pendant
  // l'enregistrement, et y reste après.
  await expect(status).toHaveCount(0);
  await expect(status).toBeVisible({ timeout: 10_000 });
  await expect(overlay(page)).toHaveCount(0);
  await expect(card(column(page, "backlog"), "unstarted-1")).toBeVisible();
});

test("@mobile au doigt, la carte se saisit au bout de l'appui de 250 ms, pas avant", async ({
  page,
}) => {
  await signIn(page);
  await page.clock.install();
  await openDemo(page);
  const finger = await Finger.on(page);
  const from = await center(card(page, "backlog-1"));
  // Horloge arrêtée : seul `runFor` fait passer le temps de la page (minuterie du délai de dnd-kit).
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

  await finger.down(from);
  await page.clock.runFor(249);
  const overlayBefore = await overlay(page).count();
  await page.clock.runFor(1);

  expect(overlayBefore).toBe(0);
  await expect(overlay(page)).toBeVisible();
  await finger.up();
  await page.clock.resume();
  await expect(overlay(page)).toHaveCount(0);
});

test("@mobile en onglets, une carte saisie au doigt puis déposée sur l'onglet « À faire » change de colonne", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const todoTab = page.getByRole("tablist").getByRole("tab", {
    name: new RegExp(`^${STATUS.unstarted}`),
  });
  const todoCountBefore = Number(
    (await todoTab.innerText()).replace(/\D/g, ""),
  );
  const finger = await Finger.on(page);
  const from = await center(card(page, "backlog-1"));
  const to = await center(todoTab);

  await finger.down(from);
  // Doigt immobile : la carte se saisit d'elle-même au bout du délai d'appui.
  await expect(overlay(page)).toBeVisible();
  await finger.move(from, to);
  await finger.up();

  await expect(card(column(page, "backlog"), "backlog-1")).toHaveCount(0);
  await expect(todoTab).toContainText(String(todoCountBefore + 1));
  // dnd-kit avale tout clic dans les 50 ms qui suivent un glisser (pas de clic parasite au lâcher) : le
  // toucher sur l'onglet est rejoué jusqu'à ce qu'il le choisisse.
  await expect(async () => {
    await todoTab.click();
    await expect(todoTab).toHaveAttribute("aria-selected", "true", {
      timeout: 500,
    });
  }).toPass();
  await expect(
    column(page, "unstarted").locator("[data-board-card]").first(),
  ).toHaveAttribute("data-board-card", "backlog-1");
});

// D4 (demo-plan.md) : pendant un glisser de « En cours » vers « Terminée », en colonnes, le tableau ne revient
// jamais en arrière et la colonne d'origine reste visible, sans saut hors du défilement. Échantillons pris à
// chaque image (`requestAnimationFrame`) dans la page, du début du geste au lâcher.
type Sample = {
  scrollLeft: number;
  /** Bord gauche de la colonne dans le contenu du tableau (indépendant du défilement). */
  columnOffset: number | null;
  columnWidth: number;
  columnHeight: number;
  headingWidth: number;
  headingHeight: number;
};

async function startSampling(page: Page, columnId: string): Promise<void> {
  await page.evaluate((id) => {
    const store = window as unknown as {
      __samples: unknown[];
      __sampling: boolean;
    };
    store.__samples = [];
    store.__sampling = true;
    const frame = () => {
      const columnEl = document.querySelector(`[data-board-column="${id}"]`);
      const board = document.querySelector(
        "[data-board-column]",
      )!.parentElement!;
      const rect = columnEl?.getBoundingClientRect();
      const heading = columnEl?.querySelector("h2")?.getBoundingClientRect();
      store.__samples.push({
        scrollLeft: board.scrollLeft,
        columnOffset: rect
          ? rect.left - board.getBoundingClientRect().left + board.scrollLeft
          : null,
        columnWidth: rect?.width ?? 0,
        columnHeight: rect?.height ?? 0,
        headingWidth: heading?.width ?? 0,
        headingHeight: heading?.height ?? 0,
      });
      if (store.__sampling) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, columnId);
}

async function stopSampling(page: Page): Promise<Sample[]> {
  return page.evaluate(() => {
    const store = window as unknown as {
      __samples: Sample[];
      __sampling: boolean;
    };
    store.__sampling = false;
    return store.__samples;
  });
}

// Défilement automatique de dnd-kit : au plus 10 px toutes les 5 ms. Une image plus lente sous une machine
// chargée en cumule plusieurs ; au-delà d'une demi-colonne (160 px), c'est un saut, pas un défilement.
const MAX_SCROLL_STEP = 160;

/** Pas du défilement d'une image à la suivante qui reculent, ou qui sautent plus loin qu'un défilement. */
function scrollFaults(samples: Sample[]): { back: number[]; jumps: number[] } {
  const steps = samples
    .slice(1)
    .map((sample, index) => sample.scrollLeft - samples[index].scrollLeft);
  return {
    back: steps.filter((step) => step < -1),
    jumps: steps.filter((step) => step > MAX_SCROLL_STEP),
  };
}

function expectSteadyBoard(samples: Sample[]): void {
  expect(samples.length).toBeGreaterThan(20);
  expect(samples.at(-1)!.scrollLeft).toBeGreaterThan(samples[0].scrollLeft);
  const first = samples[0];
  const hidden = samples.filter(
    (sample) =>
      sample.columnOffset === null ||
      sample.columnWidth < 1 ||
      sample.columnHeight < 1 ||
      sample.headingWidth < 1 ||
      sample.headingHeight < 1,
  );
  const shifted = samples
    .map((sample) =>
      sample.columnOffset === null
        ? null
        : Math.round(sample.columnOffset - first.columnOffset!),
    )
    .filter((shift) => shift !== null && Math.abs(shift) > 1);
  expect({
    ...scrollFaults(samples),
    hidden: hidden.length,
    shifted,
  }).toEqual({ back: [], jumps: [], hidden: 0, shifted: [] });
}

function boardOf(page: Page): Locator {
  return page.locator("[data-board-column]").first().locator("..");
}

/** Point près du bord droit visible du tableau, à la hauteur des cartes : zone de défilement automatique. */
async function rightEdgeOfBoard(
  page: Page,
  y: number,
): Promise<{ x: number; y: number }> {
  const box = await boardOf(page).boundingBox();
  if (!box) throw new Error("tableau sans boîte");
  const viewport = page.viewportSize()!;
  return { x: Math.min(box.x + box.width, viewport.width) - 12, y };
}

/** Attend que la colonne soit entière dans la partie visible du tableau (le défilement automatique l'amène). */
async function waitUntilFullyShown(page: Page, id: string): Promise<void> {
  await expect
    .poll(() =>
      column(page, id).evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const board = el.parentElement!.getBoundingClientRect();
        return rect.left >= board.left - 1 && rect.right <= board.right + 1;
      }),
    )
    .toBe(true);
}

/** Point de dépôt dans « Terminée » : sa première carte. */
async function firstDoneCard(page: Page): Promise<{ x: number; y: number }> {
  const box = await column(page, "completed")
    .locator("[data-board-card]")
    .first()
    .boundingBox();
  if (!box) throw new Error("carte sans boîte");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test.describe("en colonnes, au doigt (tablette, 1024 px)", () => {
  test.use({
    viewport: { width: 1024, height: 768 },
    hasTouch: true,
    isMobile: true,
  });

  test("@desktop pendant un glisser au doigt de « En cours » vers « Terminée », le tableau défile sans recul ni saut et la colonne d'origine reste en place", async ({
    page,
  }) => {
    await signIn(page);
    await openDemo(page);
    const finger = await Finger.on(page);
    const from = await center(card(page, "started-1"));
    const edge = await rightEdgeOfBoard(page, from.y);
    await startSampling(page, "started");

    await finger.down(from);
    await expect(overlay(page)).toBeVisible();
    await finger.move(from, edge, 20);
    // Doigt tenu près du bord : le défilement automatique amène « Terminée ».
    await waitUntilFullyShown(page, "completed");
    const to = await firstDoneCard(page);
    await finger.move(edge, to, 10);
    const samples = await stopSampling(page);
    await finger.up();

    expectSteadyBoard(samples);
    await expect(card(column(page, "completed"), "started-1")).toBeVisible();
  });

  test("@desktop un glisser au doigt lancé sans attendre l'appui ne saisit pas la carte et fait défiler les colonnes", async ({
    page,
  }) => {
    await signIn(page);
    await page.clock.install();
    await openDemo(page);
    const board = boardOf(page);
    const scrollBefore = await board.evaluate((el) => el.scrollLeft);
    const finger = await Finger.on(page);
    const from = await center(card(page, "unstarted-1"));
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

    await finger.down(from);
    await finger.move(from, { x: from.x - 200, y: from.y }, 8);
    // Doigt immobile bien au-delà de l'appui de 250 ms : la saisie, annulée par le mouvement, ne vient pas.
    await page.clock.runFor(600);
    const overlayWhileHeld = await overlay(page).count();
    await finger.up();
    await page.clock.resume();

    expect(overlayWhileHeld).toBe(0);
    await expect
      .poll(() => board.evaluate((el) => el.scrollLeft))
      .toBeGreaterThan(scrollBefore);
    await expect(card(column(page, "unstarted"), "unstarted-1")).toBeVisible();
  });
});

test("@desktop pendant un glisser à la souris de « En cours » vers « Terminée », le tableau défile sans recul ni saut et la colonne d'origine reste en place", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const from = await center(card(page, "started-1"));
  const edge = await rightEdgeOfBoard(page, from.y);
  await startSampling(page, "started");

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(edge.x, edge.y, { steps: 20 });
  await waitUntilFullyShown(page, "completed");
  const to = await firstDoneCard(page);
  await page.mouse.move(to.x, to.y, { steps: 10 });
  const samples = await stopSampling(page);
  await page.mouse.up();

  expectSteadyBoard(samples);
  await expect(card(column(page, "completed"), "started-1")).toBeVisible();
});

type TabsSample = {
  scrollY: number;
  tabsScrollLeft: number;
  /** Rectangles dans la page (indépendants du défilement vertical). */
  tabs: { left: number; top: number; width: number; height: number };
  panel: { left: number; top: number; width: number; height: number } | null;
};

/** Échantillonne page, barre d'onglets et panneau d'une colonne, à chaque image. */
async function startTabsSampling(page: Page, columnId: string): Promise<void> {
  await page.evaluate((id) => {
    const store = window as unknown as {
      __samples: unknown[];
      __sampling: boolean;
    };
    store.__samples = [];
    store.__sampling = true;
    const box = (el: Element | null) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return {
        left: rect.left,
        top: rect.top + window.scrollY,
        width: rect.width,
        height: rect.height,
      };
    };
    const frame = () => {
      const tablist = document.querySelector('[role="tablist"]')!;
      store.__samples.push({
        scrollY: window.scrollY,
        tabsScrollLeft: tablist.scrollLeft,
        tabs: box(tablist),
        panel: box(document.querySelector(`[data-board-column="${id}"]`)),
      });
      if (store.__sampling) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }, columnId);
}

async function stopTabsSampling(page: Page): Promise<TabsSample[]> {
  return page.evaluate(() => {
    const store = window as unknown as {
      __samples: TabsSample[];
      __sampling: boolean;
    };
    store.__sampling = false;
    return store.__samples;
  });
}

test("@mobile en onglets, pendant un glisser au doigt vers l'onglet « Terminée », la page remonte sans recul ni saut, la barre d'onglets et le panneau restent en place", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const tablist = page.getByRole("tablist");
  const todoTab = tablist.getByRole("tab", {
    name: new RegExp(`^${STATUS.unstarted}`),
  });
  const doneTab = tablist.getByRole("tab", {
    name: new RegExp(`^${STATUS.completed}`),
  });
  await todoTab.click();
  const finger = await Finger.on(page);
  // Dernière carte de « À faire » : la page est défilée, la barre d'onglets hors de l'écran.
  const last = column(page, "unstarted").locator("[data-board-card]").last();
  const lastId = (await last.getAttribute("data-board-card"))!;
  const from = await center(last);
  await startTabsSampling(page, "unstarted");

  await finger.down(from);
  await expect(overlay(page)).toBeVisible();
  // Doigt tenu en haut de l'écran : le défilement automatique ramène la barre d'onglets.
  await finger.move(from, { x: from.x, y: 8 }, 20);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  // « Terminée » dépasse à droite de la barre : doigt au bord, la barre défile jusqu'à le montrer en entier.
  const edge = {
    x: page.viewportSize()!.width - 8,
    y: (await center(todoTab)).y,
  };
  await finger.move({ x: from.x, y: 8 }, edge, 10);
  await expect
    .poll(() =>
      doneTab.evaluate((tab) => {
        const rect = tab.getBoundingClientRect();
        return rect.right <= tab.parentElement!.getBoundingClientRect().right;
      }),
    )
    .toBe(true);
  const to = await doneTab.boundingBox();
  if (!to) throw new Error("onglet sans boîte");
  await finger.move(
    edge,
    { x: to.x + to.width / 2, y: to.y + to.height / 2 },
    5,
  );
  const samples = await stopTabsSampling(page);
  await finger.up();

  expect(samples.length).toBeGreaterThan(20);
  // Page qui remonte (pas négatifs), barre d'onglets qui avance vers la droite (pas positifs).
  const steps = samples
    .slice(1)
    .map((sample, index) => sample.scrollY - samples[index].scrollY);
  const tabSteps = samples
    .slice(1)
    .map(
      (sample, index) => sample.tabsScrollLeft - samples[index].tabsScrollLeft,
    );
  const first = samples[0];
  const moved = (a: TabsSample["tabs"] | null, b: TabsSample["tabs"] | null) =>
    a === null ||
    b === null ||
    Math.abs(a.left - b.left) > 1 ||
    Math.abs(a.top - b.top) > 1 ||
    Math.abs(a.width - b.width) > 1;
  expect({
    back: steps.filter((step) => step > 1),
    jumps: steps.filter((step) => step < -MAX_SCROLL_STEP),
    tabsBack: tabSteps.filter((step) => step < -1),
    tabsJumps: tabSteps.filter((step) => step > MAX_SCROLL_STEP),
    tabsMoved: samples.filter((sample) => moved(sample.tabs, first.tabs))
      .length,
    panelMoved: samples.filter((sample) => moved(sample.panel, first.panel))
      .length,
    panelHidden: samples.filter(
      (sample) => !sample.panel || sample.panel.height < 1,
    ).length,
  }).toEqual({
    back: [],
    jumps: [],
    tabsBack: [],
    tabsJumps: [],
    tabsMoved: 0,
    panelMoved: 0,
    panelHidden: 0,
  });
  await expect(doneTab).toHaveAttribute("aria-selected", "false");
  await expect(card(column(page, "completed"), lastId)).toBeAttached();
});

// D5 (demo-plan.md) : tap = détail, appui long = saisie.
function detailDialog(page: Page): Locator {
  return page.getByRole("dialog", { name: fr.tasks.detail.label });
}

/**
 * Laisse passer deux images : le `click` qu'émet le navigateur après un relâchement est traité avant. Sert à
 * vérifier qu'un détail ne s'ouvre pas (une absence ne s'attend pas).
 */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

test.describe("au doigt, à 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("@mobile un tap court ouvre le détail de la carte, qui se ferme par la croix", async ({
    page,
  }) => {
    await signIn(page);
    const messages = watchConsole(page);
    await openDemo(page);
    const finger = await Finger.on(page);
    const from = await center(card(page, "backlog-1"));

    await finger.down(from);
    await finger.up();

    const dialog = detailDialog(page);
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("heading", {
        name: "Repenser l'onboarding des abonnés",
      }),
    ).toBeVisible();
    await expect(overlay(page)).toHaveCount(0);
    await dialog.getByRole("button", { name: fr.tasks.detail.close }).click();
    await expect(dialog).toHaveCount(0);
    expect(messages).toEqual([]);
  });

  // D8 : champ « Ajouter une sous-tâche » toujours là, même sur une carte sans sous-tâche.
  test("@mobile une carte sans sous-tâche propose le champ d'ajout : 44 px, sans zoom iOS, focus gardé après Entrée", async ({
    page,
  }) => {
    await signIn(page);
    const messages = watchConsole(page);
    await openDemo(page);
    const finger = await Finger.on(page);
    await finger.down(await center(card(page, "backlog-1")));
    await finger.up();
    const dialog = detailDialog(page);
    const field = dialog.getByLabel(fr.tasks.detail.subtasks.add);
    await expect(dialog.getByRole("checkbox")).toHaveCount(0);
    expect(await addRowOpacity(field)).toBe("1");
    // Texte d'invite lisible : il tient lieu de libellé visible (DESIGN.md § 5, exception de la ligne d'ajout).
    await expect
      .poll(() => placeholderContrast(field))
      .toBeGreaterThanOrEqual(4.5);

    await field.fill("Lister les écrans");
    await field.press("Enter");

    await expect(dialog.getByRole("listitem")).toHaveText([
      "Lister les écrans",
    ]);
    await expect(field).toHaveValue("");
    await expect(field).toBeFocused();
    const size = await field.evaluate((el) => ({
      font: parseFloat(getComputedStyle(el).fontSize),
      row: el.closest("label")!.getBoundingClientRect().height,
    }));
    expect(size.font).toBeGreaterThanOrEqual(16);
    expect(size.row).toBeGreaterThanOrEqual(44);
    expect(messages).toEqual([]);
  });

  test("@mobile un appui de 250 ms saisit la carte sans ouvrir le détail", async ({
    page,
  }) => {
    await signIn(page);
    const messages = watchConsole(page);
    await page.clock.install();
    await openDemo(page);
    const finger = await Finger.on(page);
    const from = await center(card(page, "backlog-1"));
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

    await finger.down(from);
    await page.clock.runFor(250);
    await expect(overlay(page)).toBeVisible();
    await finger.up();
    await page.clock.resume();

    await expect(overlay(page)).toHaveCount(0);
    await twoFrames(page);
    await expect(detailDialog(page)).toHaveCount(0);
    expect(messages).toEqual([]);
  });

  test("@mobile un défilement vertical au doigt avant 250 ms ne saisit pas la carte et n'ouvre pas le détail", async ({
    page,
  }) => {
    await signIn(page);
    const messages = watchConsole(page);
    await page.clock.install();
    await openDemo(page);
    // « À faire » : une quinzaine de cartes, la page défile.
    await page
      .getByRole("tablist")
      .getByRole("tab", { name: new RegExp(`^${STATUS.unstarted}`) })
      .click();
    const finger = await Finger.on(page);
    const from = await center(card(page, "unstarted-4"));
    const scrollBefore = await page.evaluate(() => window.scrollY);
    await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);

    await finger.down(from);
    await finger.move(from, { x: from.x, y: from.y - 250 }, 8);
    // Doigt tenu bien au-delà de l'appui de 250 ms : la saisie, annulée par le défilement, ne vient pas.
    await page.clock.runFor(600);
    const overlayWhileHeld = await overlay(page).count();
    await finger.up();
    await page.clock.resume();

    expect(overlayWhileHeld).toBe(0);
    await expect
      .poll(() => page.evaluate(() => window.scrollY))
      .toBeGreaterThan(scrollBefore);
    await twoFrames(page);
    await expect(detailDialog(page)).toHaveCount(0);
    expect(messages).toEqual([]);
  });
});

test("@desktop un clic à la souris ouvre le détail de la carte", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);

  await card(page, "started-1").click();

  const dialog = detailDialog(page);
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "Refonte de la page tarifs" }),
  ).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
  expect(messages).toEqual([]);
});

test("@desktop Entrée ajoute une sous-tâche puis la suivante sans quitter le champ, compteur à jour", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);
  await card(page, "started-1").click();
  const dialog = detailDialog(page);
  const field = dialog.getByLabel(fr.tasks.detail.subtasks.add);
  await expect(dialog.getByText("1/2", { exact: true })).toBeVisible();
  expect(await addRowOpacity(field)).toBe("1");
  // Texte d'invite lisible : il tient lieu de libellé visible (DESIGN.md § 5, exception de la ligne d'ajout).
  await expect
    .poll(() => placeholderContrast(field))
    .toBeGreaterThanOrEqual(4.5);

  await field.click();
  await page.keyboard.type("Relire les prix");
  await page.keyboard.press("Enter");
  await expect(field).toHaveValue("");
  await page.keyboard.type("Publier");
  await page.keyboard.press("Enter");

  await expect(dialog.getByRole("listitem")).toHaveText([
    "Grille des formules",
    "Textes FR et EN",
    "Relire les prix",
    "Publier",
  ]);
  await expect(dialog.getByText("1/4", { exact: true })).toBeVisible();
  await expect(field).toBeFocused();
  expect(messages).toEqual([]);
});

test("@desktop un glisser à la souris n'ouvre pas le détail", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);
  const from = await center(card(page, "unstarted-1"));
  const to = await center(card(column(page, "backlog"), "backlog-1"));

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();

  await expect(card(column(page, "backlog"), "unstarted-1")).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
  await twoFrames(page);
  await expect(detailDialog(page)).toHaveCount(0);
  expect(messages).toEqual([]);
});

// D6 : sur ordinateur (pointeur fin et survol), main ouverte et relief au survol, main fermée sur la copie saisie ;
// au doigt, ni curseur ni relief.
test("@desktop au survol d'une carte, main ouverte et relief ; pendant le glisser, main fermée, copie inclinée", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);
  const target = card(page, "unstarted-1");
  const shadowAtRest = await target.evaluate(
    (el) => getComputedStyle(el).boxShadow,
  );

  await target.hover();

  await expect
    .poll(() => target.evaluate((el) => getComputedStyle(el).cursor))
    .toBe("grab");
  expect(
    await target.evaluate((el) => getComputedStyle(el).boxShadow),
  ).not.toBe(shadowAtRest);

  const from = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await expect
    .poll(() => overlay(page).evaluate((el) => getComputedStyle(el).cursor))
    .toBe("grabbing");
  await expect
    .poll(() => overlay(page).evaluate((el) => el.style.transform))
    .toContain("rotate(2deg)");
  await expect(target.getByTestId("board-footprint")).toBeVisible();
  await expect(page.getByTestId("board-footprint")).toHaveCount(1);
  // L'empreinte garde son nom au lecteur d'écran (contenu transparent, pas retiré de l'arbre d'accessibilité).
  await expect(
    page.getByRole("button", { name: /Rappeler le plombier/ }),
  ).toHaveCount(1);
  await page.mouse.up();

  await expect(overlay(page)).toHaveCount(0);
  await expect(page.getByTestId("board-footprint")).toHaveCount(0);
  expect(messages).toEqual([]);
});

test("@mobile au doigt, une carte n'a ni curseur main ni relief", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const target = card(page, "backlog-1");

  const style = await target.evaluate((el) => ({
    cursor: getComputedStyle(el).cursor,
    shadow: getComputedStyle(el).boxShadow,
  }));

  expect(style.cursor).not.toBe("grab");
  expect(style.shadow).toBe("none");
});
