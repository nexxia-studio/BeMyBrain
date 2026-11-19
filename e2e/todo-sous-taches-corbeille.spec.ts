import { expect, type Locator, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  detailDialog,
  idFromHref,
  listSection,
  quickAddTask,
  t,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 5 de la spec todo-unifiee (sous-tâches et corbeille) : Antoine ajoute deux sous-tâches à une tâche,
// met une sous-tâche seule à la corbeille, puis la parente. La corbeille montre la parente et la sous-tâche
// isolée ; restaurer la parente la ramène avec une sous-tâche, l'autre reste à la corbeille. Tourne dans les
// deux projets (panneau latéral sur ordinateur, tiroir sur mobile). La corbeille du compte e2e est partagée :
// chaque ligne est cherchée par son titre unique.
test.use({ locale: "fr-FR" });
// Parcours long (deux détails, corbeille, restauration) plus le rangement de fin : au-delà des 30 s par défaut.
test.setTimeout(90_000);

const created: string[] = [];

/** Ouvre le détail d'une tâche depuis la liste (route interceptée, par-dessus la liste). */
async function openFromList(page: Page, title: string): Promise<Locator> {
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), title).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();
  return detail;
}

async function addSubtask(detail: Locator, title: string): Promise<string> {
  const field = detail.getByLabel(fr.tasks.detail.subtasks.add);
  await field.fill(title);
  await field.press("Enter");
  await expect(field).toHaveValue("");
  const link = taskLink(detail, title);
  await expect(link).toBeVisible();
  return idFromHref(await link.getAttribute("href"));
}

async function trashFromDetail(page: Page, detail: Locator) {
  await detail
    .getByRole("button", { name: fr.tasks.detail.trash, exact: true })
    .click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText(fr.tasks.detail.trashed)).toBeVisible();
}

/** Ligne de la corbeille qui contient `text` (titre unique, légende). */
function trashRow(page: Page, ...texts: string[]): Locator {
  return texts.reduce(
    (row, text) => row.filter({ hasText: text }),
    page.getByRole("listitem"),
  );
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("restaurer la parente la ramène avec la sous-tâche mise avec elle, pas celle mise à la corbeille avant", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const parent = uniqueTitle("Préparer le déménagement");
  const isolated = uniqueTitle("Résilier internet");
  const kept = uniqueTitle("Commander des cartons");
  await signIn(page);
  created.push(await quickAddTask(page, parent));

  let detail = await openFromList(page, parent);
  created.push(await addSubtask(detail, isolated));
  created.push(await addSubtask(detail, kept));
  await taskLink(detail, isolated).click();
  await expect(
    detail.getByRole("link", { name: new RegExp(fr.tasks.detail.parent) }),
  ).toContainText(parent);
  await trashFromDetail(page, detail);
  detail = await openFromList(page, parent);
  await expect(taskLink(detail, isolated)).toHaveCount(0);
  await trashFromDetail(page, detail);

  await page.goto("/trash");
  const parentRow = trashRow(
    page,
    parent,
    t("tasks.trash.subtasks", { count: 1 }),
  );
  await expect(parentRow).toHaveCount(1);
  await expect(trashRow(page, isolated)).toHaveCount(1);
  await expect(trashRow(page, kept)).toHaveCount(0);

  await parentRow
    .getByRole("button", { name: fr.trash.restore, exact: true })
    .click();

  await expect(parentRow).toHaveCount(0);
  await expect(trashRow(page, isolated)).toHaveCount(1);
  detail = await openFromList(page, parent);
  await expect(taskLink(detail, kept)).toBeVisible();
  await expect(taskLink(detail, isolated)).toHaveCount(0);
  expect(violations).toEqual([]);
});
