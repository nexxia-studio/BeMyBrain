import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  detailDialog,
  listSection,
  quickAddTask,
  t,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 3 de la spec todo-unifiee (titre seul) : Antoine crée « Acheter des ampoules » sans rien choisir
// d'autre ; la tâche est créée côté actif (Privé après connexion), catégorie À faire, sans échéance. Tourne dans
// les deux projets Playwright (ordinateur : bouton rond de l'en-tête ; mobile : « + » central).
test.use({ locale: "fr-FR" });

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("une tâche créée avec un titre seul est côté actif, À faire, sans échéance", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const title = uniqueTitle("Acheter des ampoules");
  await signIn(page);

  created.push(await quickAddTask(page, title));

  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), title).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: t("tasks.detail.menuLabel", {
        field: fr.tasks.detail.status.label,
        current: fr.tasks.detail.status.unstarted,
      }),
    }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: t("tasks.detail.menuLabel", {
        field: fr.tasks.detail.side,
        current: fr.shell.side.private,
      }),
    }),
  ).toBeVisible();
  await expect(
    detail.getByRole("button", {
      name: t("tasks.quickAdd.date.menuLabel", {
        current: fr.tasks.quickAdd.date.none,
      }),
    }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

// Constat QA du 2026-11-20 : « mwo3x0 » affiché « mwo3×0 » (alternatives contextuelles d'Inter). Le texte saisi
// s'affiche tel quel : calt coupé dans la liste, le champ d'ajout rapide et le champ titre du détail.
test("un titre contenant « 3x0 » n'est pas transformé par la police", async ({
  page,
}) => {
  const title = uniqueTitle("Lot 3x0");
  await signIn(page);

  created.push(await quickAddTask(page, title));

  await page.goto("/tasks");
  const link = taskLink(listSection(page, "none"), title);
  await expect(link).toBeVisible();
  const ligatures = (locator: typeof link) =>
    locator.evaluate((el) => getComputedStyle(el).fontVariantLigatures);
  expect(await ligatures(link)).toBe("no-contextual");

  await link.click();
  const detail = detailDialog(page);
  const field = detail.getByLabel(fr.tasks.detail.title, { exact: true });
  await expect(field).toHaveValue(title);
  expect(await ligatures(field)).toBe("no-contextual");
});
