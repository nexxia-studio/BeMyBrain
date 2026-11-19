import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  completeBox,
  filterContext,
  listSection,
  quickAddTask,
  switchSide,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 6 de la spec todo-unifiee (filtres) : Antoine bascule Privé / Pro et choisit un espace ; la liste ne
// montre que les tâches correspondantes ; l'interrupteur « Terminées » fait apparaître les tâches cochées.
// Espaces du compte e2e (branche dev) : Privé seul côté Privé, Trustup et Nexxia côté Pro. Tourne dans les deux
// projets (filtre dans la barre latérale sur ordinateur, pastille de l'en-tête de page sur mobile). Les tâches
// du parcours sont créées depuis la liste : l'ajout rapide reprend le côté et l'espace filtrés.
test.use({ locale: "fr-FR" });
// Quatre ajouts, cinq changements de filtre et le rangement de fin : au-delà des 30 s par défaut.
test.setTimeout(90_000);

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("la liste suit le côté et l'espace filtrés, et montre les terminées seulement avec l'interrupteur", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const home = uniqueTitle("Arroser les plantes");
  const trustup = uniqueTitle("Relancer Trustup");
  const trustupDone = uniqueTitle("Envoyer la facture Trustup");
  const nexxia = uniqueTitle("Maquette Nexxia");
  await signIn(page);
  await page.goto("/tasks");
  created.push(await quickAddTask(page, home));
  await switchSide(page, "pro");
  await filterContext(page, "Trustup");
  created.push(await quickAddTask(page, trustup));
  created.push(await quickAddTask(page, trustupDone));
  await filterContext(page, "Nexxia");
  created.push(await quickAddTask(page, nexxia));

  // Pro, Nexxia.
  await expect(taskLink(page, nexxia)).toBeVisible();
  await expect(taskLink(page, trustup)).toHaveCount(0);
  await expect(taskLink(page, home)).toHaveCount(0);

  // Pro, Trustup ; une tâche cochée quitte la liste, l'interrupteur la fait revenir.
  await filterContext(page, "Trustup");
  await expect(taskLink(page, trustup)).toBeVisible();
  await expect(taskLink(page, nexxia)).toHaveCount(0);
  await completeBox(listSection(page, "none"), trustupDone).click();
  await expect(taskLink(page, trustupDone)).toHaveCount(0);
  const completedSwitch = page.getByRole("switch", {
    name: fr.tasks.list.completedToggle,
  });
  await completedSwitch.click();
  await expect(completedSwitch).toHaveAttribute("aria-checked", "true");
  await expect(
    taskLink(listSection(page, "completed"), trustupDone),
  ).toBeVisible();
  await expect(taskLink(page, trustup)).toBeVisible();
  await completedSwitch.click();
  await expect(completedSwitch).toHaveAttribute("aria-checked", "false");
  await expect(taskLink(page, trustupDone)).toHaveCount(0);

  // Privé.
  await switchSide(page, "private");
  await expect(taskLink(page, home)).toBeVisible();
  await expect(taskLink(page, trustup)).toHaveCount(0);
  await expect(taskLink(page, nexxia)).toHaveCount(0);
  expect(violations).toEqual([]);
});
