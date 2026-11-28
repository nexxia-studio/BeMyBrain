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

// Scénario 3 : régler l'ordre du magasin. « Surgelés » glissé en tête par sa poignée, ordre gardé après un
// rechargement. Souris ici ; l'appui long au doigt (250 ms) ne se vérifie que sur un iPhone.
// raccourci: l'ordre des rayons est une préférence de l'utilisateur de test, non remise à l'état d'avant — elle
// ne gêne aucun autre scénario (seul l'ordre d'affichage change).
const aisleHeadings = (page: Page) => page.locator("h2[id^='shopping-aisle-']");
const aisleHandle = (page: Page, key: keyof typeof fr.shopping.aisles) =>
  page.getByRole("button", {
    name: fr.shopping.aisleSort.handle.replace(
      "{aisle}",
      fr.shopping.aisles[key],
    ),
  });

async function dragHandle(
  page: Page,
  key: keyof typeof fr.shopping.aisles,
  toward: "top" | "bottom",
) {
  const handleBox = await aisleHandle(page, key).boundingBox();
  const headings = aisleHeadings(page);
  const edge = await (toward === "top"
    ? headings.first()
    : headings.last()
  ).boundingBox();
  if (!handleBox || !edge) throw new Error("rayon introuvable à l'écran");
  const startX = handleBox.x + handleBox.width / 2;
  const startY = handleBox.y + handleBox.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  // Plus de 4 px d'abord : le capteur souris s'active, puis le rayon suit jusqu'au bord visé.
  await page.mouse.move(startX, startY + (toward === "top" ? -8 : 8), {
    steps: 4,
  });
  await page.mouse.move(startX, toward === "top" ? edge.y - 10 : edge.y + 40, {
    steps: 12,
  });
  await page.mouse.up();
}

test("l'ordre des rayons glissé est gardé après rechargement", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/lists/shopping");
  for (const base of ["Pommes", "Pizza surgelée"]) {
    const label = uniqueTitle(base);
    created.push(label);
    await field(page).click();
    await page.keyboard.type(label);
    await page.keyboard.press("Enter");
    await expect(page.getByRole("checkbox", { name: label })).toBeVisible();
  }
  const frozen = fr.shopping.aisles.frozen;
  const names = async () => aisleHeadings(page).allTextContents();

  // Départ propre : « Surgelés » n'est pas déjà en tête (essai précédent).
  if ((await names())[0] === frozen) {
    await dragHandle(page, "frozen", "bottom");
    await expect.poll(async () => (await names())[0]).not.toBe(frozen);
  }

  await dragHandle(page, "frozen", "top");
  await expect.poll(async () => (await names())[0]).toBe(frozen);

  await page.reload();
  expect((await names())[0]).toBe(frozen);
});
