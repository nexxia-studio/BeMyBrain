import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  detailDialog,
  idFromHref,
  openQuickAdd,
  pickDueDate,
  quickAddTitle,
  submitQuickAdd,
  taskLink,
  trashTasks,
  uniqueTitle,
  userDay,
} from "./todo";

// Complément de relecture de la tâche 12 du plan todo-kanban : le badge de priorité (carré teinté de 20 px) ne
// fait pas grossir une ligne. Deux tâches identiques sauf la priorité (même titre court, même échéance) : même
// hauteur de ligne dans la liste et dans la tuile To-do du tableau de bord, et le badge tient en entier dans sa
// ligne. À 390 px (projet mobile) et à 1280 px (projet ordinateur).
// Échéance très ancienne : les deux tâches sont en tête de la tuile To-do du compte e2e partagé (5 lignes), quoi
// qu'un autre parcours y ait laissé. Elles sont mises à la corbeille à la fin. Une tâche oubliée à cette échéance
// passerait devant toutes les autres dans la tuile « Aujourd'hui » et fausserait `todo-aujourdhui.spec.ts` :
// tout reste d'un passage interrompu (titre « Hauteur … ») est mis à la corbeille avant de commencer, chaque
// identifiant est noté dès la création, et le rangement continue après un échec.
test.use({ locale: "fr-FR" });
// Deux créations, un détail, deux écrans mesurés et le rangement : au-delà des 30 s par défaut.
test.setTimeout(90_000);

const HIGH = "2";
const TITLE = "Hauteur";
const created: string[] = [];

/** Met chaque tâche à la corbeille ; un échec n'empêche pas les suivantes, il est relancé à la fin. */
async function trashEach(page: Page, ids: readonly string[]): Promise<void> {
  const failures: unknown[] = [];
  for (const id of ids) {
    try {
      await trashTasks(page, [id]);
    } catch (error) {
      failures.push(error);
    }
  }
  if (failures.length > 0) throw failures[0];
}

/** Restes d'un passage interrompu, sur le côté affiché (celui où ce parcours crée ses tâches). */
async function trashLeftovers(page: Page): Promise<void> {
  await page.goto("/tasks");
  await expect(
    page.getByRole("heading", { level: 1, name: fr.tasks.list.title }),
  ).toBeVisible();
  // Liste arrivée (plus de givre) ; le nom d'un lien de ligne est son titre suivi de sa légende.
  await page.waitForLoadState("networkidle");
  await expect(page.locator('main[aria-busy="true"]')).toHaveCount(0);
  const hrefs = await page
    .getByRole("link", { name: new RegExp(`^${TITLE} [0-9a-z]+`) })
    .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
  await trashEach(page, hrefs.map(idFromHref));
}

/** Crée une tâche par l'ajout rapide ; son identifiant est noté avant la fermeture de la fenêtre. */
async function addTask(
  page: Page,
  title: string,
  date: string,
): Promise<string> {
  const dialog = await openQuickAdd(page);
  await quickAddTitle(dialog).fill(title);
  await pickDueDate(page, dialog, date);
  const id = await submitQuickAdd(dialog);
  created.push(id);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  return id;
}

test.afterEach(async ({ page }) => {
  await trashEach(page, created.splice(0));
});

function row(scope: Page | Locator, title: string): Locator {
  return taskLink(scope, title).locator("xpath=ancestor::li[1]");
}

async function heightOf(locator: Locator): Promise<number> {
  await expect(locator).toBeVisible();
  return (await locator.boundingBox())!.height;
}

/** Le badge de priorité de la ligne tient en entier dans la boîte de la ligne (pas rogné, pas débordant). */
async function expectBadgeInside(line: Locator): Promise<void> {
  const badge = line
    .getByText(fr.tasks.list.priority[HIGH], { exact: true })
    .locator("..");
  await expect(badge).toBeVisible();
  const inner = (await badge.boundingBox())!;
  const outer = (await line.boundingBox())!;

  expect(inner.width).toBe(20);
  expect(inner.height).toBe(20);
  expect(inner.x).toBeGreaterThanOrEqual(outer.x);
  expect(inner.y).toBeGreaterThanOrEqual(outer.y);
  expect(inner.x + inner.width).toBeLessThanOrEqual(outer.x + outer.width);
  expect(inner.y + inner.height).toBeLessThanOrEqual(outer.y + outer.height);
}

async function compareRows(page: Page): Promise<void> {
  await signIn(page);
  await trashLeftovers(page);
  const due = userDay(-400);
  const plain = uniqueTitle(TITLE);
  const prioritized = uniqueTitle(TITLE);
  await addTask(page, plain, due);
  const id = await addTask(page, prioritized, due);
  await page.goto(`/tasks/${id}`);
  const detail = detailDialog(page);
  const label = fr.tasks.detail.priority.label;
  await detail
    .getByRole("button", { name: new RegExp(`^${label} : `) })
    .click();
  await page
    .getByRole("menuitemradio", { name: fr.tasks.detail.priority[HIGH] })
    .click();
  await expect(
    detail.getByRole("button", {
      name: `${label} : ${fr.tasks.detail.priority[HIGH]}`,
    }),
  ).toBeVisible();

  await page.goto("/tasks");

  expect(await heightOf(row(page, prioritized))).toBe(
    await heightOf(row(page, plain)),
  );
  await expectBadgeInside(row(page, prioritized));

  await page.goto("/dashboard");
  const tile = page
    .getByTestId("tile-privateTodo")
    .getByRole("list", { name: fr.dashboard.tiles.upcoming });

  expect(await heightOf(row(tile, prioritized))).toBe(
    await heightOf(row(tile, plain)),
  );
  await expectBadgeInside(row(tile, prioritized));
}

test.describe("à 390 px", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("@mobile une ligne avec priorité a la hauteur d'une ligne sans priorité, dans la liste et dans la tuile To-do, badge entier", async ({
    page,
  }) => {
    await compareRows(page);
  });
});

test.describe("à 1280 px", () => {
  test.use({ viewport: { width: 1280, height: 900 } });

  test("@desktop une ligne avec priorité a la hauteur d'une ligne sans priorité, dans la liste et dans la tuile To-do, badge entier", async ({
    page,
  }) => {
    await compareRows(page);
  });
});
