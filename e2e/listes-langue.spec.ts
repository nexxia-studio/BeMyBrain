import { expect, test } from "@playwright/test";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { signIn } from "./session";
import { uniqueTitle } from "./todo";

// Scénario 11 de la spec listes (langue), partie Courses : en anglais, les rayons, le champ d'ajout et les
// boutons de l'écran Courses suivent ; l'article saisi reste tel quel. Change la langue du compte e2e partagé :
// projet Playwright « langue » (seul, en série, à 1440 px), compte remis en français à la fin. Jouable seulement
// sur une base migrée (tables `shopping_*`) ; la page invitée et la Wishlist s'ajoutent avec leurs PR.
test.use({ locale: "fr-FR", viewport: { width: 1440, height: 900 } });
test.setTimeout(90_000);

const created: string[] = [];

test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await signIn(page);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: fr.settings.language.fr })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await page.goto("/lists/shopping");
  for (const label of created.splice(0)) {
    const rows = page.getByRole("checkbox", { name: label, exact: true });
    while ((await rows.count()) > 0) {
      const before = await rows.count();
      await page
        .getByRole("button", {
          name: fr.shopping.itemMenu.trigger.replace("{label}", label),
        })
        .first()
        .click();
      await page
        .getByRole("menuitem", { name: fr.shopping.itemMenu.remove })
        .click();
      await expect(rows).toHaveCount(before - 1);
    }
  }
  await expect(page.getByTestId("removed-toast")).toBeHidden({
    timeout: 10_000,
  });
});

test("en anglais, l'écran Courses est en anglais, l'article saisi reste tel quel", async ({
  page,
}) => {
  await signIn(page);
  const label = uniqueTitle("Lait");
  created.push(label);
  await page.goto("/lists/shopping");
  await page.getByRole("textbox", { name: fr.shopping.quickAdd.label }).click();
  await page.keyboard.type(label);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("checkbox", { name: label, exact: true }),
  ).toBeVisible();

  await page.goto("/settings");
  await page
    .getByRole("button", { name: fr.settings.language.en })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.goto("/lists/shopping");
  await expect(
    page.getByRole("heading", { level: 1, name: en.shopping.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: en.shopping.quickAdd.label }),
  ).toBeVisible();
  // Le rayon du lait (Dairy and eggs) porte son nom anglais ; le libellé saisi n'est pas traduit.
  await expect(
    page.getByRole("region", { name: en.shopping.aisles.dairyEggs }),
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: label, exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("region", { name: fr.shopping.aisles.dairyEggs }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", {
      name: en.shopping.itemMenu.trigger.replace("{label}", label),
    }),
  ).toBeVisible();
});
