import { expect, type Page, test } from "@playwright/test";

import en from "../messages/en.json";
import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";
import { signIn } from "./session";

// Scénario 4 de la spec socle (changer de langue) : Antoine ouvre ses réglages, passe en anglais, recharge,
// se reconnecte : l'anglais est conservé (langue enregistrée par appartenance, ADR-007), URL inchangée.
// La reconnexion se fait depuis un navigateur sans cookie (autre appareil, navigateur en français) : la
// langue vient de la base, pas du cookie NEXT_LOCALE. Le compte de test est remis en français à la fin.
test.use({ locale: "fr-FR" });

const SETTINGS_PATH = "/settings";

/** Date du jour telle que la tuile « Aujourd'hui » l'écrit (fuseau de src/i18n/config.ts). */
function todayIn(locale: "fr" | "en"): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Brussels",
  }).format(new Date());
}

function language(page: Page, messages: typeof fr) {
  return page.getByRole("group", { name: messages.settings.language.title });
}

/** Ouvre les réglages par la navigation (barre latérale ou barre d'onglets, selon la largeur). */
async function openSettings(page: Page, messages: typeof fr) {
  await page
    .getByRole("navigation", { name: messages.shell.navigation })
    .getByRole("link", { name: messages.shell.settings })
    .click();
  await expect(page).toHaveURL(new RegExp(`${SETTINGS_PATH}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: messages.settings.title }),
  ).toBeVisible();
}

/** Choisit l'anglais depuis l'interface en français ; le groupe se renomme dans la nouvelle langue. */
async function chooseEnglish(page: Page) {
  await language(page, fr)
    .getByRole("button", { name: fr.settings.language.en })
    .click();
  await expect(
    language(page, en).getByRole("button", { name: en.settings.language.en }),
  ).toHaveAttribute("aria-pressed", "true");
}

async function expectEnglishDashboard(page: Page) {
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: en.dashboard.title }),
  ).toBeVisible();
  await expect(page.getByTestId("today-date")).toHaveText(todayIn("en"));
}

async function switchToEnglishThenSignInAgain(page: Page) {
  const violations = await watchCspViolations(page);
  await signIn(page);
  await expect(page.getByTestId("today-date")).toHaveText(todayIn("fr"));
  await openSettings(page, fr);

  await chooseEnglish(page);

  // Toute l'interface passe en anglais, sans changer d'URL.
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page).toHaveURL(new RegExp(`${SETTINGS_PATH}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: en.settings.title }),
  ).toBeVisible();

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(
    page.getByRole("heading", { level: 1, name: en.settings.title }),
  ).toBeVisible();

  // Reconnexion : déconnexion, puis connexion depuis un navigateur sans cookie.
  await page.getByRole("button", { name: en.auth.signOut }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.context().clearCookies();
  await signIn(page);
  await expectEnglishDashboard(page);
  expect(violations).toEqual([]);
}

test.beforeEach(async ({ context }) => {
  await context.clearCookies();
});

// Remet le compte de test en français, même après un échec : les autres parcours l'attendent.
test.afterEach(async ({ page, context }) => {
  await context.clearCookies();
  await signIn(page);
  await page.goto(SETTINGS_PATH);
  const french = page
    .getByRole("button", { name: fr.settings.language.fr })
    .first();
  await french.click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
});

test.describe("ordinateur (1440 px)", () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test("passe en anglais dans les réglages, recharge et se reconnecte : l'anglais est conservé", async ({
    page,
  }) => {
    await switchToEnglishThenSignInAgain(page);
  });
});

test.describe("mobile (390 px)", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("passe en anglais par l'onglet Réglages, se déconnecte depuis les réglages et se reconnecte : l'anglais est conservé", async ({
    page,
  }) => {
    await switchToEnglishThenSignInAgain(page);
  });
});
