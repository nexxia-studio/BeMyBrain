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
// ou un clic ouvre le détail ; un appui long, un défilement ou un glisser ne l'ouvrent jamais. D9 : le sélecteur
// « Détail » (Nouveau / Actuel) est dans la fenêtre du détail.
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
  // Doigt au bord, la barre défile encore : la boîte de l'onglet ne se lit qu'une fois la barre immobile (même
  // `scrollLeft` sur deux images de suite, ou en butée), sinon le doigt vise une place périmée (« Annulée »).
  await expect
    .poll(() =>
      tablist.evaluate(
        (bar) =>
          new Promise<boolean>((resolve) => {
            const before = bar.scrollLeft;
            requestAnimationFrame(() =>
              requestAnimationFrame(() =>
                resolve(
                  bar.scrollLeft === before ||
                    bar.scrollLeft + bar.clientWidth >= bar.scrollWidth - 1,
                ),
              ),
            );
          }),
      ),
    )
    .toBe(true);
  const approach = await center(doneTab);
  await finger.move(edge, approach, 4);
  // Boîte relue juste avant le dernier déplacement du doigt.
  await finger.move(approach, await center(doneTab), 1);
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

/**
 * Sélecteur « Détail » (D9, correctif de relecture) : dans la fenêtre du détail, il bascule sur place entre le
 * nouvel ordre (notes en bas) et l'ordre d'avant (notes sous le titre), sans fermer le détail ni bouger le tableau.
 */
async function compareDetailLayouts(
  page: Page,
  boardCard: Locator,
): Promise<void> {
  const dialog = detailDialog(page);
  const group = dialog.getByRole("group", { name: DEMO.settings.detail });
  const choice = (name: string) =>
    group.getByRole("button", { name, exact: true });
  const notes = dialog.getByLabel(fr.tasks.detail.notes, { exact: true });
  const status = dialog.getByRole("button", {
    name: new RegExp(`^${fr.tasks.detail.status.label} :`),
  });
  const top = async (locator: Locator) => (await locator.boundingBox())!.y;
  const boardBefore = await boardCard.boundingBox();
  await expect(choice(DEMO.settings.detailNew)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  for (const name of [DEMO.settings.detailNew, DEMO.settings.detailCurrent]) {
    const box = (await choice(name).boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.width).toBeGreaterThanOrEqual(44);
  }
  expect(await top(notes)).toBeGreaterThan(await top(status));

  await choice(DEMO.settings.detailCurrent).click();

  await expect(choice(DEMO.settings.detailCurrent)).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(dialog).toBeVisible();
  await expect(choice(DEMO.settings.detailCurrent)).toBeFocused();
  expect(await top(notes)).toBeLessThan(await top(status));

  await choice(DEMO.settings.detailNew).click();

  await expect(dialog).toBeVisible();
  expect(await top(notes)).toBeGreaterThan(await top(status));
  expect(await boardCard.boundingBox()).toEqual(boardBefore);
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

  test("@mobile le sélecteur « Détail » bascule Nouveau / Actuel dans le tiroir, sans le fermer ni bouger le tableau", async ({
    page,
  }) => {
    await signIn(page);
    const messages = watchConsole(page);
    await openDemo(page);
    const finger = await Finger.on(page);
    await finger.down(await center(card(page, "backlog-1")));
    await finger.up();
    await expect(detailDialog(page)).toBeVisible();

    await compareDetailLayouts(page, card(page, "backlog-1"));

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

test("@desktop le sélecteur « Détail » bascule Nouveau / Actuel dans le panneau, sans le fermer ni bouger le tableau", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);
  await card(page, "started-1").click();
  await expect(detailDialog(page)).toBeVisible();

  await compareDetailLayouts(page, card(page, "started-1"));

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

/** Partie d'une carte qui monte au survol et porte contour et ombre (enfant du nœud mesuré par le glisser). */
function lift(target: Locator): Locator {
  return target.locator("[data-board-lift]");
}

function surfaceStyle(target: Locator): Promise<{
  shadow: string;
  outlineStyle: string;
  outlineWidth: string;
  outlineColor: string;
}> {
  return lift(target).evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      shadow: style.boxShadow,
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
      outlineColor: style.outlineColor,
    };
  });
}

/** Décalage vertical (px) de la partie qui monte (propriété CSS `translate`, « none » au repos). */
function liftOffset(target: Locator): Promise<number> {
  return lift(target).evaluate((el) => {
    const [, y = "0"] = getComputedStyle(el).translate.split(" ");
    return Number.parseFloat(y) || 0;
  });
}

/** Aucune trace de survol sur une carte : ni montée, ni contour, ni ombre. */
async function expectAtRest(target: Locator): Promise<void> {
  await expect.poll(() => liftOffset(target)).toBe(0);
  const style = await surfaceStyle(target);
  expect(style.outlineStyle).toBe("none");
  expect(style.shadow).toBe("none");
}

type Rgb = [number, number, number];

/** Contraste WCAG de deux couleurs opaques. */
function contrast(a: Rgb, b: Rgb): number {
  const luminance = (color: Rgb): number => {
    const [r, g, b] = color.map((channel) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Pixels réellement affichés (capture d'écran), lus à des points de la page. La capture est décodée dans la page
 * (`createImageBitmap`, sans requête : la CSP ne s'en mêle pas). Écran à 1 pixel par px CSS (projet ordinateur).
 */
async function pixelsAt(
  page: Page,
  points: { x: number; y: number }[],
): Promise<Rgb[]> {
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ({ png, points }) => {
      const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
      const bitmap = await createImageBitmap(new Blob([bytes]));
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d")!;
      context.drawImage(bitmap, 0, 0);
      return points.map(({ x, y }) => {
        const [r, g, b] = context.getImageData(x, y, 1, 1).data;
        return [r, g, b] as [number, number, number];
      });
    },
    { png, points },
  );
}

/**
 * Fond de la page forcé derrière le tableau, le temps d'une mesure : brume seule, ou cœur du halo bleu partout
 * (90 % sur la brume, le cas le plus défavorable de DESIGN.md § 2). `style` en ligne par le DOM : la CSP à nonce
 * refuse une feuille injectée.
 */
async function setBackdrop(page: Page, halo: boolean): Promise<void> {
  await page.evaluate(
    (layers) => {
      document.documentElement.style.setProperty("--halo-layers", layers);
    },
    halo
      ? "linear-gradient(color-mix(in srgb, var(--halo-blue) 90%, transparent), color-mix(in srgb, var(--halo-blue) 90%, transparent))"
      : "none",
  );
}

// D6, renforcé à la tâche 13 : sur ordinateur (pointeur fin et survol), main ouverte, contour, ombre et carte qui
// monte de 2 px au survol, main fermée sur la copie saisie ; au doigt, rien de tout cela.
test("@desktop au survol d'une carte, main ouverte, contour et ombre plus marqués, carte montée de 2 px sans rien décaler ; pendant le glisser, main fermée, copie inclinée", async ({
  page,
}) => {
  await signIn(page);
  const messages = watchConsole(page);
  await openDemo(page);
  const target = card(page, "unstarted-1");
  const neighbour = card(page, "unstarted-2");
  const atRest = await surfaceStyle(target);
  const boxAtRest = await target.boundingBox();
  const neighbourAtRest = await neighbour.boundingBox();
  expect(atRest.shadow).toBe("none");
  expect(atRest.outlineStyle).toBe("none");

  await target.hover();

  await expect
    .poll(() => target.evaluate((el) => getComputedStyle(el).cursor))
    .toBe("grab");
  const hovered = await surfaceStyle(target);
  expect(hovered.shadow).not.toBe(atRest.shadow);
  // `shadow-glass` : 36 px de flou sur ordinateur, contre 8 px pour l'ombre de la carte au repos.
  expect(hovered.shadow).toContain("36px");
  expect(hovered.outlineStyle).toBe("solid");
  expect(hovered.outlineWidth).toBe("1px");
  // `input` : encre secondaire.
  expect(hovered.outlineColor).toBe("rgb(83, 90, 114)");
  await expect.poll(() => liftOffset(target)).toBe(-2);
  // Le nœud mesuré par le glisser et la carte voisine ne bougent pas.
  expect(await target.boundingBox()).toEqual(boxAtRest);
  expect(await neighbour.boundingBox()).toEqual(neighbourAtRest);

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

// Correctif de relecture de la tâche 13 : le survol est tenu par `:hover`, il suit le pointeur réel. Tenu par une
// bibliothèque d'animation, il se terminait avant le `mouseup` du glisser et la carte pouvait rester montée.
test("@desktop une carte survolée, glissée à la souris puis déposée sur le bandeau « Annulée » ne laisse aucune carte montée, cernée ou ombrée", async ({
  page,
}) => {
  // Tableau défilé jusqu'au bout : « En cours » et le bandeau « Annulée » sont à l'écran ensemble.
  await page.setViewportSize({ width: 1920, height: 900 });
  await signIn(page);
  await openDemo(page);
  await column(page, "canceled").scrollIntoViewIfNeeded();
  const target = card(page, "started-1");
  await target.hover();
  await expect.poll(() => liftOffset(target)).toBe(-2);
  const from = await center(target);
  const band = await center(column(page, "canceled"));
  // Aucun défilement entre les deux lectures : le pointeur est toujours sur la carte.
  expect(await center(target)).toEqual(from);

  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(band.x, band.y, { steps: 15 });
  await page.mouse.up();

  await expect(overlay(page)).toHaveCount(0);
  await expect(card(page, "started-1")).toHaveCount(0);
  // Le pointeur est sur le bandeau : plus aucune carte n'est survolée, à commencer par celle qui a pris la place.
  for (const id of ["started-2", "started-3", "completed-1"]) {
    await expectAtRest(card(page, id));
  }
});

test("@desktop une carte survolée, saisie à la souris puis relâchée par Échap revient au repos une fois le pointeur parti", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const target = card(page, "unstarted-1");
  await target.hover();
  await expect.poll(() => liftOffset(target)).toBe(-2);
  const from = await center(target);
  const away = await center(
    page.getByRole("heading", { level: 1, name: DEMO.title }),
  );

  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 30, { steps: 3 });
  await expect(overlay(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.mouse.up();
  await page.mouse.move(away.x, away.y, { steps: 5 });

  await expect(overlay(page)).toHaveCount(0);
  await expect(page.getByTestId("board-footprint")).toHaveCount(0);
  await expectAtRest(target);
  await expectAtRest(card(page, "unstarted-2"));
});

/** Tous les pixels d'une boîte (capture d'écran), bords exclus de `inset` px. */
async function pixelsIn(
  page: Page,
  locator: Locator,
  inset = 0,
): Promise<Rgb[]> {
  const box = (await locator.boundingBox())!;
  const points: { x: number; y: number }[] = [];
  for (
    let y = Math.ceil(box.y) + inset;
    y < Math.floor(box.y + box.height) - inset;
    y++
  ) {
    for (
      let x = Math.ceil(box.x) + inset;
      x < Math.floor(box.x + box.width) - inset;
      x++
    ) {
      points.push({ x, y });
    }
  }
  return pixelsAt(page, points);
}

/** Contraste du trait le plus marqué d'une boîte (texte, icône) contre le fond donné. */
function strongest(pixels: Rgb[], background: Rgb): number {
  return Math.max(...pixels.map((pixel) => contrast(pixel, background)));
}

// Carte fermée : la légende passe au gris (`grayscale`) avec le titre atténué ; la lisibilité reste.
test("@desktop la légende d'une carte terminée est sans couleur et reste lisible : textes à 4,5:1 au moins, icône de priorité à 3:1 au moins", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  // `completed-3` : espace chaud, priorité urgente, échéance passée.
  const done = page.locator('[data-demo-card="completed-3"]');
  const legend = done.locator("[data-card-legend]");
  const chip = legend.getByText("Orme Conseil", { exact: true });
  const badge = legend
    .getByText(fr.tasks.list.priority["1"], { exact: true })
    .locator("..");
  const date = legend.locator("span").filter({ hasText: /^\d{1,2} \S+$/ });
  await done.scrollIntoViewIfNeeded();
  await expect(chip).toBeVisible();
  await expect(badge).toBeVisible();
  await expect(date).toBeVisible();
  const chipBox = (await chip.boundingBox())!;
  const badgeBox = (await badge.boundingBox())!;
  const dateBox = (await date.boundingBox())!;

  // Fonds lus hors du texte : marge gauche de la pastille, haut du badge, carte juste à gauche de la date.
  const [chipFill, badgeFill, cardFill] = await pixelsAt(page, [
    {
      x: Math.round(chipBox.x + 5),
      y: Math.round(chipBox.y + chipBox.height / 2),
    },
    {
      x: Math.round(badgeBox.x + badgeBox.width / 2),
      y: Math.round(badgeBox.y + 1),
    },
    {
      x: Math.round(dateBox.x - 3),
      y: Math.round(dateBox.y + dateBox.height / 2),
    },
  ]);
  const everything = [
    ...(await pixelsIn(page, chip)),
    ...(await pixelsIn(page, badge)),
    ...(await pixelsIn(page, date)),
  ];

  // Sans couleur : chaque pixel de la légende est un gris (canaux égaux, à l'arrondi près).
  expect(
    everything.filter(([r, g, b]) => Math.max(r, g, b) - Math.min(r, g, b) > 2),
  ).toEqual([]);
  expect(
    strongest(await pixelsIn(page, chip, 2), chipFill),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    strongest(await pixelsIn(page, date), cardFill),
  ).toBeGreaterThanOrEqual(4.5);
  expect(
    strongest(await pixelsIn(page, badge, 2), badgeFill),
  ).toBeGreaterThanOrEqual(3);
});

test("@desktop en mouvement réduit, une carte survolée prend contour et ombre sans monter", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await signIn(page);
  await openDemo(page);
  const target = card(page, "unstarted-1");

  await target.hover();

  await expect
    .poll(async () => (await surfaceStyle(target)).outlineStyle)
    .toBe("solid");
  // Le filet de mouvement réduit (`globals.css`) donne 0,01 ms à toute transition : valeur lue à la frame suivante.
  await expect
    .poll(async () => (await surfaceStyle(target)).shadow)
    .toContain("36px");
  await twoFrames(page);
  expect(await liftOffset(target)).toBe(0);
});

for (const backdrop of [
  { name: "sur la brume", halo: false },
  { name: "au cœur du halo bleu", halo: true },
]) {
  test(`@desktop ${backdrop.name}, l'empreinte d'une carte saisie à la souris se détache de la colonne : pointillé de 2 px à 3:1 au moins, fond plus clair`, async ({
    page,
  }) => {
    await signIn(page);
    await openDemo(page);
    await setBackdrop(page, backdrop.halo);
    const target = card(page, "unstarted-1");
    const footprint = target.getByTestId("board-footprint");
    const from = await center(target);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y, { steps: 2 });
    await expect(footprint).toBeVisible();
    // La copie saisie recouvre l'empreinte tant que le pointeur n'a pas bougé : masquée le temps de la mesure.
    await overlay(page).evaluate((el) =>
      el.style.setProperty("visibility", "hidden"),
    );
    const box = (await footprint.boundingBox())!;
    const left = Math.round(box.x);
    const top = Math.round(box.y);
    const middle = top + Math.round(box.height / 2);
    // Partie droite du bord haut, hors des coins arrondis (14 px) : deuxième rangée du pointillé.
    const edge = Array.from({ length: 80 }, (_, index) => ({
      x: left + 24 + index,
      y: top + 1,
    }));

    const [column, fill, ...row] = await pixelsAt(page, [
      // Dans la colonne, entre son en-tête et la première carte (aucune ombre de carte au-dessus).
      { x: left + Math.round(box.width / 2), y: top - 4 },
      { x: left + Math.round(box.width / 2), y: middle },
      ...edge,
    ]);
    const darkest = row.reduce((a, b) =>
      contrast(b, column) > contrast(a, column) ? b : a,
    );
    const outline = await footprint.evaluate((el) => {
      const style = getComputedStyle(el);
      return [style.outlineStyle, style.outlineWidth, style.outlineOffset];
    });
    await page.mouse.up();

    expect(outline).toEqual(["dashed", "2px", "-2px"]);
    expect(contrast(darkest, column)).toBeGreaterThanOrEqual(3);
    // Fond plus clair que la colonne (1,08:1 avant la tâche 13 ; 1,17:1 mesuré sur brume).
    expect(contrast(fill, column)).toBeGreaterThanOrEqual(1.1);
    expect(fill[0] + fill[1] + fill[2]).toBeGreaterThan(
      column[0] + column[1] + column[2],
    );
    // Le pointillé alterne : des pixels du bord sont au fond de l'empreinte, pas un trait plein.
    expect(row.some((pixel) => contrast(pixel, fill) < 1.05)).toBe(true);
  });
}

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
  expect((await surfaceStyle(target)).shadow).toBe("none");
  expect((await surfaceStyle(target)).outlineStyle).toBe("none");
});
