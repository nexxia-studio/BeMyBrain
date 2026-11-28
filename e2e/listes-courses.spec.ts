import { expect, test, type Page } from "@playwright/test";

import fr from "../messages/fr.json";
import { signIn } from "./session";
import { uniqueTitle } from "./todo";

// Courses, ajout rapide enchaîné (spec listes, « Ajout rapide »). Quatre articles saisis à la suite, sans
// quitter le champ : Entrée ajoute, vide et garde le focus. Jouable seulement sur une base migrée (tables
// `shopping_*`) ; le clavier d'iOS ne se vérifie que sur un iPhone.
test.use({ locale: "fr-FR" });

const created: string[] = [];

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// raccourci: nettoyage par cochage seulement — la suppression d'un article (menu de ligne, tâche 15) et « Vider les
// cochés » n'existent pas encore ; les articles de test restent, cochés et marqués par `uniqueTitle` — passer à
// la suppression dès la tâche 15.
test.afterEach(async ({ page }) => {
  const labels = created.splice(0);
  if (labels.length === 0) return;
  await page.goto("/lists/shopping");
  for (const label of labels) {
    const row = page.getByRole("checkbox", { name: label });
    if (
      (await row.count()) > 0 &&
      (await row.getAttribute("aria-checked")) === "false"
    ) {
      await row.click();
    }
  }
});

const field = (page: Page) =>
  page.getByRole("textbox", { name: fr.shopping.quickAdd.label });

test("ajout enchaîné de quatre articles, focus gardé", async ({ page }) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const input = field(page);
  await input.click();

  for (const base of ["Lait", "Pain", "Pommes", "Riz"]) {
    const label = uniqueTitle(base);
    created.push(label);
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
    await expect(input).toHaveValue("");
    await expect(input).toBeFocused();
    await expect(input).not.toHaveJSProperty("readOnly", true);
  }

  await page.reload();
  for (const label of created) {
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
  }
});

test("un champ vide n'ajoute rien", async ({ page }) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  const input = field(page);
  const before = await page.getByRole("checkbox").count();
  await input.click();
  await page.keyboard.press("Enter");
  await expect(input).toBeFocused();
  await expect(page.getByRole("checkbox")).toHaveCount(before);
});
