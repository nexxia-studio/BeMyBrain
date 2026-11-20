import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  filterContext,
  detailDialog,
  openQuickAdd,
  quickAddTask,
  quickAddTitle,
  submitQuickAdd,
  switchSide,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 1 de la spec todo-unifiee (ajout rapide sur mobile) : sur le tableau de bord en 390 px côté Pro,
// Antoine touche le « + » central, tape « Relancer le devis », choisit Trustup, le tag « client » et demain,
// valide ; le formulaire se vide pour la suivante, la tâche est dans la liste Pro filtrée Trustup.
// Projet Playwright « mobile » seulement (tag @mobile, exclu du projet ordinateur) : Chromium avec l'émulation
// iPhone en local (WebKit refuse les cookies __Secure- sur http://localhost), WebKit contre une preview HTTPS.
// Limite : Playwright ne simule pas le clavier virtuel d'iOS (tiroir remonté au-dessus du clavier,
// `useKeyboardInset`) ; ce point est vérifié par Antoine sur un vrai iPhone (plan, tâche 18).
test.use({ locale: "fr-FR" });

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("@mobile ajoute « Relancer le devis » avec espace, tag et demain, puis la retrouve dans la liste Pro filtrée Trustup", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const title = uniqueTitle("Relancer le devis");
  await signIn(page);
  await switchSide(page, "pro");

  const dialog = await openQuickAdd(page);
  const titleField = quickAddTitle(dialog);
  await expect(titleField).toBeFocused();
  await titleField.fill(title);
  await dialog.getByRole("button", { name: /^Espace : / }).click();
  await page.getByRole("menuitemradio", { name: "Trustup" }).click();
  await dialog.getByRole("button", { name: /^Tags : / }).click();
  const tagSearch = page.getByLabel(fr.tasks.quickAdd.tags.search);
  await tagSearch.fill("client");
  await tagSearch.press("Enter");
  await page.keyboard.press("Escape");
  await dialog.getByRole("button", { name: /^Date : / }).click();
  await page
    .getByRole("button", {
      name: new RegExp(`^${fr.tasks.quickAdd.date.tomorrow}`),
    })
    .click();
  await expect(
    dialog.getByRole("button", { name: /^Espace : Trustup$/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: /^Tags : client$/i }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: `Date : ${fr.tasks.quickAdd.date.tomorrow}`,
    }),
  ).toBeVisible();
  created.push(await submitQuickAdd(dialog));

  // Prêt pour la suivante : titre, date et tags vidés, espace gardé, focus rendu au titre.
  await expect(titleField).toHaveValue("");
  await expect(titleField).toBeFocused();
  await expect(
    dialog.getByRole("button", { name: /^Espace : Trustup$/ }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: `Date : ${fr.tasks.quickAdd.date.none}`,
    }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", {
      name: `Tags : ${fr.tasks.quickAdd.tags.none}`,
    }),
  ).toBeVisible();

  await page.keyboard.press("Escape");
  await page.goto("/tasks");
  await filterContext(page, "Trustup");
  const row = taskLink(page, title);
  await expect(row).toBeVisible();
  await expect(
    page.getByRole("region", { name: fr.tasks.list.sections.tomorrow }),
  ).toContainText(title);
  await expect(row).toContainText("client");
  expect(violations).toEqual([]);
});

test("@mobile les popups Espace, Date et Tags restent à 16 px des bords de l'écran", async ({
  page,
}) => {
  await signIn(page);
  const dialog = await openQuickAdd(page);
  const width = page.viewportSize()!.width;

  for (const name of [/^Espace : /, /^Date : /, /^Tags : /]) {
    await dialog.getByRole("button", { name }).click();
    const popup = page.locator("[data-side][data-open]").last();
    await expect(popup).toBeVisible();
    const box = (await popup.boundingBox())!;

    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 16 + 0.5);
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  }
});

test("@mobile les menus Statut, Priorité et Côté du détail restent à 16 px des bords de l'écran", async ({
  page,
}) => {
  await signIn(page);
  const id = await quickAddTask(page, uniqueTitle("Bords du détail"));
  created.push(id);
  await page.goto(`/tasks/${id}`);
  const detail = detailDialog(page);
  await expect(detail).toBeVisible();
  const width = page.viewportSize()!.width;

  for (const field of [
    fr.tasks.detail.status.label,
    fr.tasks.detail.priority.label,
    fr.tasks.detail.side,
  ]) {
    await detail
      .getByRole("button", { name: new RegExp(`^${field} : `) })
      .click();
    const popup = page.locator("[data-side][data-open]").last();
    await expect(popup).toBeVisible();
    const box = (await popup.boundingBox())!;

    expect(box.x).toBeGreaterThanOrEqual(16);
    expect(box.x + box.width).toBeLessThanOrEqual(width - 16 + 0.5);
    await page.keyboard.press("Escape");
    await expect(popup).toBeHidden();
  }
});
