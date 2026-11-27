import {
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  addSubtask,
  boardCard,
  boardColumn,
  detailDialog,
  type BoardPreferences,
  openBoard,
  openQuickAdd,
  pickDueDate,
  quickAddTask,
  quickAddTitle,
  setBoardPreferences,
  setTaskPriority,
  submitQuickAdd,
  sweepTasks,
  trashTasks,
  uniqueTitle,
  userDay,
} from "./todo";

// Tableau de `/tasks` (spec todo-kanban, scénarios 1 à 5 et 7, tâche 21 du plan), sur de vraies tâches.
// Compte e2e partagé : chaque test crée ses tâches (titre unique, préfixe `KBe2e`), ne vise que ses cartes (par
// identifiant), n'utilise aucune échéance passée (rien « en retard » laissé derrière, BRAIN-52) et met tout à la
// corbeille à la fin, même en échec ; les restes d'un parcours interrompu sont balayés une fois au départ.
// Vue Tableau et options posées en cookies (`setBoardPreferences`), jamais par l'interface, sauf quand
// l'interface est le sujet du test.
// Après un dépôt, l'enregistrement est attendu (réponse de l'action `tasks.move`) avant tout rechargement : un
// `page.reload()` lancé trop tôt relirait le tableau d'avant.
// Gestes tactiles : vrais événements tactiles par le protocole Chromium (`Input.dispatchTouchEvent`), comme
// `demo-kanban.spec.ts` ; projet mobile en local = Chromium avec l'émulation iPhone.
// Reprend aussi, sur le tableau réel, l'intention des e2e de la démo (retirée à la tâche 27) : tableau immobile
// pendant un glisser (D4), tap contre appui long (D5), curseur, survol et empreinte (D6), onglet visé.
test.use({ locale: "fr-FR" });
// Chaque test crée ses tâches par l'interface et les met à la corbeille à la fin : jusqu'à 31 s mesurées pour le
// plus long (sous-tâches, options, rechargements), au-delà du délai par défaut de 30 s.
test.describe.configure({ timeout: 90_000 });

const PREFIX = "KBe2e";
const STATUS = fr.tasks.detail.status;
const BOARD = fr.tasks.board;

type Category = keyof typeof STATUS & string;

/** Identifiants créés par le test en cours, mis à la corbeille à la fin. */
let created: string[] = [];
/** Restes du préfixe balayés une fois par lancement. */
let swept = false;

test.beforeEach(async ({ context }) => {
  created = [];
  await context.clearCookies();
});

test.afterEach(async ({ page, context }) => {
  // Geste interrompu par un échec : bouton relâché, réseau rétabli, avant le ménage.
  await page.mouse.up().catch(() => {});
  await context.setOffline(false);
  if (created.length > 0) await trashTasks(page, created);
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

/** Connexion, balayage des restes (une fois), préférences du tableau, puis `/tasks` ; rend la console relevée. */
async function start(
  page: Page,
  preferences: BoardPreferences = {},
): Promise<string[]> {
  await signIn(page);
  if (!swept) {
    swept = true;
    await sweepTasks(page, PREFIX);
  }
  await setBoardPreferences(page, preferences);
  const messages = watchConsole(page);
  await openBoard(page);
  return messages;
}

/** Crée une tâche par l'ajout rapide (colonne « À faire ») et attend sa carte. */
async function make(page: Page, name: string): Promise<string> {
  const id = await quickAddTask(page, uniqueTitle(`${PREFIX} ${name}`));
  created.push(id);
  await expect(boardCard(page, id)).toBeAttached();
  return id;
}

function isWide(page: Page): boolean {
  return (page.viewportSize()?.width ?? 0) >= 768;
}

function overlay(page: Page): Locator {
  return page.locator("[data-board-overlay]");
}

function boardOf(page: Page): Locator {
  return page.locator("[data-board-column]").first().locator("..");
}

function tabOf(page: Page, category: Category): Locator {
  return page
    .getByRole("tablist")
    .getByRole("tab", { name: new RegExp(`^${STATUS[category]}`) });
}

function inColumn(page: Page, category: Category, id: string): Locator {
  return boardCard(boardColumn(page, category), id);
}

/** Ordre, de haut en bas, de quelques cartes d'une colonne (les autres cartes du compte sont ignorées). */
function orderOf(
  page: Page,
  category: Category,
  ids: readonly string[],
): Promise<string[]> {
  return boardColumn(page, category)
    .locator("[data-board-card]")
    .evaluateAll(
      (cards, wanted) =>
        cards
          .map((card) => card.getAttribute("data-board-card")!)
          .filter((id) => wanted.includes(id)),
      [...ids],
    );
}

/** Attend l'enregistrement du dépôt fait par `gesture` : réponse de l'action, puis tableau au repos. */
async function saved(page: Page, gesture: () => Promise<void>): Promise<void> {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      (candidate.request().postData() ?? "").includes('"tasks.move"'),
  );
  await gesture();
  await response;
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
}

/** Attend l'enregistrement de l'état du bandeau Annulée (préférence en cookie) avant tout rechargement. */
async function bandSaved(page: Page, gesture: () => Promise<void>) {
  const response = page.waitForResponse(
    (candidate) =>
      candidate.request().method() === "POST" &&
      (candidate.request().postData() ?? "").includes('"canceledOpen"'),
  );
  await gesture();
  await response;
}

// ---------- Souris (768 px et plus)

/** Amène la colonne en entier dans la partie visible du tableau (défilement horizontal du tableau seul). */
async function showColumn(page: Page, category: Category): Promise<void> {
  await boardColumn(page, category).evaluate((el) => {
    const board = el.parentElement!;
    const rect = el.getBoundingClientRect();
    const field = board.getBoundingClientRect();
    if (rect.right > field.right) board.scrollLeft += rect.right - field.right;
    else if (rect.left < field.left) board.scrollLeft -= field.left - rect.left;
  });
}

/** Partie d'une boîte visible dans le tableau et dans la fenêtre. */
async function visiblePart(
  page: Page,
  locator: Locator,
): Promise<{ left: number; right: number; top: number; bottom: number }> {
  const box = await locator.boundingBox();
  const field = await boardOf(page).boundingBox();
  if (!box || !field) throw new Error("élément sans boîte");
  const viewport = page.viewportSize()!;
  return {
    left: Math.max(box.x, field.x, 0),
    right: Math.min(box.x + box.width, field.x + field.width, viewport.width),
    top: Math.max(box.y, 0),
    bottom: Math.min(box.y + box.height, viewport.height),
  };
}

/** Point de saisie d'une carte : le milieu de sa partie visible. */
async function grabPoint(
  page: Page,
  id: string,
): Promise<{ x: number; y: number }> {
  const part = await visiblePart(page, boardCard(page, id));
  expect(part.right - part.left).toBeGreaterThan(40);
  return { x: (part.left + part.right) / 2, y: (part.top + part.bottom) / 2 };
}

/** Point de dépôt au milieu de la partie visible d'une colonne, loin de son en-tête. */
async function columnPoint(
  page: Page,
  category: Category,
): Promise<{ x: number; y: number }> {
  const part = await visiblePart(page, boardColumn(page, category));
  expect(part.right - part.left).toBeGreaterThan(40);
  return {
    x: (part.left + part.right) / 2,
    y: Math.min((part.top + part.bottom) / 2, part.bottom - 40),
  };
}

async function dragWithMouse(
  page: Page,
  from: { x: number; y: number },
  to: { x: number; y: number },
): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(to.x, to.y, { steps: 15 });
  await page.mouse.up();
  await expect(overlay(page)).toHaveCount(0);
}

/**
 * Glisse une carte à la souris au milieu d'une colonne (ou sur le bandeau replié). Colonne d'arrivée et carte
 * visibles ensemble : glisser direct. Trop éloignées pour tenir ensemble dans le tableau : la carte est portée
 * au bord du tableau, dont le défilement automatique amène la colonne d'arrivée.
 */
async function mouseToColumn(
  page: Page,
  id: string,
  category: Category,
): Promise<void> {
  await showColumn(page, category);
  const part = await visiblePart(page, boardCard(page, id));
  if (part.right - part.left > 40) {
    await dragWithMouse(
      page,
      await grabPoint(page, id),
      await columnPoint(page, category),
    );
    return;
  }
  await boardCard(page, id).evaluate((el) => {
    const column = el.closest("[data-board-column]")!;
    const board = column.parentElement!;
    const rect = column.getBoundingClientRect();
    const field = board.getBoundingClientRect();
    if (rect.right > field.right) board.scrollLeft += rect.right - field.right;
    else if (rect.left < field.left) board.scrollLeft -= field.left - rect.left;
  });
  const from = await grabPoint(page, id);
  const field = (await boardOf(page).boundingBox())!;
  const target = (await boardColumn(page, category).boundingBox())!;
  const edge =
    target.x < from.x
      ? Math.max(field.x, 0) + 12
      : Math.min(field.x + field.width, page.viewportSize()!.width) - 12;
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y, { steps: 2 });
  await expect(overlay(page)).toBeVisible();
  await page.mouse.move(edge, from.y, { steps: 15 });
  await expect
    .poll(() =>
      boardColumn(page, category).evaluate((el) => {
        const rect = el.getBoundingClientRect();
        const board = el.parentElement!.getBoundingClientRect();
        return rect.left >= board.left - 1 && rect.right <= board.right + 1;
      }),
    )
    .toBe(true);
  const drop = await columnPoint(page, category);
  await page.mouse.move(drop.x, drop.y, { steps: 8 });
  await page.mouse.up();
  await expect(overlay(page)).toHaveCount(0);
}

// ---------- Doigt (onglets, sous 768 px)

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

/** Milieu d'une boîte déjà à l'écran (aucun défilement : le point d'un autre élément resterait juste). */
async function middle(locator: Locator): Promise<{ x: number; y: number }> {
  const box = await locator.boundingBox();
  if (!box) throw new Error("élément sans boîte");
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Barre d'onglets immobile : la boîte d'un onglet ne se lit qu'alors. */
async function waitForStillTabs(page: Page): Promise<void> {
  await expect
    .poll(() =>
      page.getByRole("tablist").evaluate(
        (bar) =>
          new Promise<boolean>((resolve) => {
            const before = bar.scrollLeft;
            setTimeout(() => resolve(bar.scrollLeft === before), 120);
          }),
      ),
    )
    .toBe(true);
}

/**
 * Choisit un onglet. dnd-kit avale tout clic dans les 50 ms qui suivent un glisser : le toucher est rejoué
 * jusqu'à ce que l'onglet soit choisi.
 */
async function chooseTab(page: Page, category: Category): Promise<void> {
  const tab = tabOf(page, category);
  await expect(async () => {
    await tab.click();
    await expect(tab).toHaveAttribute("aria-selected", "true", {
      timeout: 500,
    });
  }).toPass();
  await waitForStillTabs(page);
}

/** Amène un onglet en entier dans la barre (défilement de la barre seule). */
async function showTab(page: Page, category: Category): Promise<void> {
  await tabOf(page, category).evaluate((tab) => {
    const bar = tab.parentElement!;
    const rect = tab.getBoundingClientRect();
    const field = bar.getBoundingClientRect();
    if (rect.right > field.right - 40) {
      bar.scrollLeft += rect.right - field.right + 40;
    } else if (rect.left < field.left + 40) {
      bar.scrollLeft -= field.left + 40 - rect.left;
    }
  });
  await waitForStillTabs(page);
}

/** Appui long sur la carte (saisie au bout de 250 ms), puis dépôt sur l'onglet d'une colonne. */
async function fingerToTab(
  page: Page,
  id: string,
  category: Category,
): Promise<void> {
  await showTab(page, category);
  const finger = await Finger.on(page);
  const from = await middle(boardCard(page, id));
  await finger.down(from);
  await expect(overlay(page)).toBeVisible();
  await finger.move(from, await middle(tabOf(page, category)));
  await finger.up();
  await expect(overlay(page)).toHaveCount(0);
}

/** Appui long sur une carte, amenée au milieu de l'écran (hors de la barre du bas), puis dépôt sur une autre. */
async function fingerOnto(
  page: Page,
  moved: string,
  onto: string,
): Promise<void> {
  await boardCard(page, moved).evaluate((el) =>
    el.scrollIntoView({ block: "center" }),
  );
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          new Promise<boolean>((resolve) => {
            const before = window.scrollY;
            setTimeout(() => resolve(window.scrollY === before), 120);
          }),
      ),
    )
    .toBe(true);
  const finger = await Finger.on(page);
  const from = await middle(boardCard(page, moved));
  await finger.down(from);
  await expect(overlay(page)).toBeVisible();
  await finger.move(from, await middle(boardCard(page, onto)));
  await finger.up();
  await expect(overlay(page)).toHaveCount(0);
}

/** Dépose une carte dans une colonne : souris au milieu de la colonne, ou doigt sur son onglet. */
async function moveTo(
  page: Page,
  id: string,
  category: Category,
): Promise<void> {
  await saved(page, () =>
    isWide(page)
      ? mouseToColumn(page, id, category)
      : fingerToTab(page, id, category),
  );
  await expect(inColumn(page, category, id)).toBeAttached();
}

/** Recharge et attend le tableau hydraté. */
async function reloadBoard(page: Page): Promise<void> {
  await page.reload();
  await expect(boardColumn(page, "unstarted")).toBeAttached();
  await expect(page.locator('[id^="DndLiveRegion-"]')).toBeAttached();
}

/** Laisse passer deux images : sert à vérifier qu'un détail ne s'ouvre pas (une absence ne s'attend pas). */
async function twoFrames(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve)),
      ),
  );
}

// ---------- Scénario 1 : faire avancer une tâche

test("scénario 1 : une carte déposée de « À faire » dans « En cours » (souris au milieu de la colonne, doigt sur l'onglet) y est encore après rechargement", async ({
  page,
}) => {
  const messages = await start(page);
  const task = await make(page, "Avancer");
  if (!isWide(page)) await chooseTab(page, "unstarted");

  await moveTo(page, task, "started");

  await expect(inColumn(page, "unstarted", task)).toHaveCount(0);
  await reloadBoard(page);
  await expect(inColumn(page, "started", task)).toBeAttached();
  await expect(inColumn(page, "unstarted", task)).toHaveCount(0);
  expect(messages).toEqual([]);
});

// ---------- Scénario 2 : ranger une colonne

test("scénario 2 : trois cartes réordonnées dans « À faire », dont une sous-tâche, gardent leur ordre au rechargement et quand les sous-tâches sont masquées puis réaffichées", async ({
  page,
}) => {
  const messages = await start(page);
  const first = await make(page, "Ranger un");
  const second = await make(page, "Ranger deux");
  const parent = await make(page, "Ranger parente");
  const subtask = await addSubtask(
    page,
    parent,
    uniqueTitle(`${PREFIX} Ranger sous-tâche`),
  );
  created.push(subtask);
  await openBoard(page);
  if (!isWide(page)) await chooseTab(page, "unstarted");
  // Arrivées en tête de colonne : la dernière créée est en haut.
  const mine = [first, second, subtask];
  expect(await orderOf(page, "unstarted", mine)).toEqual([
    subtask,
    second,
    first,
  ]);

  // « Ranger un » remonte sur la sous-tâche (il prend sa place), puis la sous-tâche descend sur « Ranger deux ».
  for (const [moved, onto] of [
    [first, subtask],
    [subtask, second],
  ]) {
    await saved(page, async () => {
      if (isWide(page)) {
        await dragWithMouse(
          page,
          await grabPoint(page, moved),
          await grabPoint(page, onto),
        );
      } else {
        await fingerOnto(page, moved, onto);
      }
    });
  }
  const arranged = await orderOf(page, "unstarted", mine);
  expect(arranged).toEqual([first, second, subtask]);

  await reloadBoard(page);
  if (!isWide(page)) await chooseTab(page, "unstarted");
  expect(await orderOf(page, "unstarted", mine)).toEqual(arranged);

  const subtasks = page.getByRole("switch", {
    name: BOARD.options.subtasks,
    exact: true,
  });
  await subtasks.click();
  await expect(boardCard(page, subtask)).toHaveCount(0);
  expect(await orderOf(page, "unstarted", mine)).toEqual([first, second]);
  await subtasks.click();
  await expect(boardCard(page, subtask)).toBeAttached();
  expect(await orderOf(page, "unstarted", mine)).toEqual(arranged);
  expect(messages).toEqual([]);
});

test("scénario 2, filtre d'espace (côté Pro) : l'ordre rangé est gardé avec l'espace filtré puis tous les espaces", async ({
  page,
}) => {
  const messages = await start(page, { side: "pro" });
  const space = await spaceName(page);
  const lower = await makeInSpace(page, "Filtre bas");
  const upper = await makeInSpace(page, "Filtre haut");
  const other = await make(page, "Filtre sans espace");
  if (!isWide(page)) await chooseTab(page, "unstarted");
  expect(await orderOf(page, "unstarted", [lower, upper, other])).toEqual([
    other,
    upper,
    lower,
  ]);

  // « Filtre bas » remonte en tête de ses cartes.
  await saved(page, async () => {
    if (isWide(page)) {
      await dragWithMouse(
        page,
        await grabPoint(page, lower),
        await grabPoint(page, other),
      );
    } else {
      await fingerOnto(page, lower, other);
    }
  });
  expect(await orderOf(page, "unstarted", [lower, upper, other])).toEqual([
    lower,
    other,
    upper,
  ]);

  await filterSpace(page, space);
  await expect(boardCard(page, other)).toHaveCount(0);
  expect(await orderOf(page, "unstarted", [lower, upper])).toEqual([
    lower,
    upper,
  ]);
  await filterSpace(page, null);
  await expect(boardCard(page, other)).toBeAttached();
  expect(await orderOf(page, "unstarted", [lower, upper, other])).toEqual([
    lower,
    other,
    upper,
  ]);
  expect(messages).toEqual([]);
});

/** Nom du premier espace du côté actif, lu dans la pastille « Espace » de l'ajout rapide. */
async function spaceName(page: Page): Promise<string> {
  const dialog = await openQuickAdd(page);
  await dialog
    .getByRole("button", {
      name: new RegExp(`^${fr.tasks.quickAdd.context.label}`),
    })
    .click();
  const name = await page.getByRole("menuitemradio").nth(1).innerText();
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return name.trim();
}

/** Crée une tâche dans le premier espace du côté actif, échéance et priorité facultatives. */
async function makeInSpace(
  page: Page,
  name: string,
  due?: string,
): Promise<string> {
  const dialog = await openQuickAdd(page);
  await quickAddTitle(dialog).fill(uniqueTitle(`${PREFIX} ${name}`));
  await dialog
    .getByRole("button", {
      name: new RegExp(`^${fr.tasks.quickAdd.context.label}`),
    })
    .click();
  await page.getByRole("menuitemradio").nth(1).click();
  if (due !== undefined) await pickDueDate(page, dialog, due);
  const id = await submitQuickAdd(dialog);
  created.push(id);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(boardCard(page, id)).toBeAttached();
  return id;
}

/** Filtre d'espace du côté actif : un espace par son nom, ou tous (`null`). */
async function filterSpace(page: Page, name: string | null): Promise<void> {
  if ((page.viewportSize()?.width ?? 0) >= 1024) {
    const group = page
      .getByRole("navigation", { name: fr.shell.navigation })
      .getByRole("group", { name: fr.shell.contexts.label });
    const button =
      name === null
        ? group.getByRole("button").first()
        : group.getByRole("button", { name });
    await button.click();
    await expect(button).toHaveAttribute("aria-pressed", "true");
    return;
  }
  await page
    .getByRole("button", { name: new RegExp(`^${fr.shell.contexts.label}`) })
    .click();
  const items = page.getByRole("menuitemradio");
  await (
    name === null ? items.first() : items.filter({ hasText: name })
  ).click();
}

// ---------- Scénario 3 : terminer et annuler

test("@desktop scénario 3 : dépôt dans Terminée (carte en tête, compteur de la parente à jour sans recharger), dépôt sur le bandeau Annulée, bandeau déplié, carte ouverte puis ramenée dans « À faire », état du bandeau gardé", async ({
  page,
}) => {
  const messages = await start(page);
  const parent = await make(page, "Finir parente");
  const subtask = await addSubtask(
    page,
    parent,
    uniqueTitle(`${PREFIX} Finir sous-tâche`),
  );
  created.push(subtask);
  await openBoard(page);
  const dropped = await make(page, "Annuler");
  const counter = boardCard(page, parent).locator("[data-card-legend]");
  await expect(counter).toContainText("0/1");

  await moveTo(page, subtask, "completed");

  // En tête de Terminée ; et le compteur de la parente vient du rendu serveur qui suit la réussite.
  await expect(
    boardColumn(page, "completed").locator("[data-board-card]").first(),
  ).toHaveAttribute("data-board-card", subtask);
  await expect(counter).toContainText("1/1");

  const band = boardColumn(page, "canceled");
  const toggle = band.locator("[data-board-header]").getByRole("button");
  const count = async () =>
    Number((await toggle.getAttribute("aria-label"))!.replace(/\D/g, ""));
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  const before = await count();

  await saved(page, () => mouseToColumn(page, dropped, "canceled"));

  await expect.poll(count).toBe(before + 1);
  await expect(inColumn(page, "unstarted", dropped)).toHaveCount(0);

  await bandSaved(page, () => toggle.click());
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(inColumn(page, "canceled", dropped)).toBeVisible();
  await reloadBoard(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "true");

  // La carte annulée s'ouvre comme ailleurs.
  await showColumn(page, "canceled");
  await boardCard(page, dropped).click();
  await expect(detailDialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tasks/${dropped}$`));
  await detailDialog(page)
    .getByRole("button", { name: fr.tasks.detail.close })
    .click();
  await expect(detailDialog(page)).toHaveCount(0);

  // Colonne dépliée, cible de dépôt comme les autres : retour dans « À faire ».
  await moveTo(page, dropped, "unstarted");

  await bandSaved(page, () => toggle.click());
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await reloadBoard(page);
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(inColumn(page, "unstarted", dropped)).toBeAttached();
  expect(messages).toEqual([]);
});

test("@mobile scénario 3 : dépôt au doigt sur l'onglet Terminée (carte en tête) puis sur l'onglet Annulée, un onglet comme les autres ; la carte annulée s'ouvre et revient dans « À faire »", async ({
  page,
}) => {
  const messages = await start(page);
  const done = await make(page, "Finir");
  const dropped = await make(page, "Annuler");
  await chooseTab(page, "unstarted");

  await moveTo(page, done, "completed");
  await chooseTab(page, "unstarted");
  await moveTo(page, dropped, "canceled");

  await chooseTab(page, "completed");
  await expect(
    boardColumn(page, "completed").locator("[data-board-card]").first(),
  ).toHaveAttribute("data-board-card", done);
  await chooseTab(page, "canceled");
  await expect(inColumn(page, "canceled", dropped)).toBeVisible();
  // Sous 768 px : ni bandeau ni bouton.
  await expect(
    boardColumn(page, "canceled").locator("[data-board-header]"),
  ).toBeHidden();

  await boardCard(page, dropped).tap();
  await expect(detailDialog(page)).toBeVisible();
  await detailDialog(page)
    .getByRole("button", { name: fr.tasks.detail.close })
    .click();
  await expect(detailDialog(page)).toHaveCount(0);

  await moveTo(page, dropped, "unstarted");
  await reloadBoard(page);
  await expect(inColumn(page, "unstarted", dropped)).toBeAttached();
  await expect(inColumn(page, "completed", done)).toBeAttached();
  expect(messages).toEqual([]);
});

// ---------- Scénario 4 : échec d'enregistrement

test("@desktop scénario 4 : réseau coupé, la carte déposée revient avec « Déplacement non enregistré. » ; réseau rétabli, Réessayer la déplace", async ({
  page,
  context,
}) => {
  await start(page);
  const task = await make(page, "Échec");
  const bubble = page.getByRole("alert").getByText(BOARD.moveFailed);

  await context.setOffline(true);
  await mouseToColumn(page, task, "started");

  await expect(bubble).toBeVisible();
  await expect(inColumn(page, "unstarted", task)).toBeAttached();
  await expect(inColumn(page, "started", task)).toHaveCount(0);

  await context.setOffline(false);
  await saved(page, () =>
    page.getByRole("button", { name: BOARD.retry }).click(),
  );

  await expect(inColumn(page, "started", task)).toBeAttached();
  await expect(bubble).toHaveCount(0);
  await reloadBoard(page);
  await expect(inColumn(page, "started", task)).toBeAttached();
});

test("@desktop scénario 4, dépôt refait à la main : après un échec vers Terminée et la bulle effacée, le même dépôt est enregistré", async ({
  page,
  context,
}) => {
  await start(page);
  const task = await make(page, "Échec Terminée");
  const bubble = page.getByRole("alert").getByText(BOARD.moveFailed);

  await context.setOffline(true);
  await mouseToColumn(page, task, "completed");
  await expect(bubble).toBeVisible();
  // La bulle s'efface seule (5 s).
  await expect(bubble).toHaveCount(0, { timeout: 10_000 });
  await expect(inColumn(page, "unstarted", task)).toBeAttached();
  await context.setOffline(false);

  await boardOf(page).evaluate((board) => (board.scrollLeft = 0));
  await moveTo(page, task, "completed");

  await expect(bubble).toHaveCount(0);
  await reloadBoard(page);
  await expect(inColumn(page, "completed", task)).toBeAttached();
});

// ---------- Scénario 5 : clavier

test("@desktop scénario 5 : au clavier, Espace saisit, flèche droite déplace, Espace dépose ; Entrée ouvre le détail, Échap le ferme et rend le focus à la carte ; Entrée déplie le bandeau Annulée", async ({
  page,
}) => {
  const messages = await start(page);
  const task = await make(page, "Clavier");
  const target = boardCard(page, task);
  // Une carte = un arrêt de tabulation : Tab l'atteint depuis la carte qui la précède ou le contrôle d'avant.
  await expect(target).toHaveAttribute("tabindex", "0");
  await target.focus();

  // Chaque touche attend l'annonce de la précédente : le capteur clavier s'arme après la saisie.
  const announced = page.locator('[id^="DndLiveRegion-"]');
  await saved(page, async () => {
    await page.keyboard.press("Space");
    await expect(overlay(page)).toBeVisible();
    await expect(announced).toContainText(STATUS.unstarted);
    // Juste après la saisie, dnd-kit n'a pas encore mesuré les colonnes : une flèche pressée dans l'instant
    // est sans effet. Elle est rejouée jusqu'à l'annonce de la colonne voisine.
    await expect(async () => {
      await page.keyboard.press("ArrowRight");
      await expect(announced).toContainText(STATUS.started, { timeout: 1500 });
    }).toPass();
    await page.keyboard.press("Space");
    await expect(overlay(page)).toHaveCount(0);
  });
  await expect(inColumn(page, "started", task)).toBeAttached();

  await boardCard(page, task).focus();
  await page.keyboard.press("Enter");
  await expect(detailDialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task}$`));
  await page.keyboard.press("Escape");
  await expect(detailDialog(page)).toHaveCount(0);
  await expect(boardCard(page, task)).toBeFocused();

  const toggle = boardColumn(page, "canceled")
    .locator("[data-board-header]")
    .getByRole("button");
  await toggle.focus();
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  await expect(toggle).toHaveAttribute(
    "aria-label",
    new RegExp(`^${STATUS.canceled}, .*, replier$`),
  );
  await page.keyboard.press("Enter");
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  expect(messages).toEqual([]);
});

test("@desktop bandeau Annulée déplié puis rechargement immédiat, sans attendre l'enregistrement : l'état déplié est gardé", async ({
  page,
}) => {
  const messages = await start(page);
  const toggle = () =>
    boardColumn(page, "canceled")
      .locator("[data-board-header]")
      .getByRole("button");
  await expect(toggle()).toHaveAttribute("aria-expanded", "false");

  await toggle().click();
  await page.reload();

  await expect(toggle()).toHaveAttribute("aria-expanded", "true");
  await bandSaved(page, () => toggle().click());
  await expect(toggle()).toHaveAttribute("aria-expanded", "false");
  expect(messages).toEqual([]);
});

// ---------- Scénario 7 : sous-tâches sur le tableau

test("scénario 7 : deux sous-tâches d'une parente Haute naissent en Haute, en cartes avec le titre de la parente ; terminée puis masquée, l'une quitte Terminée ; « Sous-tâches » éteint, il reste la parente à 1/2 ; options gardées au rechargement", async ({
  page,
}) => {
  const messages = await start(page);
  const parent = await make(page, "Parente");
  await setTaskPriority(page, parent, "2");
  const one = await addSubtask(page, parent, uniqueTitle(`${PREFIX} Fille un`));
  const two = await addSubtask(
    page,
    parent,
    uniqueTitle(`${PREFIX} Fille deux`),
  );
  created.push(one, two);
  await openBoard(page);
  if (!isWide(page)) await chooseTab(page, "unstarted");
  const high = fr.tasks.list.priority["2"];

  for (const subtask of [one, two]) {
    const subtaskCard = inColumn(page, "unstarted", subtask);
    await expect(subtaskCard).toBeVisible();
    await expect(subtaskCard.locator("[data-card-legend]")).toContainText(
      `${PREFIX} Parente`,
    );
    await expect(subtaskCard.getByText(high, { exact: true })).toBeAttached();
  }

  await moveTo(page, one, "completed");
  if (!isWide(page)) await chooseTab(page, "unstarted");
  const legend = boardCard(page, parent).locator("[data-card-legend]");
  // Sans recharger : le compteur de la parente vient du rendu serveur qui suit la réussite.
  await expect(legend).toContainText("1/2");

  const hideDone = page.getByRole("switch", {
    name: BOARD.options.hideDoneSubtasks,
  });
  const subtasks = page.getByRole("switch", {
    name: BOARD.options.subtasks,
    exact: true,
  });
  await hideDone.click();
  await expect(boardCard(page, one)).toHaveCount(0);
  await expect(boardCard(page, two)).toBeAttached();

  await subtasks.click();
  await expect(boardCard(page, two)).toHaveCount(0);
  await expect(boardCard(page, parent)).toBeAttached();
  await expect(legend).toContainText("1/2");
  await expect(hideDone).toBeDisabled();

  await reloadBoard(page);
  await expect(subtasks).toHaveAttribute("aria-checked", "false");
  await expect(hideDone).toHaveAttribute("aria-checked", "true");
  await expect(boardCard(page, two)).toHaveCount(0);
  await expect(boardCard(page, parent)).toBeAttached();
  expect(messages).toEqual([]);
});

// ---------- Deux dépôts rapides, session expirée

test("@desktop deux dépôts rapides sans attendre : aucune carte ne recule pendant l'enregistrement, et l'état rechargé est celui affiché", async ({
  page,
}) => {
  const messages = await start(page);
  const one = await make(page, "Rapide un");
  const two = await make(page, "Rapide deux");
  let moves = 0;
  page.on("response", (response) => {
    if ((response.request().postData() ?? "").includes('"tasks.move"')) moves++;
  });

  await mouseToColumn(page, one, "started");
  await mouseToColumn(page, two, "backlog");
  // Colonne de chaque carte, relevée à chaque image pendant une seconde.
  const seen = await page.evaluate(
    ([a, b]) =>
      new Promise<string[]>((resolve) => {
        const where = (id: string) =>
          document
            .querySelector(`[data-board-card="${id}"]`)
            ?.closest("[data-board-column]")
            ?.getAttribute("data-board-column") ?? "absente";
        const samples = new Set<string>();
        const start = performance.now();
        const frame = () => {
          samples.add(`${where(a)} ${where(b)}`);
          if (performance.now() - start < 1000) requestAnimationFrame(frame);
          else resolve([...samples]);
        };
        requestAnimationFrame(frame);
      }),
    [one, two],
  );

  expect(seen).toEqual(["started backlog"]);
  await expect.poll(() => moves).toBe(2);
  await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
  await expect(inColumn(page, "started", one)).toBeAttached();
  await expect(inColumn(page, "backlog", two)).toBeAttached();
  await reloadBoard(page);
  await expect(inColumn(page, "started", one)).toBeAttached();
  await expect(inColumn(page, "backlog", two)).toBeAttached();
  expect(messages).toEqual([]);
});

test("@desktop session expirée pendant un dépôt : arrivée sur /login, sans bulle « Déplacement non enregistré. », et le retour arrière ne boucle pas", async ({
  page,
  context,
}) => {
  await start(page);
  const task = await make(page, "Session");
  try {
    // Plus aucune requête en vol : une réponse arrivée après coup reposerait le cookie de session.
    await page.waitForLoadState("networkidle");
    await context.clearCookies();
    expect(
      (await context.cookies()).filter((cookie) =>
        cookie.name.includes("neon-auth"),
      ),
    ).toEqual([]);
    await mouseToColumn(page, task, "started");

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(fr.auth.login.email)).toBeVisible();
    await expect(page.getByText(BOARD.moveFailed)).toHaveCount(0);

    // Retour arrière : Next rend le tableau gardé en mémoire (aucune requête, aucune donnée nouvelle), une seule
    // fois, sans repartir vers /login en boucle et sans bulle ; la première lecture du serveur ramène à /login.
    await page.goBack();
    await expect(page).toHaveURL(/\/tasks$/);
    await twoFrames(page);
    await expect(page).toHaveURL(/\/tasks$/);
    await expect(page.getByText(BOARD.moveFailed)).toHaveCount(0);
    await page.reload();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByLabel(fr.auth.login.email)).toBeVisible();
  } finally {
    // Session rendue pour le ménage de fin de test.
    await signIn(page);
  }
});

// ---------- Vue, « Tout voir », givre

test("bascule de vue : « Terminées » absent en vue Tableau, présent en vue Liste, et la vue choisie est gardée au rechargement", async ({
  page,
}) => {
  const messages = await start(page);
  const completed = page.getByRole("switch", {
    name: fr.tasks.list.completedToggle,
    exact: true,
  });
  const view = page.getByRole("group", { name: fr.tasks.view.label });
  await expect(completed).toHaveCount(0);
  await expect(
    page.getByRole("group", { name: BOARD.options.label }),
  ).toBeVisible();

  await view.getByRole("button", { name: fr.tasks.view.list }).click();

  await expect(completed).toBeVisible();
  await expect(boardColumn(page, "unstarted")).toHaveCount(0);
  await page.reload();
  await expect(completed).toBeVisible();

  await view.getByRole("button", { name: fr.tasks.view.board }).click();
  await expect(boardColumn(page, "unstarted")).toBeAttached();
  await expect(completed).toHaveCount(0);
  expect(messages).toEqual([]);
});

test("givre de chargement : celui de la vue mémorisée, colonne et barre d'onglets à la place du contenu", async ({
  page,
  browser,
  baseURL,
}) => {
  await start(page);
  const shown = (scope: Page, selector: string) =>
    scope.locator(selector).evaluateAll((all) => {
      const first = all.find((el) => el.getBoundingClientRect().width > 0);
      if (!first) return null;
      const rect = first.getBoundingClientRect();
      return [rect.x, rect.y, rect.width].map((value) => Math.round(value));
    });
  const content = {
    column: await shown(page, "[data-board-column]"),
    tabs: await shown(page, '[role="tablist"]'),
  };
  // Sans JavaScript, le contenu diffusé ne remplace jamais le chargement : le givre reste affiché, mesurable.
  const still = await browser.newContext({
    storageState: await page.context().storageState(),
    javaScriptEnabled: false,
    locale: "fr-FR",
    baseURL,
    viewport: page.viewportSize(),
  });
  try {
    const frozen = await still.newPage();
    await frozen.goto("/tasks");
    await expect(frozen.getByTestId("tasks-board-frost")).toBeVisible();
    await expect(frozen.getByTestId("tasks-frost")).toHaveCount(0);
    expect({
      column: await shown(frozen, '[data-testid="tasks-board-frost-column"]'),
      tabs: await shown(
        frozen,
        '[data-testid="tasks-board-frost-tabs"] > div:not(.frost)',
      ),
    }).toEqual(content);

    await still.addCookies([
      { name: "bmb_tasks_view", value: "list", url: baseURL! },
    ]);
    await frozen.goto("/tasks");
    await expect(frozen.getByTestId("tasks-frost")).toBeVisible();
    await expect(frozen.getByTestId("tasks-board-frost")).toHaveCount(0);
  } finally {
    await still.close();
  }
});

test("Terminée : 20 cartes au plus, « ?done=1 » n'y change rien ; au-delà de 20, « Tout voir » montre tout et la requête est gardée à l'ouverture et à la fermeture du détail", async ({
  page,
}, testInfo) => {
  const messages = await start(page);
  await openBoard(page, "?done=1");
  const cards = boardColumn(page, "completed").locator("[data-board-card]");
  const seeAll = page.getByRole("link", { name: /^Tout voir \(\d+\)$/ });
  expect(await cards.count()).toBeLessThanOrEqual(20);
  await expect(page.getByRole("link", { name: /^Voir les 20/ })).toHaveCount(0);

  if (!isWide(page)) await chooseTab(page, "completed");
  if ((await seeAll.count()) === 0) {
    // Compte e2e sans plus de 20 tâches terminées de ce côté : la suite n'est pas jouable aujourd'hui.
    testInfo.annotations.push({
      type: "non joué",
      description: "« Tout voir » : moins de 21 tâches terminées sur le compte",
    });
    expect(messages).toEqual([]);
    return;
  }
  const total = Number((await seeAll.innerText()).replace(/\D/g, ""));
  expect(await cards.count()).toBe(20);

  await seeAll.click();

  await expect(page).toHaveURL(/\/tasks\?done=all$/);
  await expect(cards).toHaveCount(Math.min(total, 200));
  await cards.first().click();
  await expect(detailDialog(page)).toBeVisible();
  await expect(page).toHaveURL(/\/tasks\/[0-9a-f-]{36}\?done=all$/);
  await detailDialog(page)
    .getByRole("button", { name: fr.tasks.detail.close })
    .click();
  await expect(page).toHaveURL(/\/tasks\?done=all$/);
  await expect(cards).toHaveCount(Math.min(total, 200));
  await page.getByRole("link", { name: /^Voir les 20/ }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(cards).toHaveCount(20);
  expect(messages).toEqual([]);
});

// ---------- Carte réelle : légende

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

test("@desktop carte réelle terminée : légende sans couleur et lisible, textes à 4,5:1 au moins, icône de priorité à 3:1 au moins", async ({
  page,
}) => {
  await start(page, { side: "pro" });
  const space = await spaceName(page);
  const task = await makeInSpace(page, "Contraste", userDay(6));
  await setTaskPriority(page, task, "1");
  await openBoard(page);
  await moveTo(page, task, "completed");
  // Pointeur écarté : pas de survol sur la carte mesurée.
  await page.mouse.move(5, 5);
  const legend = boardCard(page, task).locator("[data-card-legend]");
  const chip = legend.getByText(space, { exact: true });
  const badge = legend
    .getByText(fr.tasks.list.priority["1"], { exact: true })
    .locator("..");
  const date = legend.locator("span").filter({ hasText: /^\d{1,2} \S+$/ });
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

test("@mobile carte réelle à légende longue (espace, échéance, compteur, priorité) : le badge de priorité n'est jamais seul sur une ligne, rien ne déborde de la carte", async ({
  page,
}) => {
  await start(page, { side: "pro" });
  const task = await makeInSpace(
    page,
    "Légende longue pour voir la carte passer à la ligne",
    userDay(9),
  );
  await setTaskPriority(page, task, "2");
  created.push(
    await addSubtask(page, task, uniqueTitle(`${PREFIX} Légende fille`)),
  );
  await openBoard(page);
  await chooseTab(page, "unstarted");
  const target = boardCard(page, task);
  const legend = target.locator("[data-card-legend]");
  await expect(legend).toContainText("0/1");

  const layout = await legend.evaluate((el) => {
    const group = el.querySelector("[data-legend-group]")!;
    const [last, badge] = Array.from(group.children).map((child) =>
      child.getBoundingClientRect(),
    );
    const card = el.closest("[data-task-card]")!;
    return {
      sameLine: Math.abs(
        (last.top + last.bottom) / 2 - (badge.top + badge.bottom) / 2,
      ),
      overflow: card.scrollWidth - card.clientWidth,
      badgeInside: badge.right <= card.getBoundingClientRect().right,
    };
  });

  expect(layout.sameLine).toBeLessThanOrEqual(2);
  expect(layout.overflow).toBeLessThanOrEqual(0);
  expect(layout.badgeInside).toBe(true);
});

// ---------- Intentions reprises de la démo (D4, D5, D6, onglet visé)

type Sample = {
  scrollLeft: number;
  columnOffset: number | null;
  columnWidth: number;
  columnHeight: number;
};

// Défilement automatique de dnd-kit : au plus 10 px toutes les 5 ms. Une image plus lente sous une machine
// chargée en cumule plusieurs ; au-delà d'une demi-colonne (160 px), c'est un saut, pas un défilement.
const MAX_SCROLL_STEP = 160;

test("@desktop D4 : pendant un glisser à la souris de « À faire » vers « Terminée », le tableau défile sans recul ni saut et la colonne d'origine reste en place", async ({
  page,
}) => {
  const messages = await start(page);
  const task = await make(page, "Défilement");
  const from = await grabPoint(page, task);
  await page.evaluate(() => {
    const store = window as unknown as {
      __samples: unknown[];
      __sampling: boolean;
    };
    store.__samples = [];
    store.__sampling = true;
    const frame = () => {
      const columnEl = document.querySelector(
        '[data-board-column="unstarted"]',
      );
      const board = document.querySelector(
        "[data-board-column]",
      )!.parentElement!;
      const rect = columnEl?.getBoundingClientRect();
      store.__samples.push({
        scrollLeft: board.scrollLeft,
        columnOffset: rect
          ? rect.left - board.getBoundingClientRect().left + board.scrollLeft
          : null,
        columnWidth: rect?.width ?? 0,
        columnHeight: rect?.height ?? 0,
      });
      if (store.__sampling) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });

  await saved(page, async () => {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move(from.x + 10, from.y, { steps: 2 });
    await expect(overlay(page)).toBeVisible();
    // Pointeur tenu près du bord droit du tableau : le défilement automatique amène « Terminée ».
    const field = (await boardOf(page).boundingBox())!;
    const edge = {
      x: Math.min(field.x + field.width, page.viewportSize()!.width) - 12,
      y: from.y,
    };
    await page.mouse.move(edge.x, edge.y, { steps: 15 });
    await expect
      .poll(() =>
        boardColumn(page, "completed").evaluate((el) => {
          const rect = el.getBoundingClientRect();
          const board = el.parentElement!.getBoundingClientRect();
          return rect.left >= board.left - 1 && rect.right <= board.right + 1;
        }),
      )
      .toBe(true);
    const drop = await columnPoint(page, "completed");
    await page.mouse.move(drop.x, drop.y, { steps: 8 });
    await page.mouse.up();
    await expect(overlay(page)).toHaveCount(0);
  });
  const samples = await page.evaluate(() => {
    const store = window as unknown as {
      __samples: Sample[];
      __sampling: boolean;
    };
    store.__sampling = false;
    return store.__samples;
  });

  expect(samples.length).toBeGreaterThan(20);
  expect(samples.at(-1)!.scrollLeft).toBeGreaterThan(samples[0].scrollLeft);
  const steps = samples
    .slice(1)
    .map((sample, index) => sample.scrollLeft - samples[index].scrollLeft);
  const first = samples[0];
  expect({
    back: steps.filter((step) => step < -1),
    jumps: steps.filter((step) => step > MAX_SCROLL_STEP),
    hidden: samples.filter(
      (sample) =>
        sample.columnOffset === null ||
        sample.columnWidth < 1 ||
        sample.columnHeight < 1,
    ).length,
    shifted: samples.filter(
      (sample) =>
        sample.columnOffset !== null &&
        Math.abs(sample.columnOffset - first.columnOffset!) > 1,
    ).length,
  }).toEqual({ back: [], jumps: [], hidden: 0, shifted: 0 });
  await expect(inColumn(page, "completed", task)).toBeAttached();
  expect(messages).toEqual([]);
});

test("@mobile D4 et onglet visé : pendant un glisser au doigt vers un onglet coupé par le bord, la barre l'amène en entier, il est marqué et redit par le repère de la carte ; ni la page, ni la barre, ni le panneau ne sautent", async ({
  page,
}) => {
  const messages = await start(page);
  const task = await make(page, "Onglet visé");
  await chooseTab(page, "unstarted");
  const tablist = page.getByRole("tablist");
  // Onglet coupé par le bord droit de la barre : le doigt vise sa partie visible.
  const cut = await tablist.evaluate((bar) => {
    const field = bar.getBoundingClientRect();
    for (const tab of bar.querySelectorAll('[role="tab"]')) {
      const rect = tab.getBoundingClientRect();
      if (rect.left < field.right - 12 && rect.right > field.right + 1) {
        return {
          x: (rect.left + field.right) / 2,
          y: rect.top + rect.height / 2,
        };
      }
    }
    return null;
  });
  expect(cut).not.toBeNull();
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.evaluate(() => {
    const store = window as unknown as {
      __samples: unknown[];
      __sampling: boolean;
    };
    store.__samples = [];
    store.__sampling = true;
    const box = (el: Element | null) => {
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return [rect.left, rect.top + window.scrollY, rect.width, rect.height];
    };
    const frame = () => {
      const bar = document.querySelector('[role="tablist"]')!;
      store.__samples.push({
        scrollY: window.scrollY,
        tabsScrollLeft: bar.scrollLeft,
        tabs: box(bar),
        panel: box(document.querySelector('[data-board-column="unstarted"]')),
      });
      if (store.__sampling) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  });
  const finger = await Finger.on(page);
  const from = await middle(boardCard(page, task));

  await finger.down(from);
  await expect(overlay(page)).toBeVisible();
  await finger.move(from, cut!);

  const target = () =>
    tablist.evaluate((bar) => {
      const targets = bar.querySelectorAll<HTMLElement>("[data-drop-target]");
      if (targets.length !== 1) return null;
      const tab = targets[0].getBoundingClientRect();
      const field = bar.getBoundingClientRect();
      return {
        text: targets[0].innerText.replace(/\s+/g, " "),
        inside: tab.left >= field.left - 0.5 && tab.right <= field.right + 0.5,
      };
    });
  await expect.poll(async () => (await target())?.inside ?? false).toBe(true);
  const marker = page.locator("[data-board-drop-marker]");
  await expect(marker).toBeVisible();
  await expect
    .poll(async () => (await marker.innerText()).replace(/\s+/g, " "))
    .toBe((await target())!.text);
  type TabsSample = {
    scrollY: number;
    tabsScrollLeft: number;
    tabs: number[];
    panel: number[] | null;
  };
  const samples = await page.evaluate(() => {
    const store = window as unknown as {
      __samples: TabsSample[];
      __sampling: boolean;
    };
    store.__sampling = false;
    return store.__samples;
  });
  await finger.up();

  await expect(overlay(page)).toHaveCount(0);
  await expect(page.locator("[data-drop-target]")).toHaveCount(0);
  await expect(marker).toHaveCount(0);
  // La carte lâchée sur l'onglet visé a changé de colonne : on la remet au ménage par son identifiant.
  await expect(inColumn(page, "unstarted", task)).toHaveCount(0);
  const first = samples[0];
  const moved = (a: number[] | null, b: number[] | null) =>
    a === null ||
    b === null ||
    a.some((value, index) => index < 3 && Math.abs(value - b[index]) > 1);
  const tabSteps = samples
    .slice(1)
    .map(
      (sample, index) => sample.tabsScrollLeft - samples[index].tabsScrollLeft,
    );
  expect(samples.length).toBeGreaterThan(10);
  expect({
    pageMoved: samples.filter((sample) => sample.scrollY !== scrollBefore)
      .length,
    tabsBack: tabSteps.filter((step) => step < -1),
    tabsJumps: tabSteps.filter((step) => step > MAX_SCROLL_STEP),
    tabsMoved: samples.filter((sample) => moved(sample.tabs, first.tabs))
      .length,
    panelMoved: samples.filter((sample) => moved(sample.panel, first.panel))
      .length,
  }).toEqual({
    pageMoved: 0,
    tabsBack: [],
    tabsJumps: [],
    tabsMoved: 0,
    panelMoved: 0,
  });
  expect(messages).toEqual([]);
});

test("@mobile D5 : un tap court ouvre le détail de la carte ; un appui de 250 ms la saisit, pas avant, sans ouvrir le détail", async ({
  page,
}) => {
  const messages = await start(page);
  // Horloge de la page pilotable, posée avant le chargement du tableau.
  await page.clock.install();
  await openBoard(page);
  const task = await make(page, "Tap");
  await chooseTab(page, "unstarted");
  const finger = await Finger.on(page);
  const from = await middle(boardCard(page, task));

  await finger.down(from);
  await finger.up();

  await expect(detailDialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task}$`));
  await expect(overlay(page)).toHaveCount(0);
  await detailDialog(page)
    .getByRole("button", { name: fr.tasks.detail.close })
    .click();
  await expect(detailDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/tasks$/);

  // Horloge arrêtée : seul `runFor` fait passer le temps de la page (minuterie du délai de dnd-kit).
  const held = await middle(boardCard(page, task));
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  await finger.down(held);
  await page.clock.runFor(249);
  const overlayBefore = await overlay(page).count();
  await page.clock.runFor(1);

  expect(overlayBefore).toBe(0);
  await expect(overlay(page)).toBeVisible();
  await finger.up();
  await page.clock.resume();
  await expect(overlay(page)).toHaveCount(0);
  await twoFrames(page);
  await expect(detailDialog(page)).toHaveCount(0);
  await expect(page).toHaveURL(/\/tasks$/);
  expect(messages).toEqual([]);
});

test("@desktop D5 et D6 : survol (main ouverte, contour, ombre, montée de 2 px sans rien décaler), clic = détail, glisser = main fermée, copie inclinée, empreinte à la place de la carte, sans ouvrir le détail", async ({
  page,
}) => {
  const messages = await start(page);
  const task = await make(page, "Survol");
  const neighbour = await make(page, "Survol voisine");
  const target = boardCard(page, task);
  const lift = target.locator("[data-board-lift]");
  const surface = () =>
    lift.evaluate((el) => {
      const style = getComputedStyle(el);
      const [, y = "0"] = style.translate.split(" ");
      return {
        shadow: style.boxShadow,
        outline: style.outlineStyle,
        outlineWidth: style.outlineWidth,
        lifted: Number.parseFloat(y) || 0,
      };
    });
  await page.mouse.move(5, 5);
  const atRest = await surface();
  const boxAtRest = await target.boundingBox();
  const neighbourAtRest = await boardCard(page, neighbour).boundingBox();
  expect(atRest).toMatchObject({ shadow: "none", outline: "none", lifted: 0 });

  await target.hover();

  await expect
    .poll(() => target.evaluate((el) => getComputedStyle(el).cursor))
    .toBe("grab");
  await expect.poll(async () => (await surface()).lifted).toBe(-2);
  const hovered = await surface();
  // `shadow-glass` : 36 px de flou sur ordinateur.
  expect(hovered.shadow).toContain("36px");
  expect(hovered.outline).toBe("solid");
  expect(hovered.outlineWidth).toBe("1px");
  expect(await target.boundingBox()).toEqual(boxAtRest);
  expect(await boardCard(page, neighbour).boundingBox()).toEqual(
    neighbourAtRest,
  );

  const from = await grabPoint(page, task);
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
  // Relâchée sur place : aucun déplacement, et le clic qui suit un glisser n'ouvre pas le détail.
  await page.mouse.move(from.x, from.y, { steps: 2 });
  await page.mouse.up();
  await expect(overlay(page)).toHaveCount(0);
  await expect(page.getByTestId("board-footprint")).toHaveCount(0);
  await twoFrames(page);
  await expect(detailDialog(page)).toHaveCount(0);

  await target.click();
  await expect(detailDialog(page)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`/tasks/${task}$`));
  expect(messages).toEqual([]);
});
