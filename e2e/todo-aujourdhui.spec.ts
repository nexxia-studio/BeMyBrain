import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  completeBox,
  listSection,
  quickAddTask,
  switchSide,
  taskLink,
  trashTasks,
  uniqueTitle,
  userDay,
} from "./todo";

// Scénario 4 de la spec todo-unifiee (Aujourd'hui) : avec une tâche Privé due hier, une Pro due aujourd'hui à
// 14:00 et une due demain, la tuile « Aujourd'hui » montre les deux premières, côté visible, et pas la
// troisième ; cocher celle de 14:00 depuis la liste la retire de la tuile. Tourne dans les deux projets.
// Le compte e2e est partagé : les compteurs sont lus avant le parcours et comparés en écart, pas en absolu.
// Limite : la tuile ne montre que 3 tâches ; des tâches dues laissées par un parcours interrompu (avant hier)
// passeraient devant celles du parcours. Chaque parcours de la to-do met ses tâches à la corbeille à la fin.
test.use({ locale: "fr-FR" });

const created: string[] = [];

function todayTile(page: Page): Locator {
  return page.getByTestId("tile-today");
}

/** Compteurs « En retard » et « Aujourd'hui » de la tuile (absents quand rien n'est dû : 0). */
async function dueCounts(page: Page) {
  const tile = todayTile(page);
  await expect(tile).toBeVisible();
  const read = async (testId: string) => {
    const counter = tile.getByTestId(testId);
    return (await counter.count()) === 0
      ? 0
      : Number(await counter.textContent());
  };
  return {
    overdue: await read("today-overdue-count"),
    today: await read("today-due-count"),
  };
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("la tuile Aujourd'hui montre la tâche en retard et celle du jour, pas celle de demain, et perd celle cochée", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const overdue = uniqueTitle("Renouveler la carte d'identité");
  const dueToday = uniqueTitle("Appeler le comptable");
  const dueTomorrow = uniqueTitle("Préparer la démo");
  await signIn(page);
  const before = await dueCounts(page);
  created.push(await quickAddTask(page, overdue, { date: userDay(-1) }));
  await switchSide(page, "pro");
  created.push(
    await quickAddTask(page, dueToday, { date: userDay(0), time: "14:00" }),
  );
  created.push(await quickAddTask(page, dueTomorrow, { date: userDay(1) }));

  await page.goto("/dashboard");
  const tileList = todayTile(page).getByRole("list", {
    name: fr.dashboard.today.list,
  });
  await expect(taskLink(tileList, overdue)).toContainText(
    fr.shell.side.private,
  );
  await expect(taskLink(tileList, dueToday)).toContainText(fr.shell.side.pro);
  await expect(taskLink(tileList, dueToday)).toContainText("14:00");
  await expect(taskLink(tileList, dueTomorrow)).toHaveCount(0);
  expect(await dueCounts(page)).toEqual({
    overdue: before.overdue + 1,
    today: before.today + 1,
  });

  await page.goto("/tasks");
  await completeBox(listSection(page, "today"), dueToday).click();
  await expect(taskLink(page, dueToday)).toHaveCount(0);
  await page.goto("/dashboard");

  await expect(taskLink(tileList, overdue)).toBeVisible();
  await expect(taskLink(tileList, dueToday)).toHaveCount(0);
  expect(await dueCounts(page)).toEqual({
    overdue: before.overdue + 1,
    today: before.today,
  });
  expect(violations).toEqual([]);
});
