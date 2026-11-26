import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import {
  detailDialog,
  quickAddTask,
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
// qu'un autre parcours y ait laissé. Elles sont mises à la corbeille à la fin.
test.use({ locale: "fr-FR" });
// Deux créations, un détail, deux écrans mesurés et le rangement : au-delà des 30 s par défaut.
test.setTimeout(90_000);

const HIGH = "2";
const created: string[] = [];

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
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
  const due = { date: userDay(-400) };
  const plain = uniqueTitle("Hauteur");
  const prioritized = uniqueTitle("Hauteur");
  created.push(await quickAddTask(page, plain, due));
  const id = await quickAddTask(page, prioritized, due);
  created.push(id);
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
