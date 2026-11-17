import { expect, test } from "@playwright/test";

import fr from "../messages/fr.json";
import { watchCspViolations } from "./csp";

// Scénario 3 de la spec socle : desktop seulement (le projet mobile exclut le tag @desktop).
test.use({ locale: "fr-FR" });

test(
  "un visiteur non connecté qui ouvre /dashboard voit l'écran de connexion et rien d'autre",
  { tag: "@desktop" },
  async ({ page, context }) => {
    await context.clearCookies();
    const violations = await watchCspViolations(page);

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/login$/);
    await expect(
      page.getByRole("heading", { level: 1, name: fr.auth.login.title }),
    ).toBeVisible();
    await expect(page.getByLabel(fr.auth.login.email)).toBeVisible();
    await expect(page.getByLabel(fr.auth.login.password)).toBeVisible();
    await expect(
      page.getByRole("button", { name: fr.auth.login.submit }),
    ).toBeVisible();
    // Rien d'autre : ni contenu de l'app, ni déconnexion, ni inscription.
    await expect(
      page.getByRole("heading", { name: fr.dashboard.title }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: fr.auth.signOut }),
    ).toHaveCount(0);
    await expect(page.getByRole("link")).toHaveText([
      fr.auth.login.forgotPassword,
    ]);
    expect(violations).toEqual([]);
  },
);
