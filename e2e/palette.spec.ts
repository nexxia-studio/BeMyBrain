import { devices, expect, type Page, test } from "@playwright/test";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";

// Scénario 6 de la spec socle (palette de commandes, ADR-009) : Antoine ouvre la palette (⌘K sur
// ordinateur, bouton d'ajout de la barre basse sur mobile), cherche « langue », lance le passage en
// anglais : l'interface passe en anglais, URL inchangée. Modifie la langue du compte e2e partagé : tourne
// dans le projet Playwright « langue » (seul, en série, après les autres) et remet le compte en français.
test.use({ locale: "fr-FR" });

async function switchToEnglishFromPalette(
  page: Page,
  open: (page: Page) => Promise<void>,
) {
  const violations = await watchCspViolations(page);
  await signIn(page);

  await open(page);
  const palette = page.getByRole("dialog", { name: fr.palette.title });
  await expect(palette).toBeVisible();
  await palette
    .getByRole("combobox", { name: fr.palette.search })
    .fill("langue");
  await palette
    .getByRole("option", { name: fr.palette.commands.switchLocale.en })
    .click();

  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(
    page.getByRole("heading", { level: 1, name: en.dashboard.title }),
  ).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: en.palette.title }),
  ).toBeHidden();
  expect(violations).toEqual([]);
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Remet le compte de test en français, même après un échec : les autres parcours l'attendent.
test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await signIn(page);
  await page.goto("/settings");
  await page
    .getByRole("button", { name: fr.settings.language.fr })
    .first()
    .click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test.describe("ordinateur (1440 px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("depuis la palette (⌘K), passer en anglais change la langue de l'interface", async ({
    page,
  }) => {
    await switchToEnglishFromPalette(page, async (p) => {
      await p.keyboard.press("ControlOrMeta+k");
    });
  });
});

// Même émulation que changer-de-langue.spec.ts : Chromium avec l'iPhone (WebKit refuse les cookies
// __Secure- sur http://localhost).
const iphone = devices["iPhone 15"];

test.describe("mobile (390 px)", () => {
  test.use({
    userAgent: iphone.userAgent,
    deviceScaleFactor: iphone.deviceScaleFactor,
    isMobile: iphone.isMobile,
    hasTouch: iphone.hasTouch,
    viewport: { width: 390, height: 844 },
  });

  test("depuis la palette (bouton de la barre basse), passer en anglais change la langue de l'interface", async ({
    page,
  }) => {
    await switchToEnglishFromPalette(page, async (p) => {
      await p
        .getByRole("navigation", { name: fr.shell.navigation })
        .getByRole("button", { name: fr.shell.openPalette })
        .click();
    });
  });
});
