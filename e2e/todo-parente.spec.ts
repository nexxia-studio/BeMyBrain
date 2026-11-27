import { expect, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  detailDialog,
  listSection,
  quickAddTask,
  switchSide,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 8 de la spec todo-kanban (transformer en sous-tâche), sans l'espace : choisir une parente dans la
// liste de sélection du détail, voir son lien et « Détacher » (une seule mention de la parente), changer de
// parente, refus d'une tâche qui a des sous-tâches (propriété désactivée avec sa raison). La liste ne montre
// jamais une tâche de l'autre côté. Tourne dans les deux projets. L'espace hérité de la parente est prouvé par
// les tests du module (`mutations-parent.test.ts`) : le compte e2e partagé n'a pas d'espace dédié à ce parcours.
test.use({ locale: "fr-FR" });
test.setTimeout(90_000);

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

const propertyField = (page: Page) =>
  detailDialog(page).getByRole("button", {
    name: `${fr.tasks.detail.parentField.label} : ${fr.tasks.detail.parentField.none}`,
  });

test("scénario 8 : rattacher, une seule mention, détacher, changer ; l'autre côté n'est pas proposé", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const child = uniqueTitle("Écrire la proposition");
  const first = uniqueTitle("Dossier Nexxia");
  const second = uniqueTitle("Dossier Trustup");
  const privateTitle = uniqueTitle("Dossier perso");
  await signIn(page);
  await page.goto("/tasks");
  await switchSide(page, "private");
  created.push(await quickAddTask(page, privateTitle));
  await switchSide(page, "pro");
  created.push(await quickAddTask(page, child));
  created.push(await quickAddTask(page, first));
  created.push(await quickAddTask(page, second));
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), child).click();
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();

  await propertyField(page).click();

  const search = detail.getByRole("combobox", {
    name: fr.tasks.picker.label,
  });
  await expect(search).toBeFocused();
  await search.fill("Dossier");
  await expect(detail.getByRole("option", { name: first })).toBeVisible();
  await expect(detail.getByRole("option", { name: second })).toBeVisible();
  await expect(detail.getByRole("option", { name: privateTitle })).toHaveCount(
    0,
  );
  await expect(detail.getByRole("option", { name: child })).toHaveCount(0);

  await detail.getByRole("option", { name: first }).click();

  // Une seule mention : le lien de la propriété, aucune ligne « Côté et espace » (elle suit la parente).
  const parentLink = detail.getByRole("link", { name: new RegExp(first) });
  await expect(parentLink).toHaveCount(1);
  await expect(
    detail.getByText(fr.tasks.detail.parentField.followsParent),
  ).toBeVisible();
  await expect(
    detail.getByText(fr.tasks.detail.placement, { exact: true }),
  ).toHaveCount(0);

  await detail
    .getByRole("button", {
      name: fr.tasks.detail.parentField.change,
      exact: true,
    })
    .click();
  const again = detail.getByRole("combobox", { name: fr.tasks.picker.label });
  await again.fill(second);
  await expect(detail.getByRole("option", { name: first })).toHaveCount(0);
  await detail.getByRole("option", { name: second }).click();
  await expect(
    detail.getByRole("link", { name: new RegExp(second) }),
  ).toHaveCount(1);
  await expect(
    detail.getByRole("link", { name: new RegExp(first) }),
  ).toHaveCount(0);

  await detail
    .getByRole("button", {
      name: fr.tasks.detail.parentField.detach,
      exact: true,
    })
    .click();

  await expect(propertyField(page)).toBeVisible();
  await expect(
    detail.getByText(fr.tasks.detail.placement, { exact: true }),
  ).toBeVisible();
  expect(violations).toEqual([]);
});

test("une tâche qui a des sous-tâches : propriété désactivée avec sa raison", async ({
  page,
}) => {
  const parent = uniqueTitle("Préparer l'atelier");
  const sub = uniqueTitle("Réserver la salle");
  await signIn(page);
  created.push(await quickAddTask(page, parent));
  await page.goto("/tasks");
  await taskLink(listSection(page, "none"), parent).click();
  const detail = detailDialog(page);
  const field = detail.getByLabel(fr.tasks.detail.subtasks.add);
  await field.fill(sub);
  await field.press("Enter");
  await expect(taskLink(detail, sub)).toBeVisible();
  created.push(
    (await taskLink(detail, sub).getAttribute("href"))!
      .split("/")
      .pop()!
      .split("?")[0],
  );

  await expect(
    detail.getByText(fr.tasks.detail.parentField.hasSubtasks),
  ).toBeVisible();
  await expect(propertyField(page)).toHaveCount(0);
});
