import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";

// Démo du kanban (BRAIN-46, demo-plan.md, D3) : la page se charge sans avertissement ni erreur en console
// (hydratation comprise), une carte change de colonne à la souris (ordinateur) et au doigt, par dépôt sur un
// onglet (mobile), et le doigt ne saisit une carte qu'après le délai d'appui.
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
  // Rendu client terminé : la hauteur de la page ne bouge plus, plus rien ne doit s'écrire en console.
  await page.waitForLoadState("networkidle");

  expect(messages).toEqual([]);
});

test("@desktop une carte glissée à la souris de « À faire » vers « À planifier » y apparaît et y reste", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  const moved = card(page, "unstarted-1");
  const target = card(column(page, "backlog"), "backlog-1");

  const from = await center(moved);
  const to = await center(target);
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();

  await expect(card(column(page, "backlog"), "unstarted-1")).toBeVisible();
  await expect(card(column(page, "unstarted"), "unstarted-1")).toHaveCount(0);
  await expect(
    page.getByRole("status").filter({ hasText: DEMO.saved }),
  ).toBeVisible();
  await expect(overlay(page)).toHaveCount(0);
  await expect(card(column(page, "backlog"), "unstarted-1")).toBeVisible();
});

test("@mobile en onglets, une carte gardée appuyée au-delà du délai puis déposée sur « À faire » change de colonne", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  await chooseSetting(page, DEMO.settings.layout, DEMO.settings.layoutTabs);
  await chooseSetting(page, DEMO.settings.delay, DEMO.settings.delayLong);
  const tabs = page.getByRole("tablist");
  const todoTab = tabs.getByRole("tab", {
    name: new RegExp(`^${STATUS.unstarted}`),
  });
  const todoCountBefore = Number(
    (await todoTab.innerText()).replace(/\D/g, ""),
  );
  const finger = await Finger.on(page);
  const from = await center(card(page, "backlog-1"));
  const to = await center(todoTab);

  const pressedAt = Date.now();
  await finger.down(from);
  // La carte se saisit seule une fois le délai passé, sans bouger : on attend la saisie, pas une durée.
  await expect(overlay(page)).toBeVisible();
  const heldMs = Date.now() - pressedAt;
  await finger.move(from, to);
  await finger.up();

  expect(heldMs).toBeGreaterThanOrEqual(400);
  await expect(card(page, "backlog-1")).toHaveCount(0);
  await expect(todoTab).toContainText(String(todoCountBefore + 1));
  // dnd-kit avale tout clic dans les 50 ms qui suivent un glisser (pas de clic parasite au lâcher) : le
  // toucher sur l'onglet est rejoué jusqu'à ce qu'il le choisisse.
  await expect(async () => {
    await todoTab.click();
    await expect(todoTab).toHaveAttribute("aria-selected", "true", {
      timeout: 500,
    });
  }).toPass();
  await expect(card(column(page, "unstarted"), "backlog-1")).toBeVisible();
  await expect(
    column(page, "unstarted").locator("[data-board-card]").first(),
  ).toHaveAttribute("data-board-card", "backlog-1");
});

test("@mobile un glisser lancé sans attendre le délai ne saisit pas la carte et fait défiler les colonnes", async ({
  page,
}) => {
  await signIn(page);
  await openDemo(page);
  await chooseSetting(page, DEMO.settings.delay, DEMO.settings.delayLong);
  const board = page.locator("[data-board-column]").first().locator("..");
  const scrollBefore = await board.evaluate((el) => el.scrollLeft);
  const finger = await Finger.on(page);
  const from = await center(card(page, "unstarted-1"));

  await finger.down(from);
  await finger.move(from, { x: from.x - 200, y: from.y }, 8);
  // Doigt immobile au-delà du délai d'appui (400 ms) : la saisie, annulée par le mouvement, ne vient jamais.
  await page.waitForTimeout(600);
  const overlayWhileHeld = await overlay(page).count();
  await finger.up();

  expect(overlayWhileHeld).toBe(0);
  await expect
    .poll(() => board.evaluate((el) => el.scrollLeft))
    .toBeGreaterThan(scrollBefore);
  await expect(card(column(page, "unstarted"), "unstarted-1")).toBeVisible();
  await expect(
    page.getByRole("status").filter({ hasText: DEMO.saved }),
  ).toBeVisible();
});
