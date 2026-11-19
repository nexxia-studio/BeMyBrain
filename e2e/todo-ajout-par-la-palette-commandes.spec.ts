import { expect, type Page, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";
import {
  idFromHref,
  isDesktop,
  listSection,
  t,
  taskLink,
  trashTasks,
  uniqueTitle,
} from "./todo";

// Scénario 2 de la spec todo-unifiee (ajout par la palette) : Antoine ouvre la palette (⌘K sur ordinateur,
// bouton de l'en-tête sur mobile), tape « Payer la crèche », choisit « Ajouter la tâche « … » » ; la tâche
// apparaît côté actif (Privé après connexion, un seul espace : aucun filtre). Tourne dans les deux projets
// Playwright (ordinateur et mobile). L'origine `palette` n'est pas visible dans l'interface : elle est vérifiée
// par les tests du registre (runAction de la palette).
// Nom sans « palette.spec.ts » final : ce suffixe range un parcours dans le projet « langue » (config).
test.use({ locale: "fr-FR" });

const created: string[] = [];

async function openPalette(page: Page) {
  if (isDesktop(page)) {
    await page.keyboard.press("ControlOrMeta+k");
  } else {
    await page.getByRole("button", { name: fr.shell.openPalette }).click();
  }
  const palette = page.getByRole("dialog", { name: fr.palette.title });
  await expect(palette).toBeVisible();
  return palette;
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

test.afterEach(async ({ page }) => {
  await trashTasks(page, created.splice(0));
});

test("ajoute « Payer la crèche » depuis la palette, la tâche apparaît côté actif sans échéance", async ({
  page,
}) => {
  const violations = await watchCspViolations(page);
  const title = uniqueTitle("Payer la crèche");
  await signIn(page);

  const palette = await openPalette(page);
  await palette.getByRole("combobox", { name: fr.palette.search }).fill(title);
  await palette
    .getByRole("option", { name: t("palette.commands.addTask", { title }) })
    .click();

  await expect(palette).toBeHidden();
  await page.goto("/tasks");
  const row = taskLink(listSection(page, "none"), title);
  await expect(row).toBeVisible();
  created.push(idFromHref(await row.getAttribute("href")));
  await expect(
    page
      .getByRole("group", { name: fr.shell.side.label })
      .getByRole("button", { name: fr.shell.side.private }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(violations).toEqual([]);
});
